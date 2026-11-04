import { canRegister, importInfo } from "./damage";
import type { KnownIssue } from "./knownIssues";
import type { RdwBundle, TransmissionGroup } from "./types";

/**
 * Bezichtigingschecklist: eerst wat bij déze auto hoort (zwakke plekken, APK-gebreken, terugroepacties,
 * teller, controles uit het cijfer), daarna een vaste basislijst die past bij brandstof en transmissie.
 * Item-id's zijn stabiel, zodat afgevinkte punten na herladen blijven staan.
 */
export interface ChecklistItem { id: string; text: string; why?: string }
export interface ChecklistGroup { id: string; title: string; items: ChecklistItem[] }

export function buildChecklist(input: {
  bundle: RdwBundle;
  issues: KnownIssue[];
  checks: string[];
  transmission?: TransmissionGroup;
}): ChecklistGroup[] {
  const { bundle, issues, checks, transmission } = input;
  const v = bundle.vehicle;
  const own: ChecklistItem[] = [];

  for (const x of issues) own.push({ id: `issue-${x.id}`, text: x.check, why: x.title });
  const last = bundle.inspections[0];
  last?.defects.forEach((d, i) => own.push({ id: `apk-${d.code}-${i}`, text: `Is "${d.description.toLowerCase()}" verholpen? Vraag de factuur.`, why: `Gebrek bij de APK van ${new Date(last.date).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}` }));
  bundle.recalls
    .filter((r) => r.statusCode !== "P" && r.statusCode !== "R")
    .forEach((r) => own.push({ id: `recall-${r.code}`, text: `Laat bij de dealer bevestigen dat terugroepactie ${r.code} is uitgevoerd.`, why: r.status }));
  if (canRegister(v) === false) own.push({ id: "blocked", text: "Laat zien waarom het kenteken niet op naam kan (RDW-papieren, schadekeuringsrapport). Zonder oplossing niet kopen.", why: "RDW: tenaamstellen niet mogelijk" });
  if (importInfo(v)?.imported) own.push({ id: "import", text: "Vraag de buitenlandse registratiepapieren en onderhoudshistorie; overweeg een historierapport (carVertical, AutoDNA).", why: "Importauto: buitenlandse schade onbekend" });
  if (v.taxi) own.push({ id: "taxi", text: "Ex-taxi: let extra op slijtage van stoelen, stuur, koppeling of bak en vraag de onderhoudshistorie.", why: "RDW: taxi-indicator" });
  if (bundle.odometer.verdict === "Onlogisch") own.push({ id: "odo", text: "Vraag een verklaring en het NAP-rapport voor de onlogische tellerstand; vergelijk met de onderhoudshistorie.", why: "RDW-telleroordeel: onlogisch" });
  checks.forEach((c, i) => {
    if (!own.some((o) => o.text === c)) own.push({ id: `check-${i}-${c.slice(0, 24).replace(/\W+/g, "-").toLowerCase()}`, text: c });
  });

  const papers: ChecklistItem[] = [
    { id: "p-kenteken", text: "Kentekencard en tenaamstellingscode (deel II) aanwezig en op naam van de verkoper." },
    { id: "p-onderhoud", text: "Onderhoudsboekje of facturen: laatste beurt, en wanneer de distributie is gedaan." },
    { id: "p-nap", text: "NAP-tellerrapport bekijken en vergelijken met de kilometerstand op het dashboard." },
    { id: "p-sleutels", text: "Alle sleutels aanwezig (en werkend)." },
  ];
  const outside: ChecklistItem[] = [
    { id: "o-lak", text: "Lak in daglicht bekijken: kleurverschil, overspuitnevel, ongelijke naden tussen panelen." },
    { id: "o-banden", text: "Banden: profiel (min. 3 mm), gelijke slijtage links en rechts, DOT-datum niet ouder dan 6 jaar." },
    { id: "o-onder", text: "Onder de auto: roest, olielekkage, vochtplekken op de grond waar hij stond." },
    { id: "o-binnen", text: "Interieur: vochtige vloermatten, geur, werking van airco, ramen en verlichting." },
  ];
  const drive: ChecklistItem[] = [
    { id: "d-koud", text: "Koude start (motorkap voelen): geen tikken, ratelen of blauwe rook." },
    { id: "d-lampjes", text: "Geen waarschuwingslampjes na het starten." },
    { id: "d-remmen", text: "Remmen: recht stoppen, geen trillen in het stuur of piepen." },
    { id: "d-sturen", text: "Stuurt recht, geen geluid bij vol insturen." },
  ];
  if (v.isElektrisch || v.isHybride) {
    drive.push({ id: "d-accu", text: "Vraag een accu-gezondheidsrapport (SoH) of lees het uit; vergelijk de actieradius met nieuw." });
    papers.push({ id: "p-laadkabel", text: "Laadkabel(s) aanwezig en onbeschadigd." });
  }
  if (transmission === "automaat" || v.isElektrisch) {
    if (!v.isElektrisch) drive.push({ id: "d-automaat", text: "Automaat: soepel schakelen zonder schokken of slippen, ook bij optrekken vanuit stilstand en achteruit." });
  } else {
    drive.push({ id: "d-koppeling", text: "Koppeling: grijpt niet te hoog aan, schakelt zonder kraken in alle versnellingen." });
  }
  if (v.isDiesel) drive.push({ id: "d-dpf", text: "Diesel: geen rookwolk bij flink optrekken; vraag naar roetfilter en EGR." });

  return [
    { id: "own", title: "Specifiek voor deze auto", items: own },
    { id: "papers", title: "Papieren", items: papers },
    { id: "outside", title: "Rondom en binnen", items: outside },
    { id: "drive", title: "Proefrit", items: drive },
  ].filter((g) => g.items.length > 0);
}
