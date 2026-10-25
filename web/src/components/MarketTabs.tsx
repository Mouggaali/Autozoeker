"use client";
import { useState } from "react";
import type { MarketData } from "@/lib/market";
import type { SearchLink } from "@/lib/providers/market";
import type { ImportCostResult, PriceBand, TransmissionGroup } from "@/lib/types";
import { Card, PriceRange, ProvBadge, eur, scoreColor } from "./ui";

interface Props {
  kenteken: string;
  market: MarketData | null;
  importCost: ImportCostResult | null;
  links: SearchLink[];
  askingPrice?: number;
  mileage?: number;
  transmission?: TransmissionGroup;
}

const fieldCls = "mt-1 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg";
const SOURCE_NAMES: Record<string, string> = { marktplaats: "Marktplaats", autoscout24_nl: "AutoScout24.nl", autoscout24_de: "AutoScout24.de" };
const TR_PLURAL: Record<TransmissionGroup, string> = { automaat: "automaten", handgeschakeld: "handgeschakelde auto's" };
const TR_LABEL: Record<TransmissionGroup, string> = { automaat: "Automaat", handgeschakeld: "Handgeschakeld" };

function GradeChip({ grade, confidence }: { grade: number; confidence: string }) {
  return (
    <span className="num inline-grid h-10 w-10 flex-none place-items-center rounded-md text-sm font-semibold text-white" style={{ background: scoreColor(grade) }} title={`Cijfer ${grade.toFixed(1)} van 10 (zekerheid: ${confidence.toLowerCase()}, op basis van advertentiegegevens)`}>
      {grade.toFixed(1)}
    </span>
  );
}

function BandBlock({ band, country, askingPrice, what }: { band: PriceBand | null; country: "NL" | "DE"; askingPrice?: number; what: string }) {
  if (!band) return <p className="mt-1 text-sm text-muted">Te weinig advertenties gevonden (minimaal 3) voor een mediaan en bandbreedte.</p>;
  return (
    <>
      <div className="num mt-1 text-4xl font-semibold">{eur(band.median)}</div>
      <div className="num text-sm">Bandbreedte {eur(band.low)} – {eur(band.high)}</div>
      <PriceRange min={band.min} low={band.low} median={band.median} high={band.high} max={band.max} mark={country === "NL" ? askingPrice : undefined} />
      <div className="text-xs text-muted">Middelste 50% van de vraagprijzen; laagste {eur(band.min)}, hoogste {eur(band.max)}{band.medianKm ? `; mediane km-stand ${band.medianKm.toLocaleString("nl-NL")} km` : ""}.</div>
      {askingPrice && country === "NL" && (
        <div className={`mt-2 text-sm font-semibold ${askingPrice > band.high ? "text-bad" : askingPrice < band.low ? "text-good" : ""}`}>
          Vraagprijs {eur(askingPrice)} ligt {askingPrice > band.high ? "boven" : askingPrice < band.low ? "onder" : "binnen"} de bandbreedte.
        </div>
      )}
      <div className="mt-1 text-xs text-muted">Op basis van {band.count} {what} in {country === "NL" ? "Nederland" : "Duitsland"}. Vraagprijzen zijn niet gelijk aan verkoopprijzen.</div>
    </>
  );
}

