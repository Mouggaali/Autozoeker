"use client";
import { useCallback, useEffect, useState } from "react";
import type { GradedListing, ImportCostResult, ListingFilters, ValuationResult } from "@/lib/types";
import type { SearchLink } from "@/lib/providers/market";
import { Card, ProvBadge, eur, scoreColor } from "./ui";

interface ListingsResponse {
  listings: GradedListing[];
  stats: { count: number; medianPrice: number | null; medianMileage: number | null };
  filters: ListingFilters;
  importExtras: number;
  errors: Record<string, string>;
  fetchedAt: string;
  cached: boolean;
}

interface Props {
  kenteken: string;
  nl: ValuationResult;
  de: ValuationResult;
  importCost: ImportCostResult | null;
  links: SearchLink[];
  askingPrice?: number;
  mileage?: number;
}

const fieldCls = "mt-1 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg";
const SOURCE_NAMES: Record<string, string> = { marktplaats: "Marktplaats", autoscout24_nl: "AutoScout24.nl", autoscout24_de: "AutoScout24.de" };

function GradeChip({ grade, confidence }: { grade: number; confidence: string }) {
  return (
    <span className="inline-grid h-9 w-9 place-items-center rounded-lg text-sm font-extrabold text-white" style={{ background: scoreColor(grade) }} title={`Cijfer ${grade.toFixed(1)} van 10 (zekerheid: ${confidence.toLowerCase()}, op basis van advertentiegegevens)`}>
      {grade.toFixed(1)}
    </span>
  );
}

