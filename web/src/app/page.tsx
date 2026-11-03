import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import { ProvBadge } from "@/components/ui";
import { LIGHTS } from "@/lib/lights";

// Wat elk onderdeel van het cijfer meeweegt (de wegingen komen uit LIGHTS, gelijk aan score.ts)
const WHAT: Record<string, string> = {
  history: "Leeftijd, kilometerstand per jaar en het NAP-tellerstandoordeel van de RDW.",
  reliability: "Bekende zwakke plekken van deze motor en bak, transmissie en terugroepacties.",
  market: "Vraagprijs tegenover de eerlijke prijs van vergelijkbare advertenties in NL en DE.",
  costs: "Wegenbelasting, brandstof, verzekering en onderhoud per maand.",
  inspection: "APK-historie: afkeuringen, gebreken en hoe recent de laatste keuring was.",
  value: "Uitrusting, vermogen en wat je ervoor krijgt tegenover de prijs.",
};

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section data-sc-act="flow" className="grid min-h-[calc(86svh-72px)] items-center gap-8 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="rise">
          <div className="eyebrow">Kentekenrapport · gratis · zonder account</div>
          <h1 className="mt-4 text-[clamp(2.6rem,1.6rem+4.4vw,5.4rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
            Is deze auto het kopen <span className="text-brand">waard?</span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg text-muted">
            Eén kenteken, één rapport: wat de RDW weet, wat vergelijkbare auto&apos;s nu echt kosten en wat je per maand kwijt bent.
          </p>
        </div>
        <div data-sc-parallax="-0.35">
          <div data-light-home className="surface rise p-5 sm:p-7" style={{ animationDelay: "90ms" }}>
            <nav aria-label="Zoekwijze" className="well mb-5 inline-flex rounded-full p-1 text-sm font-semibold">
              <span aria-current="page" className="rounded-full bg-[var(--pressed)] px-4 py-1.5 shadow-[var(--glass-lip)]">Op kenteken</span>
              <Link href="/zoeken" className="rounded-full px-4 py-1.5 text-muted hover:text-fg">Op model</Link>
              <Link href="/vergelijk" className="rounded-full px-4 py-1.5 text-muted hover:text-fg">Vergelijken</Link>
            </nav>
            <SearchForm />
            <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
              Proefkentekens: <b className="num text-fg">G-001-BB</b> (BMW i3), <b className="num text-fg">00-HVB-7</b> (VW Golf). Zoeken op VIN geeft beperkte resultaten; de RDW biedt geen VIN-opzoeking.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div data-sc-in>
            <div className="eyebrow">Zo komt het cijfer tot stand</div>
            <h2 className="mt-3 text-[clamp(1.7rem,1.2rem+1.6vw,2.6rem)] leading-tight font-semibold">Zes onderdelen, elk met een eigen licht</h2>
            <p className="mt-4 max-w-[44ch] text-muted">
              In het rapport krijgt elk licht de kleur van zijn deelscore: groen is goed, oranje let op, rood slecht. Onderdelen zonder data tellen niet mee en kleuren grijs.
            </p>
          </div>
          <ul className="surface rows p-2 sm:p-3" data-sc-in>
            {LIGHTS.map((l) => (
              <li key={l.id} data-light-hover={l.id} tabIndex={0} className="row-hit flex items-start gap-4 px-3 py-3.5 outline-none sm:px-4">
                <span aria-hidden className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full" style={{ background: l.hue, boxShadow: `0 0 0 4px color-mix(in oklab, ${l.hue} 22%, transparent)` }} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{l.label}</div>
                  <p className="mt-0.5 text-sm text-muted">{WHAT[l.id]}</p>
                </div>
                <span className="num pt-0.5 text-lg font-semibold whitespace-nowrap"><span data-sc-count={`0 ${Math.round(l.weight * 100)}`}>{Math.round(l.weight * 100)}</span>%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="pb-6">
        <div className="well grid gap-4 p-5 text-sm sm:grid-cols-[auto_1fr] sm:items-start sm:p-6" data-sc-in>
          <div className="eyebrow pt-0.5">Eerlijk over data</div>
          <div>
            <p className="max-w-[72ch]">
              Marktprijzen zijn live vraagprijzen, geen verkoopprijzen. Wat niet openbaar is (schade, eigenaren, kilometerreeks) tonen we als niet beschikbaar, nooit verzonnen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ProvBadge p="verified" /><span className="text-xs text-muted">uit de RDW</span>
              <ProvBadge p="estimate" /><span className="text-xs text-muted">berekend</span>
              <ProvBadge p="unavailable" /><span className="text-xs text-muted">niet openbaar</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
