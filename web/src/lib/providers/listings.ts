import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FuelGroup, Listing, ListingFilters, Vehicle } from "../types";

/**
 * Haalt live advertenties op via tools/fetch_listings.py:
 *  - Marktplaats via de bibliotheek `marktplaats` (jensjeflensje/marktplaats-py)
 *  - AutoScout24 NL/DE via de HTML-techniek uit lorenzoelia/autoscout24_scraping
 * Dit zijn niet-officiële bronnen; resultaten worden 30 minuten gecachet om het volume laag te houden.
 */
const ROOT = path.resolve(process.cwd(), "..");
const TOOL = path.join(ROOT, "tools", "fetch_listings.py");
const VENV_PY = path.join(ROOT, "tools", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const CACHE_DIR = path.join(process.cwd(), ".data", "listings");
const TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 45_000;

export interface ListingsResult {
  listings: Listing[];
  errors: Record<string, string>;
  fetchedAt: string;
  cached: boolean;
}

async function pythonBin(): Promise<string> {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  try { await fs.access(VENV_PY); return VENV_PY; } catch { return process.platform === "win32" ? "python" : "python3"; }
}

function run(input: unknown): Promise<{ listings: Omit<Listing, "provenance">[]; errors: Record<string, string> }> {
  return new Promise(async (resolve, reject) => {
    const child = spawn(await pythonBin(), [TOOL], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Time-out bij ophalen advertenties")); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().split("\n").pop() || `exit ${code}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error("Ongeldige uitvoer van listings-tool")); }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

/**
 * Standaardfilters: bouwjaar ±1 en dezelfde brandstof. Carrosserie staat standaard op "alle": de RDW-inrichting
 * is te grof (een BMW i3 staat daar als "sedan") en zou goede resultaten wegfilteren.
 */
export function defaultFilters(v: Vehicle): ListingFilters {
  const fuel: FuelGroup = v.isElektrisch ? "elektrisch" : v.isHybride ? "hybride" : v.isDiesel ? "diesel" : "benzine";
  return {
    yearFrom: v.bouwjaar ? v.bouwjaar - 1 : null,
    yearTo: v.bouwjaar ? v.bouwjaar + 1 : null,
    kmFrom: null,
    kmTo: null,
    body: null,
    fuel,
  };
}

export async function fetchListings(v: Vehicle, f: ListingFilters): Promise<ListingsResult> {
  const key = [v.merk, v.model, f.yearFrom, f.yearTo, f.kmFrom, f.kmTo, f.body, f.fuel].join("-").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    const c = JSON.parse(await fs.readFile(file, "utf8")) as ListingsResult;
    if (Date.now() - new Date(c.fetchedAt).getTime() < TTL_MS) return { ...c, cached: true };
  } catch {}

  // RDW-handelsbenaming is vaak "I3" of "GOLF"; de eerste woorden volstaan voor het zoeken
  const words = v.model.split(/\s+/);
  const model = (words[1] && /^(\d{1,2}|klasse|class|serie|series)$/i.test(words[1]) ? words.slice(0, 2) : words.slice(0, 1)).join(" ");
  const raw = await run({ make: v.merk.split(" ")[0], model, limit: 12, year_from: f.yearFrom, year_to: f.yearTo, km_from: f.kmFrom, km_to: f.kmTo, body: f.body, fuel: f.fuel });
  const result: ListingsResult = {
    // Dezelfde advertentie kan dubbel in de resultaten staan (bijv. gesponsord + regulier)
    listings: raw.listings
      .filter((l, i, all) => all.findIndex((x) => x.platform === l.platform && x.price === l.price && x.mileage === l.mileage && x.year === l.year && x.location === l.location) === i)
      .map((l) => ({ ...l, provenance: "verified" as const })),
    errors: raw.errors,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
  // Alleen cachen als er resultaat is, zodat tijdelijke fouten niet 30 minuten blijven hangen
  if (result.listings.length) {
    try { await fs.mkdir(CACHE_DIR, { recursive: true }); await fs.writeFile(file, JSON.stringify(result)); } catch {}
  }
  return result;
}
