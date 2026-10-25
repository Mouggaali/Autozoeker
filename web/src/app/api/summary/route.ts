import { NextRequest, NextResponse } from "next/server";
import { summarize } from "@/lib/ai";
import { parseVehicleKey } from "@/lib/plate";
import { buildReport, loadBundle } from "@/lib/report";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = parseVehicleKey(sp.get("kenteken") ?? "");
  if (!key || key.kind !== "plate") return NextResponse.json({ error: "Ongeldig kenteken" }, { status: 400 });
  const loaded = await loadBundle(key.value);
  if (!loaded) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  const price = Number(sp.get("prijs"));
  const km = Number(sp.get("km"));
  const report = buildReport(loaded.bundle, { askingPrice: price > 0 ? price : undefined, mileage: km > 0 ? km : undefined });
  return NextResponse.json(await summarize(report));
}
