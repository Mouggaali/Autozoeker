import type { Provenance } from "@/lib/types";

export const eur = (n: number | null | undefined, digits = 0) =>
  n == null ? "–" : n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits });

export function Card({ title, subtitle, children, className = "", id }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl border border-line bg-card p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
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
  return <span title={x.title} className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.cls}`}>{x.label}</span>;
}

export function scoreColor(s: number) {
  return s >= 7.5 ? "var(--good)" : s >= 5.5 ? "var(--warn)" : "var(--bad)";
}

export function ScoreGauge({ score, size = 150 }: { score: number; size?: number }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const frac = (score - 1) / 9;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score.toFixed(1)} van 10`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.26} fontWeight="800" fill="var(--fg)">{score.toFixed(1)}</text>
      <text x="50%" y={size * 0.68} textAnchor="middle" fontSize={size * 0.09} fill="var(--muted)">van 10</text>
    </svg>
  );
}

export function Bar({ value, max = 10, color }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color ?? scoreColor(value) }} />
    </div>
  );
}

export function LineChart({ points, xLabel, yFormat, marker }: { points: { x: number; y: number }[]; xLabel: string; yFormat: (n: number) => string; marker?: { x: number; y: number; label: string } }) {
  const W = 560, H = 220, P = { l: 56, r: 12, t: 12, b: 32 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys) * 1.05;
  const sx = (x: number) => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - (y / (y1 || 1)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => t * y1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafiek">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
          <text x={P.l - 6} y={sy(t)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--muted)">{yFormat(t)}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" />
      {points.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p.x} x={sx(p.x)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.x}</text>
      ))}
      <text x={W - P.r} y={H - 0} textAnchor="end" fontSize="10" fill="var(--muted)">{xLabel}</text>
      {marker && (
        <g>
          <circle cx={sx(marker.x)} cy={sy(marker.y)} r="6" fill="var(--bad)" stroke="var(--card)" strokeWidth="2" />
          <text x={sx(marker.x) + 10} y={sy(marker.y) - 8} fontSize="11" fontWeight="700" fill="var(--fg)">{marker.label}</text>
        </g>
      )}
    </svg>
  );
}
