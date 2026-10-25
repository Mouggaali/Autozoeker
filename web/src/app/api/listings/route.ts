import { NextRequest, NextResponse } from "next/server";
import { loadMarket, parseFilters } from "@/lib/market";
import { parseVehicleKey } from "@/lib/plate";
import { loadBundle } from "@/lib/report";
import { effectiveTransmission, parseTransmission } from "@/lib/transmission";

export const maxDuration = 60;

/**
 * Vergelijkbare advertenties + cijfers + prijsbandbreedte.
 * /api/listings?kenteken=G001BB[&transmissie=automaat&refPrice=&refKm=]
 *   [&yearFrom=&yearTo=&kmFrom=&kmTo=&pkFrom=&pkTo=&priceFrom=&priceTo=&body=hatchback|alle&fuel=benzine|alle&transmission=automaat|alle]
 * `transmissie` is de transmissie van de eigen auto; `transmission` is het filter.
 * Zonder filterparameters gelden de standaardfilters (zelfde brandstof en transmissie, bouwjaar ±1, vermogen ±20%).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = parseVehicleKey(sp.get("kenteken") ?? "");
  if (!key || key.kind !== "plate") return NextResponse.json({ error: "Ongeldig kenteken" }, { status: 400 });
  const loaded = await loadBundle(key.value);
  if (!loaded) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const v = loaded.bundle.vehicle;
  const transmission = effectiveTransmission(v, parseTransmission(sp.get("transmissie")));
  const market = await loadMarket(loaded.bundle, parseFilters((k) => sp.get(k), v, transmission), {
    price: Number(sp.get("refPrice")) || undefined,
    km: Number(sp.get("refKm")) || undefined,
    transmission,
  });
  if (market.failed) return NextResponse.json({ error: market.failed }, { status: 502 });
  return NextResponse.json(market);
}
