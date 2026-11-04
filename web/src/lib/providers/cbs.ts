import { cacheGet, cacheSet } from "../cache";
import { FALLBACK_FUEL, FALLBACK_KM, type FuelPrices, type KmNorms, setLiveData } from "../liveData";

/**
 * CBS Open Data (gratis, geen sleutel): pompprijzen per dag (80416ned) en gemiddeld jaarkilometrage per
 * brandstof en leeftijd (85404NED). Gecachet; bij een fout blijven de terugvalwaarden uit liveData.ts staan.
 * Let op: $orderby op Perioden geeft de oudste rij, dus filteren op een recente periode en de laatste nemen.
 */
const API = "https://opendata.cbs.nl/ODataApi/odata";
const DAY = 86_400_000;

async function get<T>(url: string): Promise<T[]> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`CBS ${r.status}`);
  return ((await r.json()) as { value: T[] }).value;
}

export async function fetchFuelPrices(now = new Date()): Promise<FuelPrices> {
  const from = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10).replace(/-/g, "");
  const rows = await get<{ Perioden: string; BenzineEuro95_1: number | null; Diesel_2: number | null; Lpg_3: number | null }>(
    `${API}/80416ned/TypedDataSet?$filter=Perioden ge '${from}'&$select=Perioden,BenzineEuro95_1,Diesel_2,Lpg_3`,
  );
  const last = rows.filter((r) => r.BenzineEuro95_1 && r.Diesel_2).at(-1);
  if (!last) throw new Error("CBS: geen recente pompprijzen");
  const p = last.Perioden;
  return {
    benzine: last.BenzineEuro95_1!, diesel: last.Diesel_2!, lpg: last.Lpg_3 ?? FALLBACK_FUEL.lpg, elektrisch: FALLBACK_FUEL.elektrisch,
    date: `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}`, source: "cbs",
  };
}

const FUEL_KEYS = { "A041287": "benzine", "A019275": "diesel", "A027841": "lpg" } as const;
const AGE_KEYS = ["10010", "10100", "10200", "10300", "10400", "10500", "10600", "10700", "10800", "A045761"];

export async function fetchKmNorms(): Promise<KmNorms> {
  const periods = await get<{ Key: string }>(`${API}/85404NED/Perioden`);
  const period = periods.map((p) => p.Key).filter((k) => /JJ00$/.test(k)).sort().at(-1);
  if (!period) throw new Error("CBS: geen periode");
  const rows = await get<{ Brandstofsoort: string; LeeftijdVoertuig: string; TotaalGemiddeldJaarkilometrage_7: number | null }>(
    `${API}/85404NED/TypedDataSet?$filter=Perioden eq '${period}' and Eigendomssituatie eq 'A027863'&$select=Brandstofsoort,LeeftijdVoertuig,TotaalGemiddeldJaarkilometrage_7`,
  );
  const out: KmNorms = { period: period.slice(0, 4), benzine: [], diesel: [], lpg: [], source: "cbs" };
  for (const [code, fuel] of Object.entries(FUEL_KEYS)) {
    out[fuel] = AGE_KEYS.map((age, i) => rows.find((r) => r.Brandstofsoort.trim() === code && r.LeeftijdVoertuig.trim() === age)?.TotaalGemiddeldJaarkilometrage_7 ?? FALLBACK_KM[fuel][i]);
  }
  return out;
}

let refreshing: Promise<void> | null = null;

/** Ververs de CBS-data als de cache verlopen is; nooit een fout naar buiten (dan gelden de terugvalwaarden). */
export function refreshCbs(): Promise<void> {
  refreshing ??= (async () => {
    const [fuel, km] = await Promise.all([
      cacheGet<FuelPrices>("cbs:fuel").then((hit) => hit ?? fetchFuelPrices().then(async (f) => { await cacheSet("cbs:fuel", f, 24 * 3600); return f; })).catch(() => undefined),
      cacheGet<KmNorms>("cbs:km").then((hit) => hit ?? fetchKmNorms().then(async (k) => { await cacheSet("cbs:km", k, 30 * 24 * 3600); return k; })).catch(() => undefined),
    ]);
    setLiveData({ fuel, km });
  })().finally(() => { setTimeout(() => { refreshing = null; }, 60_000); });
  return refreshing;
}
