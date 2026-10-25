import Link from "next/link";
import { notFound } from "next/navigation";
import Calculator from "@/components/Calculator";
import MarketTabs from "@/components/MarketTabs";
import SearchForm from "@/components/SearchForm";
import SummaryBox from "@/components/SummaryBox";
import { Bar, Card, ProvBadge, ScoreGauge, eur, scoreColor, scoreVerdict } from "@/components/ui";
import { BPM_YEAR, depreciationPct } from "@/lib/engines/bpm";
import { ownershipFacts } from "@/lib/engines/ownership";
import { fmtDuration, registrationHistory } from "@/lib/engines/registration";
import { formatPlate, parseVehicleKey } from "@/lib/plate";
import { loadReport } from "@/lib/report";
import { TRANSMISSION_LABEL } from "@/lib/transmission";

const toneCls = { neutral: "bg-brand", good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;
const riskCls = { high: "bg-bad-soft text-bad", medium: "bg-warn-soft text-warn", low: "bg-brand-soft text-brand" } as const;
const riskLabel = { high: "Hoog risico", medium: "Let op", low: "Info" } as const;
const fmt = (d: string) => new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });

async function VinReport({ vin }: { vin: string }) {
  const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { next: { revalidate: 86400 } }).catch(() => null);
  const d = res?.ok ? ((await res.json()).Results?.[0] as Record<string, string> | undefined) : undefined;
  const rows: [string, string | undefined][] = [
    ["Merk", d?.Make], ["Model", d?.Model], ["Modeljaar", d?.ModelYear], ["Carrosserie", d?.BodyClass],
    ["Brandstof", d?.FuelTypePrimary], ["Cilinderinhoud (l)", d?.DisplacementL], ["Fabrikant", d?.Manufacturer], ["Productieland", d?.PlantCountry],
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card title={`VIN ${vin}`} subtitle="Beperkte VIN-decodering (NHTSA vPIC)">
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line py-1 text-sm"><dt className="text-muted">{k}</dt><dd>{v ? v : <ProvBadge p="unavailable" />}</dd></div>
          ))}
        </dl>
        <p className="mt-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          De RDW biedt in de open data geen opzoeking op VIN, dus APK-historie, tellerstand, BPM en kosten kunnen alleen op basis van het kenteken worden getoond. De NHTSA-decodering is gericht op de Amerikaanse markt en kan voor Europese auto&apos;s onvolledig zijn.
        </p>
        <div className="mt-4"><SearchForm compact /></div>
      </Card>
    </div>
  );
}

