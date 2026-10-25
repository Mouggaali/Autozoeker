import SearchForm from "@/components/SearchForm";

const features = [
  ["RDW-register", "Specificaties, APK-historie, gebreken, terugroepacties en tellerstandoordeel, rechtstreeks uit de open data."],
  ["Live marktprijs", "Mediaan en bandbreedte van advertenties met dezelfde transmissie en een vergelijkbaar vermogen, in NL en DE."],
  ["Maandkosten", "MRB, brandstof, verzekering, onderhoud, afschrijving en financiering in een interactieve calculator."],
  ["Cijfer 1–10", "Transparante score met uitleg, risico's en controles. Ontbrekende data verlaagt de zekerheid, niet het cijfer."],
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid gap-10 py-12 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="rise">
          <div className="eyebrow">Kentekenrapport · gratis · zonder account</div>
          <h1 className="mt-4 text-5xl font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
            Is deze auto het kopen <span className="relative whitespace-nowrap"><span className="relative z-10">waard?</span><span aria-hidden className="absolute inset-x-0 bottom-1 -z-0 h-4 bg-plate/70 sm:h-5" /></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Eén kenteken, één rapport: wat de RDW weet, wat vergelijkbare auto&apos;s nu echt kosten en wat je per maand kwijt bent.
          </p>
        </div>
        <div className="surface rise rounded-xl p-5 sm:p-6" style={{ animationDelay: "80ms" }}>
          <div className="eyebrow mb-3">Start je check</div>
          <SearchForm />
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Proefkentekens: <b className="num text-fg">G-001-BB</b> (BMW i3), <b className="num text-fg">00-HVB-7</b> (VW Golf). Zoeken op VIN geeft beperkte resultaten; de RDW biedt geen VIN-opzoeking.
          </p>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {features.map(([t, d], i) => (
          <div key={t} className="bg-card p-5">
            <div className="num text-sm text-brand">0{i + 1}</div>
            <h2 className="mt-2 text-lg font-bold">{t}</h2>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-4 rounded-xl border border-dashed border-line p-5 text-sm sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="eyebrow pt-0.5">Eerlijk over data</div>
        <p>
          Alles uit de RDW is gemarkeerd als <i>geverifieerd</i>. Marktprijzen zijn live vraagprijzen, geen verkoopprijzen. Berekeningen zijn <i>schattingen</i>. Wat niet openbaar is (schade, eigenaren, kilometerreeks) tonen we als <i>niet beschikbaar</i>, nooit verzonnen.
        </p>
      </section>
    </div>
  );
}
