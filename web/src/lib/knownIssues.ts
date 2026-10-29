import type { TransmissionGroup, Vehicle } from "./types";

/**
 * Bekende zwakke plekken per motor of versnellingsbak. De RDW kent geen motorcode, dus we herkennen de motor
 * aan merk, cilinderinhoud, aantal cilinders, vermogen, bouwjaar en brandstof. Het gaat om algemeen bekende
 * aandachtspunten voor die motorfamilie, niet om een vastgesteld defect aan deze auto.
 * Uitbreiden: voeg een regel toe en een test in knownIssues.test.ts.
 */
export interface KnownIssue {
  id: string;
  title: string; // motor/onderdeel, bijv. "PSA 1.2 PureTech turbo"
  problem: string;
  check: string;
  risk: "high" | "medium";
  cost?: [number, number]; // indicatieve reparatiekosten in euro
  match: {
    brands: string[]; // RDW-merknaam begint hiermee, hoofdletters
    fuel: "benzine" | "diesel";
    cc?: [number, number];
    cylinders?: number;
    kw?: [number, number];
    years: [number, number];
    transmission?: TransmissionGroup; // alleen als de transmissie zo is opgegeven
  };
}

const VAG = ["VOLKSWAGEN", "AUDI", "SEAT", "SKODA", "CUPRA"];
const PSA = ["PEUGEOT", "CITROEN", "DS", "OPEL"];

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    id: "psa-puretech-turbo",
    title: "PSA 1.2 PureTech (turbo)",
    problem: "De distributieriem loopt in de olie en kan voortijdig slijten. Losgeraakte deeltjes kunnen de oliepomp-zeef verstoppen, met motorschade als gevolg. Het vervangingsinterval is door de fabrikant ingekort.",
    check: "Vraag wanneer de distributieriem is vervangen (factuur) en laat de riemslijtage meten; let op het oliedruklampje en een hoog olieverbruik.",
    risk: "high",
    cost: [900, 1500],
    match: { brands: PSA, fuel: "benzine", cc: [1150, 1250], cylinders: 3, kw: [70, 105], years: [2014, 2023] },
  },
  {
    id: "psa-puretech-na",
    title: "PSA 1.2 PureTech (zonder turbo)",
    problem: "Ook deze uitvoering heeft een distributieriem in olie; de klachten zijn minder frequent dan bij de turboversie.",
    check: "Vraag naar het onderhoudsschema van de distributieriem en of die op tijd is vervangen.",
    risk: "medium",
    cost: [800, 1300],
    match: { brands: PSA, fuel: "benzine", cc: [1150, 1250], cylinders: 3, kw: [45, 69], years: [2012, 2023] },
  },
  {
    id: "vag-ea111-tsi",
    title: "VW-groep 1.2/1.4 TSI (EA111)",
    problem: "De distributieketting kan oprekken of overslaan, vaak hoorbaar als ratelen bij een koude start.",
    check: "Start de motor koud en luister de eerste seconden naar ratelen; vraag of de ketting en spanner al zijn vervangen.",
    risk: "high",
    cost: [900, 1600],
    match: { brands: VAG, fuel: "benzine", cc: [1190, 1400], cylinders: 4, years: [2006, 2012] },
  },
  {
    id: "vag-dq200",
    title: "DSG7-automaat met droge koppeling (DQ200)",
    problem: "De mechatronic-unit en de dubbele koppeling zijn gevoelig; schokken bij wegrijden of schakelen is een bekend symptoom.",
    check: "Let tijdens de proefrit op schokken bij optrekken en terugschakelen; vraag of mechatronic of koppeling al is vervangen.",
    risk: "medium",
    cost: [1500, 3000],
    match: { brands: VAG, fuel: "benzine", kw: [60, 125], years: [2008, 2016], transmission: "automaat" },
  },
  {
    id: "bmw-n47",
    title: "BMW 2.0 diesel (N47)",
    problem: "De distributieketting zit aan de achterkant van de motor en kan uitrekken of breken; reparatie vergt vaak het uitbouwen van de motor.",
    check: "Luister naar ratelen aan de achterzijde van de motor (vooral stationair, warm) en vraag of de ketting is vervangen.",
    risk: "high",
    cost: [2000, 4000],
    match: { brands: ["BMW"], fuel: "diesel", cc: [1990, 2000], cylinders: 4, years: [2007, 2014] },
  },
  {
    id: "ford-ecoboost-10",
    title: "Ford 1.0 EcoBoost",
    problem: "Bekend om koelvloeistofverlies dat tot oververhitting kan leiden; bovendien een distributieriem in olie.",
    check: "Controleer het koelvloeistofpeil en vraag naar lekkages of oververhitting; vraag wanneer de distributieriem is vervangen.",
    risk: "medium",
    cost: [1000, 3000],
    match: { brands: ["FORD"], fuel: "benzine", cc: [990, 1000], cylinders: 3, years: [2012, 2018] },
  },
  {
    id: "renault-tce-12",
    title: "Renault/Dacia/Nissan 1.2 TCe (H5Ft)",
    problem: "Overmatig olieverbruik is een bekend probleem, met risico op kettingschade en motorschade bij een te laag oliepeil.",
    check: "Vraag naar het olieverbruik en bijvullen tussen beurten; controleer of eventuele fabrieksacties zijn uitgevoerd.",
    risk: "high",
    cost: [1000, 5000],
    match: { brands: ["RENAULT", "DACIA", "NISSAN"], fuel: "benzine", cc: [1190, 1200], cylinders: 4, years: [2012, 2016] },
  },
  {
    id: "fiat-twinair",
    title: "Fiat 0.9 TwinAir",
    problem: "De MultiAir-unit (hydraulische klepbediening) kan falen; het verbruik ligt in de praktijk vaak flink hoger dan opgegeven.",
    check: "Let op stotteren of storingslampjes; vraag naar het werkelijke verbruik.",
    risk: "medium",
    cost: [800, 1500],
    match: { brands: ["FIAT", "ALFA ROMEO", "LANCIA"], fuel: "benzine", cc: [870, 880], cylinders: 2, years: [2010, 2020] },
  },
  {
    id: "renault-k9k",
    title: "Renault/Nissan/Dacia 1.5 dCi (K9K)",
    problem: "Bij achterstallig olieonderhoud kunnen de drijfstanglagers uitslaan.",
    check: "Vraag het onderhoudsboekje: olie moet op tijd zijn ververst; luister naar kloppende geluiden.",
    risk: "medium",
    cost: [1500, 4000],
    match: { brands: ["RENAULT", "DACIA", "NISSAN", "MERCEDES-BENZ"], fuel: "diesel", cc: [1460, 1470], cylinders: 4, years: [2005, 2012] },
  },
  {
    id: "mb-om651",
    title: "Mercedes 2.1 CDI (OM651, vroege uitvoering)",
    problem: "De piëzo-injectoren van de eerste jaren waren gevoelig en vielen onder een terugroepactie.",
    check: "Vraag of de injectoren zijn vervangen en of alle terugroepacties zijn uitgevoerd.",
    risk: "medium",
    cost: [1500, 3000],
    match: { brands: ["MERCEDES-BENZ"], fuel: "diesel", cc: [2140, 2145], cylinders: 4, years: [2008, 2011] },
  },
  {
    id: "opel-a14net",
    title: "Opel 1.4 Turbo (A14NET)",
    problem: "Lekkende olie- en koelvloeistofleidingen bij de turbo en problemen met de carterontluchting komen regelmatig voor.",
    check: "Kijk onder de motor naar olielekkage rond de turbo en vraag naar een hoog olieverbruik.",
    risk: "medium",
    cost: [300, 1500],
    match: { brands: ["OPEL", "CHEVROLET"], fuel: "benzine", cc: [1360, 1370], cylinders: 4, years: [2010, 2018] },
  },
];

const inRange = (n: number | null, r?: [number, number]) => !r || (n != null && n >= r[0] && n <= r[1]);

export function matchIssues(v: Vehicle, transmission?: TransmissionGroup): KnownIssue[] {
  if (v.isElektrisch) return [];
  const merk = v.merk.toUpperCase();
  const fuel = v.isDiesel ? "diesel" : v.brandstoffen.some((b) => /benzine/i.test(b)) ? "benzine" : null;
  return KNOWN_ISSUES.filter(({ match: m }) =>
    m.brands.some((b) => merk === b || merk.startsWith(`${b} `)) &&
    m.fuel === fuel &&
    inRange(v.cilinderinhoud, m.cc) &&
    (m.cylinders == null || v.cilinders === m.cylinders) &&
    inRange(v.vermogenKw, m.kw) &&
    inRange(v.bouwjaar, m.years) &&
    (m.transmission == null || m.transmission === transmission),
  );
}
