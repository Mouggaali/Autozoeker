import { NextRequest, NextResponse } from "next/server";
import { gradeListings } from "@/lib/engines/listingGrade";
import { estimateImport, estimateValue } from "@/lib/engines/valuation";
import { defaultFilters, fetchListings } from "@/lib/providers/listings";
import { parseVehicleKey } from "@/lib/plate";
import { loadBundle } from "@/lib/report";
import type { BodyGroup, FuelGroup, ListingFilters } from "@/lib/types";

export const maxDuration = 60;

const BODIES: BodyGroup[] = ["hatchback", "stationwagon", "sedan", "suv", "mpv", "coupe", "cabrio"];
const FUELS: FuelGroup[] = ["benzine", "diesel", "hybride", "elektrisch"];

/**
 * Vergelijkbare advertenties + cijfers.
 * /api/listings?kenteken=G001BB[&yearFrom=&yearTo=&kmFrom=&kmTo=&body=hatchback|alle&fuel=benzine|alle]
 * Zonder parameters gelden de standaardfilters (zelfde brandstof/carrosserie, bouwjaar ±1).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = parseVehicleKey(sp.get("kenteken") ?? "");
  if (!key || key.kind !== "plate") return NextResponse.json({ error: "Ongeldig kenteken" }, { status: 400 });
  const loaded = await loadBundle(key.value);
  if (!loaded) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const v = loaded.bundle.vehicle;

  const def = defaultFilters(v);
  const num = (name: string, fallback: number | null) => {
    if (!sp.has(name)) return fallback;
    const n = Number(sp.get(name));
    return sp.get(name) !== "" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const pick = <T extends string>(name: string, allowed: T[], fallback: T | null) => {
    if (!sp.has(name)) return fallback;
    const val = sp.get(name) as T;
    return allowed.includes(val) ? val : null; // "alle" of onbekend = geen filter
  };
  const filters: ListingFilters = {
    yearFrom: num("yearFrom", def.yearFrom),
    yearTo: num("yearTo", def.yearTo),
    kmFrom: num("kmFrom", def.kmFrom),
    kmTo: num("kmTo", def.kmTo),
    body: pick("body", BODIES, def.body),
    fuel: pick("fuel", FUELS, def.fuel),
  };

  try {
    const res = await fetchListings(v, filters);
    // Importopslag (alles behalve de aankoopprijs) voor het vergelijken van Duitse met Nederlandse auto's
    const probe = estimateImport(v, 10000, estimateValue(v, undefined, "NL").mid);
    const extras = probe ? probe.total - probe.purchasePrice : 0;
    const { graded, stats } = gradeListings(loaded.bundle, res.listings, extras, {
      price: Number(sp.get("refPrice")) || undefined,
      km: Number(sp.get("refKm")) || undefined,
    });
    return NextResponse.json({ listings: graded, stats, filters, importExtras: extras, errors: res.errors, fetchedAt: res.fetchedAt, cached: res.cached });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Onbekende fout" }, { status: 502 });
  }
}
