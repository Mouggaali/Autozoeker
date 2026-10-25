import SearchForm from "@/components/SearchForm";

const features = [
  ["Voertuigdata", "Specificaties, APK-historie, gebreken, terugroepacties en tellerstandoordeel rechtstreeks uit het RDW-register."],
  ["Marktwaarde NL & DE", "Waardeschatting plus zoeklinks naar Marktplaats, AutoScout24 en mobile.de, met importkosten inclusief BPM."],
  ["Maandkosten", "MRB, brandstof, verzekering, onderhoud, afschrijving en financiering in een interactieve calculator."],
  ["Score 1–10", "Transparante score met uitleg, risico's en controles voor aankoop. Ontbrekende data verlaagt de zekerheid, niet het cijfer."],
];

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-5xl">
        Is deze auto het kopen waard?
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted">
        Voer een kenteken in en ontvang direct een rapport over betrouwbaarheid, prijs en kosten.
      </p>
      <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-line bg-card p-5 shadow-sm">
        <SearchForm />
        <p className="mt-3 text-xs text-muted">
          Proefkentekens: <b>G001BB</b> (BMW i3), <b>00HVB7</b> (VW Golf). Zoeken op VIN geeft beperkte resultaten omdat de RDW geen VIN-opzoeking biedt.
        </p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {features.map(([t, d]) => (
          <div key={t} className="rounded-xl border border-line bg-card p-5">
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-line bg-brand-soft p-4 text-sm">
        <b>Eerlijk over data:</b> alles wat uit de RDW komt is gemarkeerd als <i>geverifieerd</i>. Berekeningen zijn <i>schattingen</i>. Wat niet openbaar is (schade, eigenaren, kilometerreeks, advertentiehistorie) tonen we als <i>niet beschikbaar</i>, nooit verzonnen.
      </div>
    </div>
  );
}
