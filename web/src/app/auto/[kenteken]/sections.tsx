import Calculator from "@/components/Calculator";
import MarketTabs from "@/components/MarketTabs";
import { Bar, Card, ProvBadge, ScoreGauge, eur, scoreColor, scoreVerdict } from "@/components/ui";
import { ownershipFacts } from "@/lib/engines/ownership";
import type { Report } from "@/lib/report";

/*
 * Delen van het rapport die op de live advertenties wachten. De pagina rendert eerst alles uit het RDW-register
 * en streamt deze secties erin zodra de marktdata binnen is (elk in een eigen <Suspense>, met dezelfde promise).
 */
type P = { report: Promise<Report> };

const riskCls = { high: "bg-bad-soft text-bad", medium: "bg-warn-soft text-warn", low: "bg-brand-soft text-brand" } as const;
const riskLabel = { high: "Hoog risico", medium: "Let op", low: "Info" } as const;

const Pulse = ({ className }: { className: string }) => <div className={`animate-pulse rounded bg-line ${className}`} />;

export async function Verdict({ report }: P) {
  const r = await report;
  const { score } = r;
  const km = r.input.mileage;
  const ref = r.market?.reference;
  return (
    <>
      <div>
        <div className="eyebrow mb-2">Eindoordeel</div>
        <ScoreGauge score={score.overall} />
        <div className="mt-3 font-display text-xl font-bold" style={{ color: scoreColor(score.overall) }}>{scoreVerdict(score.overall)}</div>
        <div className="text-xs text-muted">Zekerheid: {score.confidenceLabel.toLowerCase()} ({Math.round(score.confidence * 100)}% van de weging onderbouwd)</div>
      </div>
      {ref && (
        <a href="#markt" className="block rounded-lg border border-line bg-card p-3 text-sm hover:border-brand">
          {r.fair && km ? (
            <>
              <div className="eyebrow">Eerlijke prijs voor {km.toLocaleString("nl-NL")} km</div>
              <div className="num mt-1 text-2xl font-semibold">{eur(r.fair.mid)}</div>
              <div className="num text-xs text-muted">{eur(r.fair.low)} – {eur(r.fair.high)}{r.fair.source === "DE" ? " · DE incl. import" : ""}</div>
              <div className="num mt-2 border-t border-line pt-2 text-xs text-muted">Mediaan {eur(ref.median)} · {ref.count} advertenties →</div>
            </>
          ) : (
            <>
              <div className="eyebrow">Mediaan vergelijkbare auto&apos;s</div>
              <div className="num mt-1 text-2xl font-semibold">{eur(ref.median)}</div>
              <div className="num text-xs text-muted">{eur(ref.low)} – {eur(ref.high)} · {ref.count} advertenties →</div>
            </>
          )}
        </a>
      )}
    </>
  );
}

export function VerdictSkeleton() {
  return (
    <div aria-busy="true">
      <div className="eyebrow mb-2">Eindoordeel</div>
      <Pulse className="h-16 w-36" />
      <div className="mt-3 grid grid-cols-10 gap-1">{Array.from({ length: 10 }, (_, i) => <Pulse key={i} className="h-2.5" />)}</div>
      <p className="mt-4 text-xs text-muted">Cijfer berekenen: vergelijkbare advertenties ophalen bij Marktplaats en AutoScout24…</p>
    </div>
  );
}

export async function Risks({ report }: P) {
  const { score } = await report;
  return score.risks.length === 0 ? (
    <p className="text-sm text-muted">Geen rode vlaggen gevonden in de beschikbare data. Dat is geen garantie: schade en eigenaarshistorie zijn niet openbaar.</p>
  ) : (
    <ul className="space-y-2">{score.risks.map((x) => <li key={x.text} className={`rounded-lg p-2 text-sm ${riskCls[x.level]}`}><b>{riskLabel[x.level]}:</b> {x.text}</li>)}</ul>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: rows }, (_, i) => <Pulse key={i} className="h-10" />)}</div>;
}

export async function ScoreExplanation({ report }: P) {
  const { score } = await report;
  return (
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
  );
}

export function CardSkeleton({ title, note }: { title: string; note?: string }) {
  return (
    <Card title={title}>
      <div aria-busy="true" className="space-y-3">
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        {note && <p className="eyebrow">{note}</p>}
      </div>
    </Card>
  );
}

export async function Market({ report }: P) {
  const r = await report;
  return <MarketTabs kenteken={r.bundle.vehicle.kenteken} market={r.market} importCost={r.importCost} links={r.links} askingPrice={r.input.askingPrice} mileage={r.input.mileage} transmission={r.input.transmission} fair={r.fair} />;
}

export async function Costs({ report }: P) {
  const r = await report;
  return (
    <>
      {r.marketValue == null && <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">Er zijn te weinig vergelijkbare advertenties voor een marktwaarde. Voor verzekering en waardevermindering is een generieke referentiewaarde van € {r.ownInputs.currentValue.toLocaleString("nl-NL")} gebruikt, gebaseerd op leeftijd. Pas de kosten daarom niet te letterlijk toe.</p>}
      <Calculator facts={ownershipFacts(r.bundle.vehicle)} defaults={r.ownInputs} />
    </>
  );
}
