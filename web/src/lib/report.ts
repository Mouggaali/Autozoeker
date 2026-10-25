import { promises as fs } from "node:fs";
import path from "node:path";
import { calcBpm } from "./engines/bpm";
import { calcOwnership, defaultInputs, ownershipFacts } from "./engines/ownership";
import { calcScore } from "./engines/score";
import { estimateImport, estimateValue } from "./engines/valuation";
import { searchLinks } from "./providers/market";
import { fetchRdw } from "./rdw";
import { buildSpecs, buildTimeline } from "./specs";
import type { RdwBundle, SourceRef, UserInputs } from "./types";

/**
 * Eenvoudige bestandsopslag voor RDW-snapshots (.data/reports). Vervang door Supabase/Postgres
 * door RdwStore te implementeren; zie docs/DATA_SOURCES.md.
 */
const DIR = path.join(process.cwd(), ".data", "reports");
const TTL_MS = 12 * 60 * 60 * 1000;

export async function loadBundle(kenteken: string): Promise<{ bundle: RdwBundle; cached: boolean } | null> {
  const file = path.join(DIR, `${kenteken}.json`);
  try {
    const cached = JSON.parse(await fs.readFile(file, "utf8")) as RdwBundle;
    if (Date.now() - new Date(cached.fetchedAt).getTime() < TTL_MS) return { bundle: cached, cached: true };
  } catch {}
  const bundle = await fetchRdw(kenteken);
  if (!bundle) return null;
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(bundle));
  } catch {}
  return { bundle, cached: false };
}

export const SOURCES: SourceRef[] = [
  { id: "rdw", name: "RDW Open Data (gekentekende voertuigen, brandstof, assen, APK, gebreken, terugroepacties)", url: "https://opendata.rdw.nl/" },
  { id: "bd", name: "Belastingdienst BPM-tarieven 2026 (indicatief overgenomen)", url: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/auto_en_vervoer/belastingen_op_auto_en_motor/bpm/" },
  { id: "model", name: "Eigen rekenmodellen (waarde, kosten, score) – schattingen", note: "Zie docs/DATA_SOURCES.md voor aannames." },
];

export function buildReport(bundle: RdwBundle, input: UserInputs) {
  const v = bundle.vehicle;
  const nl = estimateValue(v, input.mileage, "NL", input.transmission);
  const de = estimateValue(v, input.mileage, "DE", input.transmission);
  const bpm = calcBpm(v);
  const importCost = de.mid != null ? estimateImport(v, de.mid, nl.mid) : null;
  const ownInputs = defaultInputs(v, nl.mid);
  const ownership = calcOwnership(ownershipFacts(v), ownInputs);
  const score = calcScore(bundle, nl, ownership, input);
  return {
    bundle,
    specs: buildSpecs(bundle),
    timeline: buildTimeline(bundle),
    nl,
    de,
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
