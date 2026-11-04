import { cacheGet, cacheSet } from "./cache";
import { calcOwnership, defaultInputs, ownershipFacts } from "./engines/ownership";
import { type FairPriceModel, fairPrice, fitFairPrice } from "./engines/fairPrice";
import { calcScore, type MarketRef } from "./engines/score";
import { canRegister, importInfo } from "./damage";
import { matchIssues } from "./knownIssues";
import { cleanPeers, priceBand, quantile } from "./market";
import { fetchListings } from "./providers/listings";
import { runPythonTool } from "./providers/python";
import { loadBundle } from "./report";
import type { FuelGroup, Listing, ListingFilters, PriceBand, TransmissionGroup } from "./types";

/**
 * Deal-finder: zoeken op merk en model in plaats van kenteken. Alle Nederlandse advertenties krijgen een eerlijke
 * prijs (dezelfde regressie als het rapport), gerangschikt op korting. De beste vijf krijgen een RDW-check via het
 * kenteken uit de advertentie (tools/parse_listing_url.py): het échte rapportcijfer, APK-gebreken en recalls.
 */
export interface DealSearch {
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  fuel: FuelGroup | null;
  transmission: TransmissionGroup | null;
  priceTo: number | null;
  kmTo: number | null;
}

export interface PlateCheck {
  kenteken: string;
  score: number;
  apkDefects: number;
  openRecalls: number;
  odometer: string;
  issues: string[];
  apkExpires: string | null;
  blocked: boolean;
  imported: boolean;
}

export interface Deal extends Listing {
  fair: number | null;
  /** Vraagprijs − eerlijke prijs; negatief = goedkoper dan de markt */
  gap: number | null;
  excluded?: string;
  check?: PlateCheck | { error: string };
}

export interface DealResult {
  deals: Deal[];
  model: FairPriceModel | null;
  band: PriceBand | null;
  excluded: number;
  errors: Record<string, string>;
  fetchedAt: string;
}

export const TOP_CHECKS = 5;

/** Rekendeel (zonder netwerk): opschonen, eerlijke prijs per advertentie en rangschikken op relatieve korting. */
export function rankDeals(listings: Listing[], now = new Date()): Pick<DealResult, "deals" | "model" | "band" | "excluded"> {
  const nl = listings.filter((l) => l.country === "NL");
  const { kept, reasons, excluded } = cleanPeers(nl);
  const model = fitFairPrice(kept, now);
  const band = priceBand(kept);
  const kms = kept.map((l) => l.mileage).filter((x): x is number => x != null).sort((a, b) => a - b);
  const medianKm = kms.length ? quantile(kms, 0.5) : null;

  // Zonder geloofwaardig model: mediaan per bouwjaar (of overall) als referentie
  const medianOf = (xs: number[]) => (xs.length ? quantile([...xs].sort((a, b) => a - b), 0.5) : null);
  const byYear = (y: number | null) => medianOf(kept.filter((l) => l.year === y).map((l) => l.price)) ?? band?.median ?? null;

  const deals: Deal[] = nl.map((l) => {
    const fair = model ? fairPrice(model, l.year, l.mileage ?? medianKm ?? 0, now).mid : byYear(l.year);
    return { ...l, fair, gap: fair != null ? l.price - fair : null, excluded: reasons.get(l.id) };
  });
  const rel = (d: Deal) => (d.gap != null && d.fair ? d.gap / d.fair : Infinity);
  deals.sort((a, b) => Number(!!a.excluded) - Number(!!b.excluded) || rel(a) - rel(b));
  return { deals, model, band, excluded: excluded.noise + excluded.duplicates + excluded.outliers };
}

const PLATE_TTL_S = 24 * 60 * 60;

/** Kenteken uit een advertentie (gecachet); null als de advertentie er geen noemt. */
async function plateOf(url: string): Promise<string | null> {
  const hit = await cacheGet<{ kenteken: string | null }>(`plate:${url}`);
  if (hit) return hit.kenteken;
  const out = await runPythonTool<{ kenteken?: string | null; error?: string }>("parse_listing_url.py", { url }, 25_000);
  if (out.error) throw new Error(out.error);
  await cacheSet(`plate:${url}`, { kenteken: out.kenteken ?? null }, PLATE_TTL_S);
  return out.kenteken ?? null;
}

async function checkDeal(d: Deal, ref: MarketRef | null): Promise<PlateCheck | { error: string }> {
  try {
    const kenteken = await plateOf(d.url);
    if (!kenteken) return { error: "geen kenteken in advertentie" };
    const loaded = await loadBundle(kenteken);
    if (!loaded) return { error: "kenteken niet gevonden bij de RDW" };
    const b = loaded.bundle, v = b.vehicle;
    const own = calcOwnership(ownershipFacts(v), defaultInputs(v, ref?.median ?? null));
    const transmission = d.transmissionGroup ?? undefined;
    const score = calcScore(b, ref, own, { askingPrice: d.price, mileage: d.mileage ?? undefined, transmission });
    return {
      kenteken,
      score: score.overall,
      apkDefects: b.inspections[0]?.defects.length ?? 0,
      openRecalls: b.recalls.filter((r) => r.statusCode !== "P" && r.statusCode !== "R").length,
      odometer: b.odometer.verdict,
      issues: matchIssues(v, transmission).map((x) => x.title),
      apkExpires: v.apkVervaldatum,
      blocked: canRegister(v) === false,
      imported: !!importInfo(v)?.imported,
    };
  } catch {
    return { error: "check mislukt" };
  }
}

export function dealFilters(s: DealSearch): ListingFilters {
  return { yearFrom: s.yearFrom, yearTo: s.yearTo, kmFrom: null, kmTo: s.kmTo, body: null, fuel: s.fuel, transmission: s.transmission, pkFrom: null, pkTo: null, priceFrom: null, priceTo: s.priceTo };
}

export async function findDeals(s: DealSearch): Promise<DealResult> {
  const raw = await fetchListings({ make: s.make, model: s.model, sources: ["marktplaats", "autoscout24_nl"] }, dealFilters(s));
  const ranked = rankDeals(raw.listings);
  const ref: MarketRef | null = ranked.band ? { ...ranked.band, label: `${ranked.band.count} advertenties in Nederland`, model: ranked.model } : null;
  // RDW-check voor de beste vijf (alleen platforms die een kenteken tonen); max. 5 detailpagina's per zoekopdracht
  const top = ranked.deals.filter((d) => !d.excluded && (d.platform === "Marktplaats" || d.platform === "AutoScout24.nl")).slice(0, TOP_CHECKS);
  const checks = await Promise.all(top.map((d) => checkDeal(d, ref)));
  top.forEach((d, i) => { d.check = checks[i]; });
  return { ...ranked, errors: raw.errors, fetchedAt: raw.fetchedAt };
}
