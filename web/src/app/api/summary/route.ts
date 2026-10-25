import { NextRequest, NextResponse } from "next/server";
import { summarize } from "@/lib/ai";
import { parseVehicleKey } from "@/lib/plate";
import { loadReport } from "@/lib/report";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = parseVehicleKey(sp.get("kenteken") ?? "");
  if (!key || key.kind !== "plate") return NextResponse.json({ error: "Ongeldig kenteken" }, { status: 400 });
  const loaded = await loadReport(key.value, (k) => sp.get(k));
  if (!loaded) return NextResponse.json({ error: "Kenteken niet gevonden bij de RDW" }, { status: 404 });
  return NextResponse.json(await summarize(loaded.report));
}
