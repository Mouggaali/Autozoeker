import { fitFairPrice } from "./engines/fairPrice";
import { gradeListings } from "./engines/listingGrade";
import type { MarketRef } from "./engines/score";
import { estimateImport } from "./engines/valuation";
import { defaultFilters, fetchListings } from "./providers/listings";
import { TRANSMISSIONS } from "./transmission";
import type { BodyGroup, FuelGroup, GradedListing, Listing, ListingFilters, PriceBand, RdwBundle, TransmissionGroup, Vehicle } from "./types";

const BODIES: BodyGroup[] = ["hatchback", "stationwagon", "sedan", "suv", "mpv", "coupe", "cabrio"];
const FUELS: FuelGroup[] = ["benzine", "diesel", "hybride", "elektrisch"];
const TR_PLURAL: Record<TransmissionGroup, string> = { automaat: "automaten", handgeschakeld: "handgeschakelde auto's" };

export type Params = (name: string) => string | null;

/**
 * Filters uit de URL. Ontbreekt een parameter, dan geldt de standaard (zelfde brandstof en transmissie,
 * bouwjaar ±1, vermogen ±20%); een lege waarde of "alle" betekent: niet filteren.
 */
export function parseFilters(get: Params, v: Vehicle, ownTransmission?: TransmissionGroup): ListingFilters {
  const def = defaultFilters(v, ownTransmission);
  const num = (name: string, fallback: number | null) => {
    const raw = get(name);
    if (raw == null) return fallback;
    const n = Number(raw);
    return raw !== "" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const pick = <T extends string>(name: string, allowed: T[], fallback: T | null) => {
    const raw = get(name);
    if (raw == null) return fallback;
    return allowed.includes(raw as T) ? (raw as T) : null;
  };
  return {
    yearFrom: num("yearFrom", def.yearFrom),
    yearTo: num("yearTo", def.yearTo),
    kmFrom: num("kmFrom", def.kmFrom),
    kmTo: num("kmTo", def.kmTo),
    body: pick("body", BODIES, def.body),
    fuel: pick("fuel", FUELS, def.fuel),
    transmission: pick("transmission", TRANSMISSIONS, def.transmission),
    pkFrom: num("pkFrom", def.pkFrom),
    pkTo: num("pkTo", def.pkTo),
    priceFrom: num("priceFrom", def.priceFrom),
    priceTo: num("priceTo", def.priceTo),
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Kwantiel met lineaire interpolatie op een gesorteerde lijst. */
const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

/** Mediaan en middelste 50% van de vraagprijzen; minimaal 3 advertenties. */
export function priceBand(listings: Listing[], extra = 0): PriceBand | null {
  if (listings.length < 3) return null;
  const prices = listings.map((l) => l.price + extra).sort((a, b) => a - b);
  const kms = listings.map((l) => l.mileage).filter((x): x is number => x != null && x > 0);
  return {
    count: prices.length,
    median: Math.round(median(prices)),
    low: Math.round(quantile(prices, 0.25)),
    high: Math.round(quantile(prices, 0.75)),
    min: prices[0],
    max: prices[prices.length - 1],
    medianKm: kms.length >= 3 ? Math.round(median(kms)) : null,
  };
}

export interface Excluded {
  noise: number; // schade, export, opknapper, ...
  duplicates: number; // dezelfde auto op meerdere platforms
  outliers: number; // prijs ver buiten de rest (IQR-regel)
}

/**
 * Advertenties die de marktprijs vertekenen eruit halen, in deze volgorde:
 * 1. ruis volgens de scraper (schade, export, opknapper, defect, lease-overname, zonder APK)
 * 2. dubbele advertenties: zelfde auto op meerdere platforms (zelfde bouwjaar, prijs en km binnen 1%)
 * 3. uitschieters per land: buiten Q1 − 1,5·IQR … Q3 + 1,5·IQR (pas vanaf 5 advertenties)
 * Uitgesloten advertenties blijven zichtbaar in de lijst, met de reden.
 */
export function cleanPeers(listings: Listing[]): { kept: Listing[]; reasons: Map<string, string>; excluded: Excluded } {
  const reasons = new Map<string, string>();
  const excluded: Excluded = { noise: 0, duplicates: 0, outliers: 0 };
  const within1 = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) <= Math.max(1, Math.max(a, b) * 0.01);

  const kept: Listing[] = [];
  for (const l of listings) {
    if (l.noise) {
      reasons.set(l.id, `niet meegeteld: ${l.noise}`);
      excluded.noise++;
      continue;
    }
    const dup = kept.find((k) => k.platform !== l.platform && k.country === l.country && k.year === l.year && within1(k.price, l.price) && within1(k.mileage, l.mileage));
    if (dup) {
      reasons.set(l.id, `niet meegeteld: dubbel (staat ook op ${dup.platform})`);
      excluded.duplicates++;
      continue;
    }
    kept.push(l);
  }

  const result: Listing[] = [];
  for (const country of ["NL", "DE"] as const) {
    const group = kept.filter((l) => l.country === country);
    if (group.length < 5) {
      result.push(...group);
      continue;
    }
    const sorted = group.map((l) => l.price).sort((x, y) => x - y);
    const q1 = quantile(sorted, 0.25), q3 = quantile(sorted, 0.75), iqr = q3 - q1;
    for (const l of group) {
      if (l.price < q1 - 1.5 * iqr || l.price > q3 + 1.5 * iqr) {
        reasons.set(l.id, `niet meegeteld: prijsuitschieter (${l.price < q1 ? "veel lager" : "veel hoger"} dan de rest)`);
        excluded.outliers++;
      } else result.push(l);
    }
  }
  return { kept: result, reasons, excluded };
}

export interface MarketData {
  listings: GradedListing[];
  filters: ListingFilters;
  nl: PriceBand | null; // vraagprijzen NL
  de: PriceBand | null; // vraagprijzen DE (zonder import)
  /** Referentie voor het cijfer: NL-advertenties, of bij te weinig NL-advertenties Duitse incl. importkosten */
  reference: (MarketRef & { source: "NL" | "DE" }) | null;
  /** Transmissie waarbinnen is vergeleken; null = alle advertenties */
  comparedTransmission: TransmissionGroup | null;
  excluded: Excluded;
  importExtras: number;
  errors: Record<string, string>;
  fetchedAt: string;
  cached: boolean;
  failed?: string;
}

export async function loadMarket(
  bundle: RdwBundle,
  filters: ListingFilters,
  ref: { price?: number; km?: number; transmission?: TransmissionGroup },
): Promise<MarketData> {
  const v = bundle.vehicle;
  // Importopslag (alles behalve de aankoopprijs) voor het vergelijken van Duitse met Nederlandse auto's
  const probe = estimateImport(v, 10000, null);
  const importExtras = probe ? probe.total - probe.purchasePrice : 0;

  let raw: Awaited<ReturnType<typeof fetchListings>>;
  try {
    raw = await fetchListings(v, filters);
  } catch (e) {
    return {
      listings: [], filters, nl: null, de: null, reference: null, comparedTransmission: null, importExtras,
      excluded: { noise: 0, duplicates: 0, outliers: 0 },
      errors: {}, fetchedAt: new Date().toISOString(), cached: false, failed: e instanceof Error ? e.message : "Onbekende fout",
    };
  }

  return { ...analyzeMarket(bundle, raw.listings, ref, importExtras), filters, errors: raw.errors, fetchedAt: raw.fetchedAt, cached: raw.cached };
}

/** Rekendeel van de marktvergelijking (zonder netwerk): opschonen, bandbreedtes, referentie en cijfers per advertentie. */
export function analyzeMarket(
  bundle: RdwBundle,
  listings: Listing[],
  ref: { price?: number; km?: number; transmission?: TransmissionGroup },
  importExtras: number,
): Pick<MarketData, "listings" | "nl" | "de" | "reference" | "comparedTransmission" | "excluded" | "importExtras"> {
  // Bij filter "alle" maar een bekende eigen transmissie: alleen auto's met dezelfde transmissie vergelijken (als er genoeg zijn)
  const same = ref.transmission ? listings.filter((l) => l.transmissionGroup === ref.transmission) : [];
  const useSame = same.length >= 3;
  const comparedTransmission = useSame ? ref.transmission! : null;
  const what = comparedTransmission ? TR_PLURAL[comparedTransmission] : "auto's";
  const { kept: peers, reasons, excluded } = cleanPeers(useSame ? same : listings);

  const nlPeers = peers.filter((l) => l.country === "NL");
  const dePeers = peers.filter((l) => l.country === "DE");
  const nl = priceBand(nlPeers);
  const de = priceBand(dePeers);
  const deEff = priceBand(dePeers, importExtras);
  // Eerlijke prijs: regressie op dezelfde (opgeschoonde) advertenties als de referentie; Duits incl. importkosten
  const reference = nl
    ? { ...nl, label: `${nl.count} vergelijkbare ${what} in Nederland`, source: "NL" as const, model: fitFairPrice(nlPeers) }
    : deEff
      ? { ...deEff, label: `${deEff.count} vergelijkbare ${what} in Duitsland (incl. importkosten)`, source: "DE" as const, model: fitFairPrice(dePeers.map((l) => ({ ...l, price: l.price + importExtras }))) }
      : null;

  const graded = gradeListings(bundle, listings, importExtras, reference, ref).map((g) => {
    const why = reasons.get(g.id);
    return why ? { ...g, excluded: why } : g;
  });
  return { listings: graded, nl, de, reference, comparedTransmission, excluded, importExtras };
}