export default function MarketTabs({ kenteken, nl, de, importCost, links, askingPrice, mileage }: Props) {
  const [tab, setTab] = useState<"NL" | "DE">("NL");
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<"yearFrom" | "yearTo" | "kmFrom" | "kmTo" | "body" | "fuel", string> | null>(null);

  const load = useCallback(async (params?: URLSearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ kenteken });
      if (askingPrice) q.set("refPrice", String(askingPrice));
      if (mileage) q.set("refKm", String(mileage));
      params?.forEach((v, k) => q.set(k, v));
      const r = await fetch(`/api/listings?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Mislukt");
      setData(j as ListingsResponse);
      const f = (j as ListingsResponse).filters;
      setForm({ yearFrom: f.yearFrom?.toString() ?? "", yearTo: f.yearTo?.toString() ?? "", kmFrom: f.kmFrom?.toString() ?? "", kmTo: f.kmTo?.toString() ?? "", body: f.body ?? "alle", fuel: f.fuel ?? "alle" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mislukt");
    } finally {
      setLoading(false);
    }
  }, [kenteken, askingPrice, mileage]);

  useEffect(() => { load(); }, [load]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (form) load(new URLSearchParams(form));
  };
  const reset = () => load(new URLSearchParams({ yearFrom: "", yearTo: "", kmFrom: "", kmTo: "", body: "alle", fuel: "alle" }));

  const val = tab === "NL" ? nl : de;
  const list = (data?.listings ?? []).filter((l) => l.country === tab);
  const lk = links.filter((l) => l.country === tab);
  const medianOf = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
  const liveMedian = medianOf(list.map((l) => l.price));
  const failedSources = data ? Object.entries(data.errors).filter(([k]) => (tab === "NL" ? k !== "autoscout24_de" : k === "autoscout24_de")) : [];

  return (
    <Card title="Marktvergelijking" subtitle="Live advertenties van Marktplaats en AutoScout24, met een cijfer per auto">
      <div role="tablist" className="mb-4 inline-flex rounded-lg border border-line p-1">
        {(["NL", "DE"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-brand text-white" : "text-muted"}`}>
            {t === "NL" ? "🇳🇱 Nederland" : "🇩🇪 Duitsland"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-soft p-4">
          <div className="flex items-center gap-2 text-sm text-muted">Modelschatting marktwaarde <ProvBadge p={val.provenance} /></div>
          {val.mid != null ? (
            <>
              <div className="mt-1 text-3xl font-extrabold">{eur(val.mid)}</div>
              <div className="text-sm text-muted">Bandbreedte {eur(val.low)} – {eur(val.high)}</div>
              {askingPrice && tab === "NL" && (
                <div className={`mt-2 text-sm font-semibold ${askingPrice > val.mid * 1.1 ? "text-bad" : askingPrice < val.mid * 0.9 ? "text-good" : ""}`}>
                  Vraagprijs {eur(askingPrice)} is {Math.abs(Math.round((askingPrice / val.mid - 1) * 100))}% {askingPrice > val.mid ? "boven" : "onder"} de schatting.
                </div>
              )}
            </>
          ) : <p className="mt-1 text-sm">Geen schatting mogelijk: {val.method}</p>}
          <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Aannames</summary>
            <ul className="mt-1 list-disc pl-5"><li>{val.method}</li>{val.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        </div>
        <div className="rounded-xl bg-good-soft p-4">
          <div className="flex items-center gap-2 text-sm text-muted">Mediaan vraagprijs live <ProvBadge p="verified" /></div>
          {liveMedian != null ? (
            <>
              <div className="mt-1 text-3xl font-extrabold">{eur(liveMedian)}</div>
              <div className="text-sm text-muted">Op basis van {list.length} advertenties in {tab === "NL" ? "Nederland" : "Duitsland"}. Vraagprijzen zijn niet gelijk aan verkoopprijzen.</div>
            </>
          ) : <p className="mt-1 text-sm text-muted">{data ? "Geen advertenties gevonden." : error ? "Niet beschikbaar." : "Advertenties laden…"}</p>}
        </div>
      </div>

      {tab === "DE" && importCost && (
        <div className="mt-4 rounded-xl border border-line p-4">
          <h3 className="font-semibold">Importkosten naar Nederland <ProvBadge p="estimate" /></h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {importCost.lines.map((l) => (
                <tr key={l.label} className="border-b border-line"><td className="py-1.5">{l.label}<div className="text-xs text-muted">{l.note}</div></td><td className="py-1.5 text-right tabular-nums">{eur(l.amount)}</td></tr>
              ))}
              <tr className="font-bold"><td className="py-2">Totaal geïmporteerd</td><td className="py-2 text-right tabular-nums">{eur(importCost.total)}</td></tr>
            </tbody>
          </table>
          {importCost.saving != null && (
            <p className={`mt-1 text-sm font-semibold ${importCost.saving > 0 ? "text-good" : "text-bad"}`}>
              {importCost.saving > 0 ? `Potentieel voordeel t.o.v. NL-marktwaarde: ${eur(importCost.saving)}` : `Import is naar schatting ${eur(-importCost.saving)} duurder dan een NL-auto.`}
            </p>
          )}
          <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Aannames importkosten</summary>
            <ul className="mt-1 list-disc pl-5">{importCost.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        </div>
      )}

      {form && (
        <form onSubmit={apply} className="mt-6 rounded-xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Filter vergelijkbare auto&apos;s</h3>
            <button type="button" onClick={reset} className="text-xs text-brand underline">Alle filters wissen</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <label className="text-xs text-muted">Bouwjaar van
              <input value={form.yearFrom} onChange={(e) => setForm({ ...form, yearFrom: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="2018" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Bouwjaar tot
              <input value={form.yearTo} onChange={(e) => setForm({ ...form, yearTo: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="2020" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Kilometers van
              <input value={form.kmFrom} onChange={(e) => setForm({ ...form, kmFrom: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="0" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Kilometers tot
              <input value={form.kmTo} onChange={(e) => setForm({ ...form, kmTo: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="100000" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Carrosserie
              <select value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={fieldCls}>
                <option value="alle">Alle</option>
                <option value="hatchback">Hatchback</option>
                <option value="stationwagon">Stationwagon</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV / terreinwagen</option>
                <option value="mpv">MPV</option>
                <option value="coupe">Coupé</option>
                <option value="cabrio">Cabriolet</option>
              </select>
            </label>
            <label className="text-xs text-muted">Brandstof
              <select value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value })} className={fieldCls}>
                <option value="alle">Alle</option>
                <option value="benzine">Benzine</option>
                <option value="diesel">Diesel</option>
                <option value="hybride">Hybride</option>
                <option value="elektrisch">Elektrisch</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button disabled={loading} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Zoeken…" : "Filter toepassen"}</button>
            <span className="text-xs text-muted">Standaard: zelfde brandstof als jouw auto, bouwjaar ±1.</span>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Vergelijkbare advertenties</h3>
        <span className="text-xs text-muted">Zelfde cijfer-engine als het rapport{tab === "DE" ? "; Duitse prijzen incl. importkosten" : ""}</span>
      </div>

      {loading && <div className="mt-3 animate-pulse space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-line" />)}<p className="text-xs text-muted">Advertenties ophalen bij Marktplaats en AutoScout24 (kan een paar seconden duren)…</p></div>}
      {error && <p className="mt-3 rounded-lg bg-bad-soft p-3 text-sm text-bad">Advertenties konden niet worden opgehaald: {error}</p>}
      {failedSources.length > 0 && <p className="mt-3 rounded-lg bg-warn-soft p-3 text-xs text-warn">Niet opgehaald: {failedSources.map(([k, m]) => `${SOURCE_NAMES[k] ?? k} (${m.slice(0, 80)})`).join("; ")}</p>}

      {data && !loading && list.length === 0 && !error && (
        <p className="mt-3 text-sm text-muted">Geen advertenties gevonden voor deze auto in {tab === "NL" ? "Nederland" : "Duitsland"}.</p>
      )}

      {!loading && list.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {list.map((l) => (
            <li key={l.id} className="flex gap-3 py-3">
              <GradeChip grade={l.grade} confidence={l.gradeConfidence} />
              {l.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden h-16 w-24 flex-none rounded-lg object-cover sm:block" /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-brand hover:underline">{l.title} ↗</a>
                  <span className="font-extrabold tabular-nums">{eur(l.price)}</span>
                </div>
                <div className="text-xs text-muted">
                  {l.platform} · {[l.year, l.mileage != null ? `${l.mileage.toLocaleString("nl-NL")} km` : null, l.fuel, l.transmission, l.power, l.location].filter(Boolean).join(" · ")}
                  {l.country === "DE" && <> · <b>≈ {eur(l.effectivePrice)} incl. import</b></>}
                </div>
                <div className="mt-1 text-xs">{l.gradeReasons.join(" · ")}</div>
                {!l.sameAsReport && (
                  <a href={`/auto/${kenteken}?prijs=${l.price}${l.mileage ? `&km=${l.mileage}` : ""}`} className="mt-1 inline-block text-xs text-brand hover:underline">Bekijk rapport met deze prijs en km →</a>
                )}
                {l.flags.map((f) => <div key={f} className="mt-1 inline-block rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">⚠ {f}</div>)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Zelf verder zoeken:</span>
        {lk.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-3 py-1 font-medium text-brand hover:bg-brand-soft">{l.platform} ↗</a>)}
        {tab === "DE" && <span className="text-xs text-muted">(mobile.de: nog geen automatische koppeling)</span>}
      </div>
      {data && <p className="mt-2 text-xs text-muted">Opgehaald {new Date(data.fetchedAt).toLocaleTimeString("nl-NL")}{data.cached ? " (cache, max. 30 min oud)" : ""}. Bronnen: marktplaats-py en de AutoScout24-techniek uit autoscout24_scraping; niet-officiële koppelingen die kunnen veranderen of worden geblokkeerd. Het cijfer beoordeelt de vraagprijs, niet de technische staat.</p>}
    </Card>
  );
}
