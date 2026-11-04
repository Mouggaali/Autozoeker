import { cacheGet, cacheSet } from "./cache";
import { calcBpm } from "./engines/bpm";
import { calcOwnership, defaultInputs, ownershipFacts } from "./engines/ownership";
import { calcScore, marketReference } from "./engines/score";
import { estimateImport } from "./engines/valuation";
import { type MarketData, type Params, loadMarket, parseFilters } from "./market";
import { searchLinks } from "./providers/market";
import { fetchRdw } from "./rdw";
import { matchIssues } from "./knownIssues";
import { negotiate } from "./engines/negotiation";
import { canRegister, importInfo } from "./damage";
import { kmVerdict } from "./engines/kmNorm";
import { fuelPricesNow, kmNormsNow } from "./liveData";
import { milieuzoneAccess } from "./milieuzones";
import { refreshCbs } from "./providers/cbs";
import { buildSpecs, buildTimeline } from "./specs";
import { effectiveTransmission, parseTransmission } from "./transmission";
import type { RdwBundle, SourceRef, UserInputs } from "./types";

/** RDW-snapshots 12 uur cachen (Upstash als ingesteld, anders bestand; zie lib/cache.ts). */
const TTL_S = 12 * 60 * 60;

/** RDW-snapshot plus (parallel) de CBS-referentiedata die de rekenkernen gebruiken. */
export async function loadBundle(kenteken: string): Promise<{ bundle: RdwBundle; cached: boolean } | null> {
  const [res] = await Promise.all([loadRdw(kenteken), refreshCbs()]);
  return res;
}

async function loadRdw(kenteken: string): Promise<{ bundle: RdwBundle; cached: boolean } | null> {
  const hit = await cacheGet<RdwBundle>(`rdw:${kenteken}`);
  if (hit) return { bundle: hit, cached: true };
  const bundle = await fetchRdw(kenteken);
  if (!bundle) return null;
  await cacheSet(`rdw:${kenteken}`, bundle, TTL_S);
  return { bundle, cached: false };
}

export const SOURCES: SourceRef[] = [
  { id: "rdw", name: "RDW Open Data (gekentekende voertuigen, brandstof, assen, APK, gebreken, terugroepacties)", url: "https://opendata.rdw.nl/" },
  { id: "bd", name: "Belastingdienst BPM-tarieven 2026 (indicatief overgenomen)", url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/auto_en_vervoer/belastingen_op_auto_en_motor/bpm/" },
  { id: "listings", name: "Live advertenties: Marktplaats en AutoScout24 NL/DE (vraagprijzen van vergelijkbare auto's)", note: "Niet-officiële koppelingen; vraagprijzen zijn geen verkoopprijzen." },
  { id: "model", name: "Eigen rekenmodellen (kosten, score) – schattingen", note: "Zie docs/DATA_SOURCES.md voor aannames." },
];

export function buildReport(bundle: RdwBundle, input: UserInputs, market: MarketData | null) {
  const v = bundle.vehicle;
  const bpm = calcBpm(v);
  // Marktwaarde = live mediaan van vergelijkbare advertenties (geen afschrijvingsmodel meer)
  const marketValue = market?.nl?.median ?? market?.reference?.median ?? null;
  const importCost = market?.de ? estimateImport(v, market.de.median, market.nl?.median ?? null) : null;
  const ownInputs = defaultInputs(v, marketValue);
  const ownership = calcOwnership(ownershipFacts(v), ownInputs);
  const score = calcScore(bundle, market?.reference ?? null, ownership, input);
  // Eerlijke prijs voor deze auto (bouwjaar + km), alleen met een geloofwaardig regressiemodel
  const fairRef = market?.reference?.model && input.mileage ? marketReference(market.reference, input.mileage, v.bouwjaar) : null;
  const fair = fairRef?.method === "model" ? { mid: fairRef.price, low: fairRef.low!, high: fairRef.high!, source: market!.reference!.source } : null;
  const issues = matchIssues(v, input.transmission);
  const km = input.mileage ? kmVerdict(v, input.mileage, kmNormsNow()) : null;
  // Onderhandelen tegen de eerlijke prijs; zonder km tegen de mediaanband
  const ref = market?.reference;
  const negRef = fair ? { ...fair, kind: "fair" as const } : ref ? { mid: ref.median, low: ref.low, high: ref.high, kind: "median" as const } : null;
  const negotiation = input.askingPrice && negRef
    ? negotiate({
        asking: input.askingPrice, ref: negRef, score: score.overall, issues, inspections: bundle.inspections,
        apkExpires: v.apkVervaldatum, odometer: bundle.odometer.verdict,
        listedAt: market?.listings.find((l) => l.sameAsReport)?.listedAt,
        blocked: canRegister(v) === false, imported: !!importInfo(v)?.imported, km,
      })
    : null;
  return {
    bundle,
    specs: buildSpecs(bundle),
    timeline: buildTimeline(bundle),
    market,
    marketValue,
    fair,
    issues,
    negotiation,
    km,
    kmNormPeriod: kmNormsNow().period,
    fuelPrices: fuelPricesNow(),
    milieuzone: milieuzoneAccess(bundle),
    bpm,
    importCost,
    ownInputs,
    ownership,
    score,
    links: searchLinks(v),
    sources: SOURCES,
    input,
  };
}
export type Report = ReturnType<typeof buildReport>;

/** Invoer uit de URL: ?prijs=15000&km=60000&transmissie=automaat */
export function parseInputs(get: Params, v: RdwBundle["vehicle"]): UserInputs {
  const price = Number(get("prijs"));
  const km = Number(get("km"));
  return {
    askingPrice: price > 0 ? price : undefined,
    mileage: km > 0 ? km : undefined,
    transmission: effectiveTransmission(v, parseTransmission(get("transmissie"))),
  };
}

/** Volledig rapport inclusief live marktvergelijking; filters voor de vergelijking komen ook uit de URL. */
export async function loadReport(kenteken: string, get: Params) {
  const loaded = await loadBundle(kenteken);
  if (!loaded) return null;
  const v = loaded.bundle.vehicle;
  const input = parseInputs(get, v);
  const market = await loadMarket(loaded.bundle, parseFilters(get, v, input.transmission), {
    price: input.askingPrice, km: input.mileage, transmission: input.transmission,
  });
  return { report: buildReport(loaded.bundle, input, market), cached: loaded.cached };
}
