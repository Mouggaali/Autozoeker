import Link from "next/link";
import { notFound } from "next/navigation";
import Checklist from "@/components/Checklist";
import { buildChecklist } from "@/lib/checklist";
import { formatPlate, parseVehicleKey } from "@/lib/plate";
import { buildReport, loadBundle, parseInputs } from "@/lib/report";

export const metadata = { title: "Bezichtigingschecklist – AutoZoeker" };

/** Checklist voor de bezichtiging: alleen RDW-gegevens nodig, dus direct beschikbaar (geen marktdata). */
export default async function ChecklistPage({ params, searchParams }: PageProps<"/auto/[kenteken]/checklist">) {
  const { kenteken } = await params;
  const sp = await searchParams;
  const key = parseVehicleKey(decodeURIComponent(kenteken));
  if (!key || key.kind !== "plate") notFound();
  const loaded = await loadBundle(key.value).catch(() => null);
  if (!loaded) notFound();
  const get = (n: string) => { const x = sp[n]; return (Array.isArray(x) ? x[0] : x) ?? null; };
  const v = loaded.bundle.vehicle;
  const input = parseInputs(get, v);
  const r = buildReport(loaded.bundle, input, null);
  const groups = buildChecklist({ bundle: r.bundle, issues: r.issues, checks: r.score.checks, transmission: input.transmission });
  const back = `/auto/${v.kenteken}${Object.keys(sp).length ? `?${new URLSearchParams(Object.fromEntries(Object.keys(sp).map((k) => [k, get(k) ?? ""])))}` : ""}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href={back} className="text-sm text-brand hover:underline print:hidden">← Terug naar rapport</Link>
      <div className="mt-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="plate inline-block px-3 py-0.5 text-lg">{formatPlate(v.kenteken)}</span>
        <h1 className="text-2xl font-semibold tracking-tight">{v.merk} <span className="text-muted">{v.model}</span></h1>
      </div>
      <p className="mb-5 text-sm text-muted">Neem dit mee naar de bezichtiging. Bovenaan staat wat bij déze auto hoort, uit de RDW-gegevens en de bekende zwakke plekken; daaronder de vaste punten. Afvinken blijft bewaard in deze browser.</p>
      <Checklist kenteken={v.kenteken} groups={groups} />
    </div>
  );
}
