import Link from "next/link";
import { Suspense } from "react";
import { ScoreLights } from "@/components/World";
import { Bar, eur, scoreColor, scoreVerdict } from "@/components/ui";
import { LIGHTS } from "@/lib/lights";
import { formatPlate, parseVehicleKey } from "@/lib/plate";
import { type Report, loadReport } from "@/lib/report";

export const metadata = { title: "Auto's vergelijken – AutoZoeker" };
export const maxDuration = 60;

type Car = { kenteken: string; prijs: string; km: string; tr: string };
type Loaded = { car: Car; report: Report | null; error?: string };

/** ?k=NL260L,G001BB&prijs=8500,&km=120000, of herhaalde velden (k=..&k=..) uit het formulier hieronder. */
function parseCars(sp: Record<string, string | string[] | undefined>): Car[] {
  const list = (n: string) => { const x = sp[n]; return (Array.isArray(x) ? x : (x ?? "").split(",")).map((s) => s.trim()); };
  const k = list("k"), p = list("prijs"), km = list("km"), tr = list("transmissie");
  return k.slice(0, 3).map((x, i) => ({
    kenteken: x, prijs: (p[i] ?? "").replace(/\D/g, ""), km: (km[i] ?? "").replace(/\D/g, ""),
    tr: tr[i] === "automaat" || tr[i] === "handgeschakeld" ? tr[i] : "",
  }));
}

