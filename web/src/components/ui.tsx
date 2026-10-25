import type { Provenance } from "@/lib/types";

export const eur = (n: number | null | undefined, digits = 0) =>
  n == null ? "–" : n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits });

export function Card({ title, subtitle, eyebrow, children, className = "", id }: { title?: string; subtitle?: string; eyebrow?: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`surface rounded-xl p-5 sm:p-6 ${className}`}>
      {title && (
        <div className="mb-5 border-b border-line pb-4">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

const PROV: Record<Provenance, { label: string; cls: string; title: string }> = {
  verified: { label: "Geverifieerd", cls: "bg-good-soft text-good", title: "Uit een officiële bron (RDW)" },
  estimate: { label: "Schatting", cls: "bg-warn-soft text-warn", title: "Berekend of geschat; geen bronwaarde" },
  unavailable: { label: "Niet beschikbaar", cls: "bg-line text-muted", title: "Niet openbaar beschikbaar" },
  demo: { label: "DEMO", cls: "bg-bad-soft text-bad", title: "Demodata, geen echte advertentie" },
};
export function ProvBadge({ p }: { p: Provenance }) {
  const x = PROV[p];
  return <span title={x.title} className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${x.cls}`}>{x.label}</span>;
}

export function scoreColor(s: number) {
  return s >= 7.5 ? "var(--good)" : s >= 5.5 ? "var(--warn)" : "var(--bad)";
}

export function scoreVerdict(s: number) {
  return s >= 7.5 ? "Goede koop" : s >= 5.5 ? "Voorzichtig" : "Risicovol";
}

/** Cijfer als groot getal met een balk van tien vakjes, zoals op een keuringsformulier. */
export function ScoreGauge({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div role="img" aria-label={`Score ${score.toFixed(1)} van 10: ${scoreVerdict(score)}`} className="w-full">
      <div className="flex items-baseline gap-1">
        <span className="font-display text-7xl font-extrabold leading-none tracking-tighter" style={{ color }}>{score.toFixed(1).replace(".", ",")}</span>
        <span className="num text-lg text-muted">/10</span>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, score - i));
          return (
            <div key={i} className="h-2.5 overflow-hidden rounded-sm bg-line">
              <div className="h-full" style={{ width: `${fill * 100}%`, background: color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Bar({ value, max = 10, color }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color ?? scoreColor(value) }} />
    </div>
  );
}

/**
 * Prijsbalk: laagste–hoogste vraagprijs, de middelste 50% gearceerd, de mediaan als streep en
 * (optioneel) de vraagprijs van de eigen auto als stip. Labels staan in eigen rijen (mediaan boven,
 * eigen prijs onder, uitersten daaronder) en worden aan de randen uitgelijnd zodat niets overlapt.
 */
export function PriceRange({ min, low, median, high, max, mark }: { min: number; low: number; median: number; high: number; max: number; mark?: number }) {
  const lo = Math.min(min, mark ?? min), hi = Math.max(max, mark ?? max);
  const frac = (n: number) => (n - lo) / (hi - lo || 1);
  const pos = (n: number) => `${frac(n) * 100}%`;
  // Label boven een punt: links uitgelijnd bij de linkerrand, rechts bij de rechterrand, anders gecentreerd
  const align = (n: number) => (frac(n) < 0.2 ? "translate-x-0" : frac(n) > 0.8 ? "-translate-x-full" : "-translate-x-1/2");
  const markColor = mark == null ? undefined : mark > high ? "var(--bad)" : mark < low ? "var(--good)" : "var(--fg)";
  return (
    <div className="py-2" role="img" aria-label={`Bandbreedte ${eur(low)} tot ${eur(high)}, mediaan ${eur(median)}${mark != null ? `, vraagprijs ${eur(mark)}` : ""}`}>
      <div className="relative h-5">
        <span className={`num absolute bottom-0 whitespace-nowrap text-[11px] font-semibold text-brand ${align(median)}`} style={{ left: pos(median) }}>mediaan {eur(median)}</span>
      </div>
      <div className="relative mt-1.5 h-3 rounded-full bg-line">
        <div className="absolute inset-y-0 rounded-full" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})`, background: "color-mix(in srgb, var(--brand) 35%, transparent)" }} />
        <div className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-brand" style={{ left: pos(median) }} />
        {mark != null && <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card" style={{ left: pos(mark), background: markColor }} />}
      </div>
      {mark != null && (
        <div className="relative mt-1.5 h-5">
          <span className={`num absolute top-0 whitespace-nowrap text-[11px] font-semibold ${align(mark)}`} style={{ left: pos(mark), color: markColor }}>jouw prijs {eur(mark)}</span>
        </div>
      )}
      <div className="num mt-1 flex justify-between border-t border-dashed border-line pt-1 text-[10px] text-muted"><span>{eur(lo)}</span><span>{eur(hi)}</span></div>
    </div>
  );
}