export default function MarketTabs({ kenteken, market, importCost, links, askingPrice, mileage, transmission }: Props) {
  const [tab, setTab] = useState<"NL" | "DE">("NL");
  const f = market?.filters;
  const what = market?.comparedTransmission ? TR_PLURAL[market.comparedTransmission] : "vergelijkbare auto's";
  const band = tab === "NL" ? market?.nl ?? null : market?.de ?? null;
  const list = (market?.listings ?? []).filter((l) => l.country === tab);
  const lk = links.filter((l) => l.country === tab);
  const failedSources = market ? Object.entries(market.errors).filter(([k]) => (tab === "NL" ? k !== "autoscout24_de" : k === "autoscout24_de")) : [];

  // Eigen invoer blijft behouden bij het toepassen of wissen van filters
  const own: Record<string, string> = {};
  if (askingPrice) own.prijs = String(askingPrice);
  if (mileage) own.km = String(mileage);
  if (transmission) own.transmissie = transmission;
  const resetHref = `?${new URLSearchParams({ ...own, yearFrom: "", yearTo: "", kmFrom: "", kmTo: "", pkFrom: "", pkTo: "", priceFrom: "", priceTo: "", body: "alle", fuel: "alle", transmission: "alle" })}#markt`;
  const defaultHref = `?${new URLSearchParams(own)}#markt`;

  return (
    <Card eyebrow="Live markt" title="Marktvergelijking" subtitle="Live advertenties van Marktplaats en AutoScout24. De mediaan vraagprijs bepaalt het marktdeel van het cijfer.">
      <div id="markt" role="tablist" className="mb-4 inline-flex scroll-mt-24 rounded-lg border border-line p-1">
        {(["NL", "DE"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>
            {t === "NL" ? "🇳🇱 Nederland" : "🇩🇪 Duitsland"}
          </button>
        ))}
      </div>

      {market?.failed && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">Advertenties konden niet worden opgehaald: {market.failed}. Het marktdeel van het cijfer telt daarom niet mee.</p>}

      {market && !market.failed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-bg/40 p-4">
            <div className="eyebrow flex items-center gap-2">Mediaan vraagprijs live <ProvBadge p="verified" /></div>
            <BandBlock band={band} country={tab} askingPrice={askingPrice} what={what} />
          </div>
          <div className="rounded-lg border border-line p-4 text-sm">
            <div className="eyebrow">Waarmee is vergeleken</div>
            <ul className="mt-2 space-y-1">
              <li>Bouwjaar: <b>{f?.yearFrom || f?.yearTo ? `${f?.yearFrom ?? "…"} – ${f?.yearTo ?? "…"}` : "alle"}</b></li>
              <li>Vermogen: <b>{f?.pkFrom || f?.pkTo ? `${f?.pkFrom ?? "…"} – ${f?.pkTo ?? "…"} pk` : "alle"}</b></li>
              <li>Vraagprijs: <b>{f?.priceFrom || f?.priceTo ? `${f?.priceFrom ? eur(f.priceFrom) : "…"} – ${f?.priceTo ? eur(f.priceTo) : "…"}` : "alle"}</b></li>
              <li>Transmissie: <b>{f?.transmission ? TR_LABEL[f.transmission] : market.comparedTransmission ? `${TR_LABEL[market.comparedTransmission]} (alleen in de mediaan)` : "alle"}</b></li>
              <li>Brandstof: <b>{f?.fuel ?? "alle"}</b>{f?.body ? <> · Carrosserie: <b>{f.body}</b></> : null}{f?.kmFrom || f?.kmTo ? <> · Km: <b>{f?.kmFrom ?? 0} – {f?.kmTo ?? "…"}</b></> : null}</li>
            </ul>
            {market.reference && <p className="mt-2 text-xs text-muted">Cijfer gebruikt: mediaan van {market.reference.label}.</p>}
          </div>
        </div>
      )}

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
              {importCost.saving > 0 ? `Potentieel voordeel t.o.v. de NL-mediaan: ${eur(importCost.saving)}` : `Import is naar schatting ${eur(-importCost.saving)} duurder dan de NL-mediaan.`}
            </p>
          )}
          <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Aannames importkosten</summary>
            <ul className="mt-1 list-disc pl-5">{importCost.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        </div>
      )}

      {f && (
        <form method="get" action="#markt" className="mt-6 rounded-xl border border-line p-4">
          {Object.entries(own).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Filter vergelijkbare auto&apos;s</h3>
            <span className="flex gap-3 text-xs">
              <a href={defaultHref} className="text-brand underline">Standaardfilters</a>
              <a href={resetHref} className="text-brand underline">Alle filters wissen</a>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-xs text-muted">Bouwjaar van
              <input name="yearFrom" defaultValue={f.yearFrom ?? ""} inputMode="numeric" placeholder="2018" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Bouwjaar tot
              <input name="yearTo" defaultValue={f.yearTo ?? ""} inputMode="numeric" placeholder="2020" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Vermogen van (pk)
              <input name="pkFrom" defaultValue={f.pkFrom ?? ""} inputMode="numeric" placeholder="100" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Vermogen tot (pk)
              <input name="pkTo" defaultValue={f.pkTo ?? ""} inputMode="numeric" placeholder="150" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Prijs van (€)
              <input name="priceFrom" defaultValue={f.priceFrom ?? ""} inputMode="numeric" placeholder="5000" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Prijs tot (€)
              <input name="priceTo" defaultValue={f.priceTo ?? ""} inputMode="numeric" placeholder="15000" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Kilometers van
              <input name="kmFrom" defaultValue={f.kmFrom ?? ""} inputMode="numeric" placeholder="0" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Kilometers tot
              <input name="kmTo" defaultValue={f.kmTo ?? ""} inputMode="numeric" placeholder="100000" className={fieldCls} />
            </label>
            <label className="text-xs text-muted">Transmissie
              <select name="transmission" defaultValue={f.transmission ?? "alle"} className={fieldCls}>
                <option value="alle">Alle</option>
                <option value="handgeschakeld">Handgeschakeld</option>
                <option value="automaat">Automaat</option>
              </select>
            </label>
            <label className="text-xs text-muted">Brandstof
              <select name="fuel" defaultValue={f.fuel ?? "alle"} className={fieldCls}>
                <option value="alle">Alle</option>
                <option value="benzine">Benzine</option>
                <option value="diesel">Diesel</option>
                <option value="hybride">Hybride</option>
                <option value="elektrisch">Elektrisch</option>
              </select>
            </label>
            <label className="text-xs text-muted">Carrosserie
              <select name="body" defaultValue={f.body ?? "alle"} className={fieldCls}>
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
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="rounded-md bg-fg px-4 py-2 text-sm font-semibold text-bg hover:bg-brand hover:text-white">Filter toepassen</button>
            <span className="text-xs text-muted">Standaard: zelfde brandstof{transmission ? " en transmissie" : ""}, bouwjaar ±1, vermogen ±20%. Het cijfer wordt herberekend met de gefilterde auto&apos;s; let op dat een prijsfilter ook de mediaan beïnvloedt.</span>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Vergelijkbare advertenties</h3>
        <span className="text-xs text-muted">Zelfde cijfer-engine als het rapport{tab === "DE" ? "; Duitse prijzen incl. importkosten" : ""}</span>
      </div>

      {failedSources.length > 0 && <p className="mt-3 rounded-lg bg-warn-soft p-3 text-xs text-warn">Niet opgehaald: {failedSources.map(([k, m]) => `${SOURCE_NAMES[k] ?? k} (${m.slice(0, 80)})`).join("; ")}</p>}
      {market && !market.failed && list.length === 0 && (
        <p className="mt-3 text-sm text-muted">Geen advertenties gevonden in {tab === "NL" ? "Nederland" : "Duitsland"} met deze filters.</p>
      )}

      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {list.map((l) => (
            <li key={l.id} className="flex gap-3 py-3">
              <GradeChip grade={l.grade} confidence={l.gradeConfidence} />
              {l.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden h-16 w-24 flex-none rounded-lg object-cover sm:block" /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-brand hover:underline">{l.title} ↗</a>
                  <span className="num font-semibold">{eur(l.price)}</span>
                </div>
                <div className="text-xs text-muted">
                  {l.platform} · {[l.year, l.mileage != null ? `${l.mileage.toLocaleString("nl-NL")} km` : null, l.fuel, l.transmissionGroup ? TR_LABEL[l.transmissionGroup] : l.transmission, l.power, l.location].filter(Boolean).join(" · ")}
                  {l.country === "DE" && <> · <b>≈ {eur(l.effectivePrice)} incl. import</b></>}
                </div>
                <div className="mt-1 text-xs">{l.gradeReasons.join(" · ")}</div>
                {!l.sameAsReport && (
                  <a href={`/auto/${kenteken}?prijs=${l.price}${l.mileage ? `&km=${l.mileage}` : ""}${l.transmissionGroup ? `&transmissie=${l.transmissionGroup}` : ""}`} className="mt-1 inline-block text-xs text-brand hover:underline">Bekijk rapport met deze prijs en km →</a>
                )}
                {l.flags.map((fl) => <div key={fl} className="mt-1 inline-block rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">⚠ {fl}</div>)}
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
      {market && !market.failed && <p className="mt-2 text-xs text-muted">Opgehaald {new Date(market.fetchedAt).toLocaleTimeString("nl-NL")}{market.cached ? " (cache, max. 30 min oud)" : ""}. Bronnen: marktplaats-py en de AutoScout24-techniek uit autoscout24_scraping; niet-officiële koppelingen die kunnen veranderen of worden geblokkeerd. Advertenties zonder bekend vermogen vallen weg als er op vermogen wordt gefilterd.</p>}
    </Card>
  );
}