export default async function ComparePage({ searchParams }: PageProps<"/vergelijk">) {
  const cars = parseCars(await searchParams);
  const valid = cars.filter((c) => parseVehicleKey(c.kenteken)?.kind === "plate");
  const rows = [0, 1, 2].map((i) => cars[i] ?? { kenteken: "", prijs: "", km: "", tr: "" });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div>
        <div className="eyebrow">Vergelijken</div>
        <h1 className="mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)] leading-tight font-semibold tracking-[-0.04em]">Welke auto wint?</h1>
        <p className="mt-2 max-w-[60ch] text-muted">Twee of drie kentekens naast elkaar: het cijfer per onderdeel, de prijs tegenover de markt, maandkosten en risico&apos;s. Wijs een rij aan en het licht kleurt naar de beste auto.</p>
      </div>

      <form method="get" className="surface grid gap-3 p-4 sm:p-6">
        {rows.map((c, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <input name="k" defaultValue={c.kenteken} placeholder={i < 2 ? `Kenteken ${i + 1}` : "Kenteken 3 (optioneel)"} aria-label={`Kenteken ${i + 1}`}
              className="plate col-span-3 px-3 py-2 text-center text-lg placeholder:text-black/35 sm:col-span-1" />
            <input name="prijs" defaultValue={c.prijs} inputMode="numeric" placeholder="Vraagprijs €" aria-label={`Vraagprijs ${i + 1}`} className="field-in rounded-xl px-3 py-2 text-sm" />
            <input name="km" defaultValue={c.km} inputMode="numeric" placeholder="Km-stand" aria-label={`Kilometerstand ${i + 1}`} className="field-in rounded-xl px-3 py-2 text-sm" />
            <select name="transmissie" defaultValue={c.tr} aria-label={`Transmissie ${i + 1}`} className="field-in rounded-xl px-2 py-2 text-sm">
              <option value="">Transmissie?</option>
              <option value="handgeschakeld">Handgeschakeld</option>
              <option value="automaat">Automaat</option>
            </select>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary px-6 py-2.5">Vergelijk →</button>
          <span className="text-xs text-muted">Vraagprijs en km zijn optioneel, maar nodig voor de eerlijke prijs.</span>
        </div>
      </form>

      {valid.length >= 2
        ? <Suspense key={JSON.stringify(valid)} fallback={<Skeleton n={valid.length} />}><Comparison cars={valid} /></Suspense>
        : cars.some((c) => c.kenteken) && <p className="text-sm text-warn">Vul minstens twee geldige kentekens in (6 tekens, bijv. G-001-BB).</p>}
    </div>
  );
}

function Skeleton({ n }: { n: number }) {
  return (
    <div className="surface p-6" aria-busy="true">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {Array.from({ length: n }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-line" />)}
      </div>
      <p className="eyebrow mt-4 text-center">Rapporten opbouwen: RDW en vergelijkbare advertenties per auto…</p>
    </div>
  );
}

/** Indexen van de beste waarde(n); alleen als er minstens twee waarden zijn en ze verschillen. */
function winners(values: (number | null | undefined)[], lowerIsBetter = false) {
  const nums = values.filter((x): x is number => x != null);
  if (nums.length < 2 || nums.every((x) => x === nums[0])) return new Set<number>();
  const best = lowerIsBetter ? Math.min(...nums) : Math.max(...nums);
  return new Set(values.flatMap((x, i) => (x === best ? [i] : [])));
}

/** Eén vergelijkingsrij: label links, per auto een cel; `best` markeert de winnaar(s). */
function Row({ label, light, cols, reps, best, cell }: {
  label: string; light?: string; cols: string; reps: (Report | null)[]; best?: Set<number>; cell: (r: Report | null, i: number) => React.ReactNode;
}) {
  return (
    <div data-light-hover={light} className="row-hit grid items-center gap-3 px-3 py-3 sm:px-4" style={{ gridTemplateColumns: cols }}>
      <div className="text-sm font-semibold">{label}</div>
      {reps.map((r, i) => <div key={i} className="min-w-0 text-sm">{cell(r, i)}{best?.has(i) && <div><Best /></div>}</div>)}
    </div>
  );
}

const Best = ({ text = "beste" }: { text?: string }) => (
  <span className="mt-1 inline-block rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold tracking-wider text-good uppercase">{text}</span>
);

async function Comparison({ cars }: { cars: Car[] }) {
  const loaded: Loaded[] = await Promise.all(cars.map(async (car) => {
    const key = parseVehicleKey(car.kenteken)!.value;
    try {
      const res = await loadReport(key, (n) => (n === "prijs" ? car.prijs || null : n === "km" ? car.km || null : n === "transmissie" ? car.tr || null : null));
      return res ? { car, report: res.report } : { car, report: null, error: "Kenteken niet gevonden bij de RDW." };
    } catch {
      return { car, report: null, error: "RDW of marktdata tijdelijk niet bereikbaar." };
    }
  }));
  const reps = loaded.map((l) => l.report);
  const comp = (r: Report | null, id: string) => r?.score.components.find((c) => c.id === id)?.score ?? null;
  const priceGap = (r: Report | null) => {
    const ref = r?.fair?.mid ?? r?.market?.reference?.median;
    return r?.input.askingPrice && ref ? r.input.askingPrice - ref : null;
  };
  const serious = (r: Report | null) => (r ? r.score.risks.filter((x) => x.level !== "low").length : null);

  // Keuringslicht: elk onderdeel in de kleur van de beste auto
  const lights = LIGHTS.map((l) => {
    const vals = reps.map((r) => comp(r, l.id)).filter((x): x is number => x != null);
    return { id: l.id, score: vals.length ? Math.max(...vals) : null };
  });

  const cols = `minmax(110px,0.9fr) repeat(${loaded.length}, minmax(150px,1fr))`;
  const row = { cols, reps };

  return (
    <div className="surface overflow-x-auto p-2 sm:p-3">
      <ScoreLights components={lights} />
      <div className="min-w-max md:min-w-0">
        <div className="grid gap-3 px-3 py-3 sm:px-4" style={{ gridTemplateColumns: cols }}>
          <div />
          {loaded.map(({ car, report: r, error }, i) => (
            <div key={i} className="min-w-0">
              <span className="plate inline-block px-2.5 py-0.5 text-sm">{formatPlate(r?.bundle.vehicle.kenteken ?? car.kenteken)}</span>
              {r ? (
                <>
                  <div className="mt-2 truncate font-semibold">{r.bundle.vehicle.merk} <span className="text-muted">{r.bundle.vehicle.model}</span></div>
                  <div className="text-xs text-muted">{r.bundle.vehicle.bouwjaar ?? "?"}{r.input.mileage ? ` · ${r.input.mileage.toLocaleString("nl-NL")} km` : ""}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-light tracking-[-0.05em]" style={{ color: scoreColor(r.score.overall) }}>{r.score.overall.toFixed(1).replace(".", ",")}</span>
                    <span className="text-xs text-muted">/10 · {scoreVerdict(r.score.overall)}</span>
                  </div>
                  {winners(reps.map((x) => x?.score.overall)).has(i) && <Best text="hoogste cijfer" />}
                </>
              ) : <p className="mt-2 text-xs text-bad">{error}</p>}
            </div>
          ))}
        </div>
        <div className="rows">
          {LIGHTS.map((l) => (
            <Row key={l.id} {...row} label={l.label} light={l.id} best={winners(reps.map((r) => comp(r, l.id)))}
              cell={(r) => {
                const s = comp(r, l.id);
                return s == null
                  ? <span className="text-xs text-muted">geen data</span>
                  : <div className="flex items-center gap-2"><div className="flex-1"><Bar value={s} /></div><b className="num" style={{ color: scoreColor(s) }}>{s.toFixed(1)}</b></div>;
              }} />
          ))}
          <Row {...row} label="Vraagprijs" cell={(r) => <span className="num">{r?.input.askingPrice ? eur(r.input.askingPrice) : "–"}</span>} />
          <Row {...row} label="T.o.v. de markt" light="market" best={winners(reps.map(priceGap), true)}
            cell={(r) => {
              const gap = priceGap(r);
              return gap == null
                ? <span className="text-xs text-muted">vraagprijs nodig</span>
                : <span className={`num font-semibold ${gap > 0 ? "text-bad" : "text-good"}`}>{eur(Math.abs(gap))} {gap > 0 ? "boven" : "onder"} {r?.fair ? "eerlijke prijs" : "mediaan"}</span>;
            }} />
          <Row {...row} label="Maandkosten" light="costs" best={winners(reps.map((r) => r?.ownership.perMonth), true)}
            cell={(r) => <span className="num">{r ? `${eur(r.ownership.perMonth)} / mnd` : "–"}</span>} />
          <Row {...row} label="Risico's" light="reliability" best={winners(reps.map(serious), true)}
            cell={(r) => (r ? <span>{r.score.risks.filter((x) => x.level === "high").length} hoog · {r.score.risks.filter((x) => x.level === "medium").length} let op</span> : "–")} />
          <Row {...row} label="Bekende aandachtspunten" light="reliability"
            cell={(r) => (r?.issues.length ? <ul className="space-y-0.5 text-xs">{r.issues.map((x) => <li key={x.id}>{x.title}</li>)}</ul> : <span className="text-xs text-muted">{r ? "geen bekend" : "–"}</span>)} />
          <Row {...row} label="APK tot" light="inspection"
            cell={(r) => <span className="num">{r?.bundle.vehicle.apkVervaldatum ? new Date(r.bundle.vehicle.apkVervaldatum).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "–"}</span>} />
          <Row {...row} label="" cell={(r, i) => (r
            ? <Link href={`/auto/${r.bundle.vehicle.kenteken}?${new URLSearchParams(Object.entries({ prijs: loaded[i].car.prijs, km: loaded[i].car.km, transmissie: loaded[i].car.tr }).filter(([, x]) => x))}`} className="text-brand hover:underline">Volledig rapport →</Link>
            : null)} />
        </div>
      </div>
    </div>
  );
}
