import { cacheGet, cacheSet } from "../cache";
import type { FuelGroup, Listing, ListingFilters, TransmissionGroup, Vehicle } from "../types";
import { runPythonTool } from "./python";

/**
 * Haalt live advertenties op via tools/fetch_listings.py:
 *  - Marktplaats via de bibliotheek `marktplaats` (jensjeflensje/marktplaats-py)
 *  - AutoScout24 NL/DE via de HTML-techniek uit lorenzoelia/autoscout24_scraping
 * Dit zijn niet-officiële bronnen; resultaten worden 30 minuten gecachet om het volume laag te houden.
 * Zie workflows/fetch_listings.md.
 */
const TTL_S = 30 * 60;

export interface ListingsResult {
  listings: Listing[];
  errors: Record<string, string>;
  fetchedAt: string;
  cached: boolean;
}

/**
 * Standaardfilters: bouwjaar ±1, dezelfde brandstof, (indien opgegeven) dezelfde transmissie en vermogen ±20%.
 * De vermogensrange houdt sportieve varianten (bijv. Golf GTI/R naast een 1.4 TSI) buiten de vergelijking. Carrosserie staat standaard op "alle": de RDW-inrichting
 * is te grof (een BMW i3 staat daar als "sedan") en zou goede resultaten wegfilteren.
 */
export const KW_TO_PK = 1.35962;
export const POWER_MARGIN = 0.2;

export function defaultFilters(v: Vehicle, transmission?: TransmissionGroup): ListingFilters {
  const pk = v.vermogenKw ? v.vermogenKw * KW_TO_PK : null;
  const fuel: FuelGroup = v.isElektrisch ? "elektrisch" : v.isHybride ? "hybride" : v.isDiesel ? "diesel" : "benzine";
  return {
    yearFrom: v.bouwjaar ? v.bouwjaar - 1 : null,
    yearTo: v.bouwjaar ? v.bouwjaar + 1 : null,
    kmFrom: null,
    kmTo: null,
    body: null,
    fuel,
    // Elektrische auto's zijn altijd automaat; filteren zou alleen advertenties zonder transmissieveld wegfilteren
    transmission: v.isElektrisch ? null : transmission ?? null,
    pkFrom: pk ? Math.floor((pk * (1 - POWER_MARGIN)) / 5) * 5 : null,
    pkTo: pk ? Math.ceil((pk * (1 + POWER_MARGIN)) / 5) * 5 : null,
    priceFrom: null,
    priceTo: null,
  };
}

// Lopende zoekopdrachten: de rapportpagina en /api/summary vragen vaak tegelijk hetzelfde op
const inFlight = new Map<string, Promise<ListingsResult>>();

export async function fetchListings(v: Vehicle, f: ListingFilters): Promise<ListingsResult> {
  const key = [v.merk, v.model, f.yearFrom, f.yearTo, f.kmFrom, f.kmTo, f.body, f.fuel, f.transmission, f.pkFrom, f.pkTo, f.priceFrom, f.priceTo].join("-").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const hit = await cacheGet<ListingsResult>(`listings:${key}`);
  if (hit) return { ...hit, cached: true };
  const running = inFlight.get(key);
  if (running) return running;
  const p = scrape(v, f, key).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function scrape(v: Vehicle, f: ListingFilters, key: string): Promise<ListingsResult> {
  // RDW-handelsbenaming is vaak "I3" of "GOLF"; de eerste woorden volstaan voor het zoeken
  const words = v.model.split(/\s+/);
  const model = (words[1] && /^(\d{1,2}|klasse|class|serie|series)$/i.test(words[1]) ? words.slice(0, 2) : words.slice(0, 1)).join(" ");
  const raw = await runPythonTool<{ listings: Omit<Listing, "provenance">[]; errors: Record<string, string> }>("fetch_listings.py", { make: v.merk.split(" ")[0], model, limit: 12, year_from: f.yearFrom, year_to: f.yearTo, km_from: f.kmFrom, km_to: f.kmTo, body: f.body, fuel: f.fuel, transmission: f.transmission,
    power_from: f.pkFrom ? Math.floor(f.pkFrom / KW_TO_PK) : null, power_to: f.pkTo ? Math.ceil(f.pkTo / KW_TO_PK) : null,
    price_from: f.priceFrom, price_to: f.priceTo });
  const result: ListingsResult = {
    // Dezelfde advertentie kan dubbel in de resultaten staan (bijv. gesponsord + regulier)
    listings: raw.listings
      .filter((l, i, all) => all.findIndex((x) => x.platform === l.platform && x.price === l.price && x.mileage === l.mileage && x.year === l.year && x.location === l.location) === i)
      .map((l) => ({ ...l, provenance: "verified" as const })),
    errors: raw.errors,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
  // Alleen cachen als er resultaat is, zodat tijdelijke fouten niet 30 minuten blijven hangen
  if (result.listings.length) await cacheSet(`listings:${key}`, result, TTL_S);
  return result;
}
