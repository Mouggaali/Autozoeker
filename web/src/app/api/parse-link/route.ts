import { NextRequest, NextResponse } from "next/server";
import { runPythonTool } from "@/lib/providers/python";

export const maxDuration = 30;

// Dezelfde allowlist als tools/parse_listing_url.py (die controleert ook redirects); hier al vroeg weigeren
const HOSTS = /^(www\.|link\.)?marktplaats\.nl$|^(www\.)?autoscout24\.(nl|de)$/i;

export interface ParsedListing {
  platform: string;
  url: string;
  title: string | null;
  kenteken: string | null;
  price: number | null;
  mileage: number | null;
  year: number | null;
  transmission: string | null;
  transmissionGroup: "handgeschakeld" | "automaat" | null;
  powerKw: number | null;
  fuelGroup: string | null;
}

/** POST /api/parse-link {"url": "..."} → gegevens uit een Marktplaats- of AutoScout24-advertentie. */
export async function POST(req: NextRequest) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: unknown };
  let host = "";
  try { host = new URL(String(url)).hostname; } catch {}
  if (typeof url !== "string" || url.length > 500 || !HOSTS.test(host)) {
    return NextResponse.json({ error: "Plak een link van Marktplaats of AutoScout24 (.nl/.de)." }, { status: 400 });
  }
  try {
    const out = await runPythonTool<ParsedListing | { error: string }>("parse_listing_url.py", { url }, 25_000);
    return NextResponse.json(out, { status: "error" in out ? 422 : 200 });
  } catch {
    return NextResponse.json({ error: "De advertentie kon niet worden gelezen. Probeer het opnieuw of vul de gegevens zelf in." }, { status: 502 });
  }
}