export default async function ReportPage({ params, searchParams }: PageProps<"/auto/[kenteken]">) {
  const { kenteken } = await params;
  const sp = await searchParams;
  const key = parseVehicleKey(decodeURIComponent(kenteken));
  if (!key) notFound();
  if (key.kind === "vin") return <VinReport vin={key.value} />;

  const get = (name: string) => { const x = sp[name]; return (Array.isArray(x) ? x[0] : x) ?? null; };

  let loaded;
  try { loaded = await loadReport(key.value, get); } catch {
    return (
      <div className="mx-auto max-w-xl px-4 py-16"><Card title="RDW tijdelijk niet bereikbaar"><p className="text-sm">De RDW Open Data gaf een fout terug. Probeer het over een moment opnieuw.</p><div className="mt-4"><SearchForm compact /></div></Card></div>
    );
  }
  if (!loaded) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16"><Card title="Kenteken niet gevonden"><p className="mb-4 text-sm">Het kenteken <b>{formatPlate(key.value)}</b> komt niet voor in de open data van de RDW. Controleer het kenteken (let op 0 en O) en probeer opnieuw.</p><SearchForm compact /></Card></div>
    );
  }

  const r = loaded.report;
  const { bundle, score } = r;
  const v = bundle.vehicle;
  const { askingPrice: price, mileage: km, transmission } = r.input;
  // Samenvatting met dezelfde invoer en vergelijkingsfilters als dit rapport
  const summaryQuery = new URLSearchParams({ ...Object.fromEntries(Object.keys(sp).map((k) => [k, get(k) ?? ""])), kenteken: v.kenteken }).toString();
  const reg = registrationHistory(v);
  const specRow: [string, string | null][] = [
    ["Bouwjaar", v.bouwjaar ? String(v.bouwjaar) : null],
    ["Brandstof", v.brandstoffen.join(" / ") || null],
    ["Vermogen", v.vermogenKw ? `${Math.round(v.vermogenKw * 1.35962)} pk` : null],
    ["Transmissie", transmission ? TRANSMISSION_LABEL[transmission] : null],
    ...(price ? [["Vraagprijs", eur(price)] as [string, string]] : []),
    ...(km ? [["Kilometerstand", `${km.toLocaleString("nl-NL")} km`] as [string, string]] : []),
    ["Uitvoering", v.uitvoering],
    ["Kleur", v.kleur],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Kop */}
      <div className="surface rise grid overflow-hidden rounded-xl lg:grid-cols-[1fr_340px]">
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="plate inline-block px-4 py-1 text-xl">{formatPlate(v.kenteken)}</span>
            <span className="eyebrow">Kentekenrapport · {new Date(bundle.fetchedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-none sm:text-5xl">{v.merk} <span className="text-muted">{v.model}</span></h1>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {specRow.map(([k, val]) => (
              <div key={k} className="min-w-0"><dt className="eyebrow">{k}</dt><dd className="num mt-0.5 text-sm font-medium break-all">{val ?? <span className="text-muted">–</span>}</dd></div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-wider">
            <span className="rounded bg-good-soft px-2 py-1 text-good">RDW live</span>
            <span className="rounded bg-line px-2 py-1 text-muted">{loaded.cached ? "uit cache" : "zojuist opgehaald"}</span>
            {v.apkVervaldatum && <span className={`rounded px-2 py-1 ${new Date(v.apkVervaldatum) < new Date() ? "bg-bad-soft text-bad" : "bg-brand-soft text-brand"}`}>APK t/m {fmt(v.apkVervaldatum)}</span>}
            {bundle.odometer.verdict !== "Onbekend" && <span className={`rounded px-2 py-1 ${bundle.odometer.verdict === "Logisch" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>Teller {bundle.odometer.verdict.toLowerCase()}</span>}
          </div>
          <details className="mt-5 text-sm"><summary className="cursor-pointer font-medium text-brand">Vraagprijs, kilometerstand of transmissie aanpassen</summary>
            <form method="get" className="mt-3 flex flex-wrap gap-2">
              <input name="prijs" defaultValue={price} placeholder="Vraagprijs €" inputMode="numeric" className="w-36 rounded-md border border-line bg-bg px-3 py-2" />
              <input name="km" defaultValue={km} placeholder="Kilometerstand" inputMode="numeric" className="w-40 rounded-md border border-line bg-bg px-3 py-2" />
              {!v.isElektrisch && (
                <select name="transmissie" defaultValue={transmission ?? ""} aria-label="Transmissie" className="rounded-md border border-line bg-bg px-3 py-2">
                  <option value="">Transmissie onbekend</option>
                  <option value="handgeschakeld">Handgeschakeld</option>
                  <option value="automaat">Automaat</option>
                </select>
              )}
              <button className="rounded-md bg-fg px-4 py-2 font-semibold text-bg hover:bg-brand hover:text-white">Herbereken</button>
            </form>
          </details>
        </div>
        <div className="flex flex-col justify-between gap-5 border-t border-line bg-bg/60 p-5 sm:p-7 lg:border-t-0 lg:border-l">
          <div>
            <div className="eyebrow mb-2">Eindoordeel</div>
            <ScoreGauge score={score.overall} />
            <div className="mt-3 font-display text-xl font-bold" style={{ color: scoreColor(score.overall) }}>{scoreVerdict(score.overall)}</div>
            <div className="text-xs text-muted">Zekerheid: {score.confidenceLabel.toLowerCase()} ({Math.round(score.confidence * 100)}% van de weging onderbouwd)</div>
          </div>
          {r.market?.reference && (
            <a href="#markt" className="block rounded-lg border border-line bg-card p-3 text-sm hover:border-brand">
              <div className="eyebrow">Mediaan vergelijkbare auto&apos;s</div>
              <div className="num mt-1 text-2xl font-semibold">{eur(r.market.reference.median)}</div>
              <div className="num text-xs text-muted">{eur(r.market.reference.low)} – {eur(r.market.reference.high)} · {r.market.reference.count} advertenties →</div>
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Samenvatting" className="lg:col-span-2"><SummaryBox query={summaryQuery} /></Card>
        <Card title="Belangrijkste risico's">
          {score.risks.length === 0 ? <p className="text-sm text-muted">Geen rode vlaggen gevonden in de beschikbare data. Dat is geen garantie: schade en eigenaarshistorie zijn niet openbaar.</p> : (
            <ul className="space-y-2">{score.risks.map((x) => <li key={x.text} className={`rounded-lg p-2 text-sm ${riskCls[x.level]}`}><b>{riskLabel[x.level]}:</b> {x.text}</li>)}</ul>
          )}
        </Card>
      </div>

      {/* Score */}
      <Card title="Uitleg van de score" subtitle="Onderdelen zonder data tellen niet mee in het cijfer; ze verlagen alleen de zekerheid.">
        <div className="grid gap-4 md:grid-cols-2">
          {score.components.map((c) => (
            <div key={c.id} className="rounded-lg border border-line bg-bg/40 p-4">
              <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">{c.label}</span><span className="eyebrow whitespace-nowrap">weging {Math.round(c.weight * 100)}%</span></div>
              {c.score != null ? (<div className="mt-3 flex items-center gap-3"><div className="flex-1"><Bar value={c.score} /></div><b className="num text-lg" style={{ color: scoreColor(c.score) }}>{c.score.toFixed(1)}</b></div>) : <div className="mt-3"><ProvBadge p="unavailable" /> <span className="text-xs text-muted">niet beoordeeld</span></div>}
              <ul className="mt-2 list-disc pl-5 text-xs text-muted">{c.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <h3 className="mt-5 font-semibold">Controleer voor aankoop</h3>
        <ul className="mt-1 list-disc pl-5 text-sm">{score.checks.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>

      {/* Specificaties */}
      <Card title="Technische specificaties" subtitle="Klik een categorie open">
        <div className="space-y-2">
          {r.specs.map((cat, idx) => (
            <details key={cat.id} open={idx === 0} className="group rounded-xl border border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
                {cat.title}<span className="text-muted transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="border-t border-line px-4 py-2">
                <dl>{cat.items.map((it) => (
                  <div key={it.label} className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5 text-sm last:border-0">
                    <dt className="text-muted">{it.label}</dt>
                    <dd className="text-right">{it.value ?? <ProvBadge p="unavailable" />}</dd>
                  </div>))}</dl>
                {cat.note && <p className="mt-2 rounded-lg bg-brand-soft p-2 text-xs">{cat.note}</p>}
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Card title="Registratie- & houderhistorie" subtitle="Alleen wat RDW openbaar maakt: de eerste toelating, eerste en laatste tenaamstelling. Duur is berekend uit die datums.">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft p-3">
          <div>
            <div className="text-sm font-semibold">Aantal eigenaren</div>
            <div className="text-xs text-muted">Het exacte aantal is niet openbaar bij RDW. Dit is een ondergrens, afgeleid uit de tenaamstellingsdatums.</div>
          </div>
          <span className="flex items-center gap-2">
            <span className="text-lg font-extrabold">{reg.minKeepers == null ? "Onbekend" : reg.minKeepers === 1 ? "1 (nog geen overdracht gezien)" : `minimaal ${reg.minKeepers}`}</span>
            <ProvBadge p={reg.minKeepers == null ? "unavailable" : "estimate"} />
          </span>
        </div>
        <ol className="space-y-3">
          {reg.periods.map((p) => (
            <li key={p.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="flex items-center gap-2"><span className="text-sm font-bold tabular-nums">{fmtDuration(p.days)}</span><ProvBadge p={p.provenance} /></span>
              </div>
              <div className="text-xs text-muted">{p.from ? fmt(p.from) : "?"} → {p.to ? fmt(p.to) : "heden"}</div>
              <p className="mt-1 text-xs text-muted">{p.note}</p>
            </li>
          ))}
          {reg.periods.length === 0 && <li className="text-sm text-muted">RDW geeft voor dit voertuig geen tenaamstellingsdatums.</li>}
        </ol>
        <h3 className="mt-5 text-sm font-semibold">Niet openbaar beschikbaar</h3>
        <ul className="mt-2 divide-y divide-line">
          {reg.unavailable.map((u) => (
            <li key={u.label} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div><div className="text-sm">{u.label}</div><div className="text-xs text-muted">{u.reason}</div></div>
              <ProvBadge p="unavailable" />
            </li>
          ))}
        </ul>
      </Card>

      {/* Historie */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tijdlijn" subtitle="Gebeurtenissen uit het RDW-register">
          <ol className="relative ml-2 border-l border-line">
            {r.timeline.map((e, i) => (
              <li key={i} className="mb-4 ml-4">
                <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${toneCls[e.tone]}`} />
                <div className="text-xs text-muted">{fmt(e.date)}</div>
                <div className="text-sm font-semibold">{e.title}</div>
                {e.detail && <div className="text-xs text-muted">{e.detail}</div>}
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card title="Kilometerstand" subtitle="Nationale Autopas via RDW">
            <p className="text-sm">{bundle.odometer.explanation}</p>
            {bundle.odometer.lastYear && <p className="mt-2 text-sm text-muted">Laatste registratie: {bundle.odometer.lastYear}. De werkelijke kilometerstanden zijn niet openbaar; vraag een NAP-rapport.</p>}
            <p className="mt-2 text-xs text-muted">Kilometerreeks/-grafiek: <ProvBadge p="unavailable" /></p>
          </Card>
          <Card title="Terugroepacties">
            {bundle.recalls.length === 0 ? <p className="text-sm text-muted">Geen terugroepacties geregistreerd.</p> : (
              <ul className="space-y-1 text-sm">{bundle.recalls.map((x) => <li key={x.code} className="flex justify-between gap-2"><span>{x.code}</span><span className={x.statusCode === "P" || x.statusCode === "R" ? "text-good" : "text-bad"}>{x.status}</span></li>)}</ul>
            )}
          </Card>
          <Card title="Schade, eigenaren & advertentiehistorie">
            <ul className="space-y-1 text-sm">
              {["Schade- en ongevalhistorie", "Eerdere houders (aantal en periode)", "Historische advertenties en prijswijzigingen"].map((t) => <li key={t} className="flex items-center justify-between gap-2">{t}<ProvBadge p="unavailable" /></li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Niet openbaar. Beschikbaar via gelicentieerde providers (Carvertical, AutoDNA e.d.); zie docs/DATA_SOURCES.md.</p>
          </Card>
        </div>
      </div>

      <Card title="APK-historie" subtitle="Keuringsmeldingen en geconstateerde gebreken (RDW)">
        {bundle.inspections.length === 0 ? <p className="text-sm text-muted">Geen APK-meldingen gevonden (de auto is mogelijk nog niet keuringsplichtig).</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Datum</th><th>Type</th><th>Geldig tot</th><th>Gebreken</th></tr></thead>
            <tbody>{bundle.inspections.map((i, idx) => (
              <tr key={idx} className="border-t border-line align-top">
                <td className="py-2 whitespace-nowrap">{fmt(i.date)}</td><td>{i.type}</td><td className="whitespace-nowrap">{i.expires ? fmt(i.expires) : "–"}</td>
                <td>{i.defects.length === 0 ? <span className="text-good">Geen</span> : <ul className="list-disc pl-4">{i.defects.map((d, k) => <li key={k}>{d.description} <span className="text-xs text-muted">({d.code}{d.count > 1 ? `, ${d.count}×` : ""})</span></li>)}</ul>}</td>
              </tr>))}</tbody></table></div>
        )}
      </Card>

      <MarketTabs kenteken={v.kenteken} market={r.market} importCost={r.importCost} links={r.links} askingPrice={price} mileage={km} transmission={transmission} />

      {/* BPM */}
      <Card title="BPM" subtitle="Aanschafbelasting: wat er werkelijk is betaald, volgens het RDW-register">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-brand-soft p-4">
            <div className="flex items-center gap-2 text-sm text-muted">Betaalde bruto BPM (eerste registratie) {r.bpm.paid != null ? <ProvBadge p="verified" /> : <ProvBadge p="unavailable" />}</div>
            <div className="mt-1 text-3xl font-extrabold">{r.bpm.paid != null ? eur(r.bpm.paid) : "–"}</div>
            <div className="text-xs text-muted">{r.bpm.paid != null ? `Vastgesteld bij eerste toelating in ${v.bouwjaar ?? "onbekend jaar"}, volgens de tarieven van dat jaar.` : "Niet geregistreerd in het kentekenregister."}</div>
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-2 text-sm text-muted">Restant-BPM nu (indicatie) <ProvBadge p="estimate" /></div>
            <div className="mt-1 text-3xl font-extrabold">{r.bpm.paidRemaining != null ? eur(r.bpm.paidRemaining) : "–"}</div>
            <div className="text-xs text-muted">Betaalde BPM minus {Math.round(depreciationPct(r.bpm.ageMonths) * 100)}% afschrijving na {Math.round(r.bpm.ageMonths / 12 * 10) / 10} jaar; wat in de koopprijs &quot;zit&quot;.</div>
          </div>
        </div>
        {r.bpm.tariff && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">Ter vergelijking: BPM volgens de huidige tarieven (alleen relevant voor import) <ProvBadge p="estimate" /></summary>
            <table className="mt-2 w-full text-sm"><tbody>
              {r.bpm.tariff.steps.map((s) => <tr key={s.label} className="border-b border-line"><td className="py-1.5 text-muted">{s.label}</td><td className="text-right tabular-nums">{eur(s.amount)}</td></tr>)}
              <tr className="border-b border-line font-semibold"><td className="py-1.5">Bruto BPM nieuw, tarieven {BPM_YEAR}</td><td className="text-right tabular-nums">{eur(r.bpm.tariff.grossBpm)}</td></tr>
              <tr className="font-bold"><td className="py-2">Na afschrijving ({Math.round(r.bpm.tariff.depreciationPct * 100)}%)</td><td className="text-right tabular-nums">{eur(r.bpm.tariff.netBpm)}</td></tr>
            </tbody></table>
          </details>
        )}
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">{r.bpm.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </Card>

      {r.marketValue == null && <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">Er zijn te weinig vergelijkbare advertenties voor een marktwaarde. Voor verzekering en waardevermindering is een generieke referentiewaarde van € {r.ownInputs.currentValue.toLocaleString("nl-NL")} gebruikt, gebaseerd op leeftijd. Pas de kosten daarom niet te letterlijk toe.</p>}
      <Calculator facts={ownershipFacts(v)} defaults={r.ownInputs} />

      <Card title="Bronnen & beperkingen">
        <ul className="space-y-1 text-sm">{r.sources.map((s) => <li key={s.id}>{s.url ? <a className="text-brand underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}{s.note ? <span className="text-muted"> – {s.note}</span> : null}</li>)}</ul>
        <p className="mt-3 text-xs text-muted">Opgehaald: {new Date(bundle.fetchedAt).toLocaleString("nl-NL")}. Dit rapport is geen taxatie of garantie. <Link href="/" className="text-brand underline">Nieuw kenteken zoeken</Link></p>
      </Card>
    </div>
  );
}
