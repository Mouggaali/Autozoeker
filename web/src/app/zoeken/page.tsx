import Link from "next/link";
import { Suspense } from "react";
import { eur, scoreColor } from "@/components/ui";
import { type Deal, type DealSearch, findDeals } from "@/lib/deals";
import { kmEffect } from "@/lib/engines/fairPrice";
import { MAKES } from "@/lib/makes";
import { formatPlate } from "@/lib/plate";
import type { FuelGroup, TransmissionGroup } from "@/lib/types";

export const metadata = { title: "Deals zoeken op model – AutoZoeker" };
export const maxDuration = 60;

const FUELS: FuelGroup[] = ["benzine", "diesel", "hybride", "elektrisch"];
const num = (x: string | undefined) => { const n = Number((x ?? "").replace(/\D/g, "")); return n > 0 ? n : null; };

export default async function DealsPage({ searchParams }: PageProps<"/zoeken">) {
  const sp = await searchParams;
  const get = (n: string) => { const x = sp[n]; return (Array.isArray(x) ? x[0] : x)?.trim() ?? ""; };
  const s: DealSearch = {
    make: get("merk"),
    model: get("model"),
    yearFrom: num(get("van")),
    yearTo: num(get("tot")),
    fuel: FUELS.includes(get("brandstof") as FuelGroup) ? (get("brandstof") as FuelGroup) : null,
    transmission: get("transmissie") === "automaat" || get("transmissie") === "handgeschakeld" ? (get("transmissie") as TransmissionGroup) : null,
    priceTo: num(get("maxprijs")),
    kmTo: num(get("maxkm")),
  };
  const ready = s.make.length > 1 && s.model.length > 0;
  const field = "field-in mt-1.5 w-full rounded-xl px-3 py-2 text-sm normal-case tracking-normal";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div>
        <div className="eyebrow">Deal-finder</div>
        <h1 className="mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)] leading-tight font-semibold tracking-[-0.04em]">Zoek de beste koop op model</h1>
        <p className="mt-2 max-w-[62ch] text-muted">Geen kenteken nodig. Alle Nederlandse advertenties krijgen een eerlijke prijs voor hun bouwjaar en km-stand; de vijf beste deals checken we direct bij de RDW.</p>
      </div>

      <form method="get" className="surface grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6">
        <label className="eyebrow">Merk
          <select name="merk" defaultValue={s.make} required className={field}>
            <option value="">Kies…</option>
            {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="eyebrow">Model
          <input name="model" defaultValue={s.model} required placeholder="bijv. 308, Golf, i3" className={field} />
        </label>
        <label className="eyebrow">Bouwjaar van
          <input name="van" defaultValue={s.yearFrom ?? ""} inputMode="numeric" placeholder="2016" className={field} />
        </label>
        <label className="eyebrow">Bouwjaar tot
          <input name="tot" defaultValue={s.yearTo ?? ""} inputMode="numeric" placeholder="2019" className={field} />
        </label>
        <label className="eyebrow">Brandstof
          <select name="brandstof" defaultValue={s.fuel ?? ""} className={field}>
            <option value="">Alle</option>
            {FUELS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
          </select>
        </label>
        <label className="eyebrow">Transmissie
          <select name="transmissie" defaultValue={s.transmission ?? ""} className={field}>
            <option value="">Alle</option>
            <option value="handgeschakeld">Handgeschakeld</option>
            <option value="automaat">Automaat</option>
          </select>
        </label>
        <label className="eyebrow">Max. prijs (€)
          <input name="maxprijs" defaultValue={s.priceTo ?? ""} inputMode="numeric" placeholder="15000" className={field} />
        </label>
        <label className="eyebrow">Max. km
          <input name="maxkm" defaultValue={s.kmTo ?? ""} inputMode="numeric" placeholder="150000" className={field} />
        </label>
        <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-4">
          <button className="btn-primary px-6 py-2.5">Zoek deals →</button>
          <span className="text-xs text-muted">Bronnen: Marktplaats en AutoScout24.nl. Hoe smaller de zoekopdracht (bouwjaar, brandstof, transmissie), hoe eerlijker de vergelijking.</span>
        </div>
      </form>

      {ready && <Suspense key={JSON.stringify(s)} fallback={<Skeleton />}><Results search={s} /></Suspense>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="surface space-y-3 p-6" aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-line" />)}
      <p className="eyebrow text-center">Advertenties ophalen en de beste vijf bij de RDW checken…</p>
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

async function Results({ search }: { search: DealSearch }) {
  let r;
  try { r = await findDeals(search); } catch (e) {
    return <p className="surface p-5 text-sm text-bad">Advertenties konden niet worden opgehaald: {e instanceof Error ? e.message : "onbekende fout"}.</p>;
  }
  const errs = Object.entries(r.errors);
  if (r.deals.length === 0) {
    return <p className="surface p-5 text-sm text-muted">Geen advertenties gevonden voor {search.make} {search.model} met deze filters.{errs.length ? ` (${errs.map(([k, m]) => `${k}: ${m.slice(0, 60)}`).join("; ")})` : ""}</p>;
  }
  const shown = r.deals.slice(0, 40);

  return (
    <div className="space-y-4">
      <div className="well grid gap-2 p-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-6 sm:p-5">
        <div className="eyebrow pt-0.5">Eerlijke prijs</div>
        <p>
          {r.model
            ? <>Berekend uit {r.model.n} advertenties (R² {r.model.r2.toFixed(2).replace(".", ",")}): elk jaar ouder scheelt ongeveer <b>{pct(1 - Math.exp(r.model.b))}</b>, elke 10.000 km extra ongeveer <b>{pct(kmEffect(r.model))}</b>.</>
            : <>Te weinig of te gespreide advertenties voor een model; vergeleken met de mediaan per bouwjaar{r.band ? ` (overall ${eur(r.band.median)})` : ""}.</>}
          {r.excluded > 0 && <span className="text-muted"> {r.excluded} advertentie{r.excluded === 1 ? "" : "s"} niet meegeteld (schade, dubbel of uitschieter).</span>}
          {errs.length > 0 && <span className="text-warn"> Niet opgehaald: {errs.map(([k]) => k).join(", ")}.</span>}
        </p>
      </div>
      <ul className="surface rows p-2 sm:p-3">
        {shown.map((d, i) => <DealRow key={d.id} d={d} rank={i + 1} />)}
      </ul>
      {r.deals.length > shown.length && <p className="text-center text-xs text-muted">{r.deals.length - shown.length} advertenties met minder korting niet getoond.</p>}
    </div>
  );
}

function DealRow({ d, rank }: { d: Deal; rank: number }) {
  const c = d.check && "kenteken" in d.check ? d.check : null;
  const err = d.check && "error" in d.check ? d.check.error : null;
  const reportHref = c ? `/auto/${c.kenteken}?${new URLSearchParams(Object.entries({ prijs: String(d.price), km: d.mileage ? String(d.mileage) : "", transmissie: d.transmissionGroup ?? "" }).filter(([, x]) => x))}` : null;
  return (
    <li data-light-hover="market" className={`row-hit flex gap-3 px-3 py-3.5 sm:gap-4 sm:px-4 ${d.excluded ? "opacity-60" : ""}`}>
      <span className="num w-6 flex-none pt-0.5 text-right text-sm text-muted">{rank}</span>
      {d.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={d.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden h-16 w-24 flex-none rounded-xl object-cover sm:block" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold hover:text-brand">{d.title} ↗</a>
          <span className="num font-semibold">{eur(d.price)}</span>
        </div>
        <div className="text-xs text-muted">{d.platform} · {[d.year, d.mileage != null ? `${d.mileage.toLocaleString("nl-NL")} km` : null, d.transmissionGroup, d.power, d.location].filter(Boolean).join(" · ")}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          {d.gap != null && d.fair != null && (
            <span className={`rounded-full px-2 py-0.5 font-semibold ${d.gap <= 0 ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
              {eur(Math.abs(d.gap))} {d.gap <= 0 ? "onder" : "boven"} eerlijke prijs ({eur(d.fair)})
            </span>
          )}
          {d.excluded && <span className="rounded-full bg-line px-2 py-0.5 text-muted">{d.excluded}</span>}
          {c && (
            <>
              <span className="plate px-1.5 py-0 text-[11px]" style={{ borderLeftWidth: 8 }}>{formatPlate(c.kenteken)}</span>
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: "var(--well)", color: scoreColor(c.score) }}>cijfer {c.score.toFixed(1).replace(".", ",")}</span>
              {c.apkDefects > 0 && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">{c.apkDefects} APK-gebrek{c.apkDefects === 1 ? "" : "en"}</span>}
              {c.openRecalls > 0 && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-bad">{c.openRecalls} open terugroepactie{c.openRecalls === 1 ? "" : "s"}</span>}
              {c.blocked && <span className="rounded-full bg-bad-soft px-2 py-0.5 font-semibold text-bad">kenteken geblokkeerd</span>}
              {c.imported && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">import</span>}
              {c.odometer === "Onlogisch" && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-bad">teller onlogisch</span>}
              {c.issues.map((x) => <span key={x} className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">{x}</span>)}
              <Link href={reportHref!} className="font-semibold text-brand hover:underline">Volledig rapport →</Link>
            </>
          )}
          {err && <span className="text-muted">RDW-check: {err}</span>}
        </div>
      </div>
    </li>
  );
}
