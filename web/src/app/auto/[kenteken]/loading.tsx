/** Wordt getoond terwijl RDW-gegevens en live advertenties worden opgehaald (eerste keer ~10 s, daarna uit cache). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8" aria-busy="true">
      <div className="animate-pulse surface rounded-xl p-6">
        <div className="h-8 w-40 rounded bg-line" />
        <div className="mt-4 h-7 w-2/3 rounded bg-line" />
        <div className="mt-2 h-4 w-1/2 rounded bg-line" />
      </div>
      <p className="eyebrow text-center">Rapport opbouwen: RDW-gegevens en vergelijkbare advertenties van Marktplaats en AutoScout24 ophalen…</p>
      <div className="grid animate-pulse gap-6 lg:grid-cols-3">
        <div className="h-40 rounded-xl bg-line lg:col-span-2" />
        <div className="h-40 rounded-xl bg-line" />
      </div>
    </div>
  );
}
