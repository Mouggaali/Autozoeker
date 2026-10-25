import { NextRequest, NextResponse } from "next/server";
import { parseVehicleKey } from "@/lib/plate";
import { buildReport, loadBundle } from "@/lib/report";
import { parseTransmission } from "@/lib/transmission";

/** JSON-API voor het volledige rapport: /api/report?kenteken=G001BB&prijs=15000&km=60000&transmissie=automaat */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = parseVehicleKey(sp.get("kenteken") ?? "");
  if (!key || key.kind !== "plate") return NextResponse.json({ error: "Ongeldig kenteken" }, { status: 400 });
  const loaded = await loadBundle(key.value);
  if (!loaded) return NextResponse.json({ error: "Kenteken niet gevonden bij de RDW" }, { status: 404 });
  const price = Number(sp.get("prijs"));
  const km = Number(sp.get("km"));
  return NextResponse.json(
    buildReport(loaded.bundle, { askingPrice: price > 0 ? price : undefined, mileage: km > 0 ? km : undefined, transmission: parseTransmission(sp.get("transmissie")) }),
  );
}
