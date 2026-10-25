import type { PriceBand, RdwBundle, ScoreComponent, ScoreResult, UserInputs } from "../types";
import type { OwnershipResult } from "./ownership";

const clamp = (n: number, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, n));
const eur = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

/** Marktreferentie voor het cijfer: live vraagprijzen van vergelijkbare auto's (zelfde transmissie, vermogensrange). */
export interface MarketRef extends PriceBand {
  label: string; // bijv. "12 vergelijkbare automaten in Nederland"
}

/**
 * Referentieprijs voor een auto met deze kilometerstand: de mediaan, gecorrigeerd met 3% per 10.000 km
 * afwijking van de mediane kilometerstand van dezelfde advertenties (max. ±15%).
 */
export function marketReference(m: MarketRef, mileage?: number): { price: number; kmAdj: number } {
  if (mileage == null || m.medianKm == null) return { price: m.median, kmAdj: 0 };
  const kmAdj = Math.max(-0.15, Math.min(0.15, (-(mileage - m.medianKm) / 10000) * 0.03));
  return { price: m.median * (1 + kmAdj), kmAdj };
}

/**
 * Scoring: ontbrekende data (score = null) wordt uit de weging gehaald en verlaagt alleen
 * de betrouwbaarheid, nooit het cijfer zelf.
 */
export function calcScore(
  b: RdwBundle,
  market: MarketRef | null,
  own: OwnershipResult | null,
  input: UserInputs,
): ScoreResult {
  const v = b.vehicle;
  const transmission = v.isElektrisch ? "automaat" : input.transmission;
  const risks: ScoreResult["risks"] = [];
  const checks: string[] = [];
  const comps: ScoreComponent[] = [];
  const now = new Date();

  // 1. Historie & kilometerstand
  {
    const reasons: string[] = [];
    let s: number | null = null;
    if (b.odometer.verdict === "Logisch") { s = 9; reasons.push("RDW-tellerstandoordeel: logisch."); }
    else if (b.odometer.verdict === "Onlogisch") {
      s = 2.5; reasons.push("RDW-tellerstandoordeel: ONLOGISCH.");
      risks.push({ level: "high", text: "Onlogische tellerstand volgens RDW: mogelijk teruggedraaide teller." });
    } else reasons.push("Geen tellerstandoordeel beschikbaar (betrouwbaarheid lager).");
    if (s != null) {
      if (v.exportIndicator) { s -= 4; reasons.push("Voertuig is als export geregistreerd."); risks.push({ level: "high", text: "Exportindicator staat op 'Ja': de auto is (of wordt) geëxporteerd." }); }
      if (v.taxi) { s -= 1.5; reasons.push("Voertuig is (eerder) als taxi geregistreerd: hoge slijtage."); risks.push({ level: "medium", text: "Taxi-indicator: waarschijnlijk veel kilometers en intensief gebruik." }); }
      if (v.wamVerzekerd === false) { s -= 1; reasons.push("Niet WAM-verzekerd volgens RDW."); }
      s = clamp(s);
    }
    comps.push({ id: "history", label: "Historie & kilometerstand", weight: 0.2, score: s, reasons });
    checks.push("Vraag een kilometerrapport (NAP/Carvertical) en onderhoudsboekje met stempels op.");
  }

  // 2. Betrouwbaarheid & mechanische risico's
  {
    const reasons: string[] = [];
    let s = 7.5;
    const age = (v.leeftijdMaanden ?? 60) / 12;
    if (v.leeftijdMaanden == null) { reasons.push("Leeftijd onbekend."); }
    if (age > 10) { s -= 1.5; reasons.push(`Leeftijd ${age.toFixed(0)} jaar: meer slijtage- en defectrisico.`); }
    else if (age > 6) { s -= 0.7; reasons.push(`Leeftijd ${age.toFixed(0)} jaar.`); }
    else reasons.push("Relatief jonge auto.");
    const open = b.recalls.filter((r) => r.statusCode !== "P" && r.statusCode !== "R");
    if (v.openRecall || open.length) {
      s -= 1.5; reasons.push("Openstaande terugroepactie(s).");
      risks.push({ level: "high", text: "Er staat een terugroepactie open. Laat deze kosteloos uitvoeren voor aankoop." });
      checks.push("Controleer bij de dealer/RDW dat alle terugroepacties zijn uitgevoerd.");
    }
    if (b.recalls.length && !open.length) reasons.push(`${b.recalls.length} terugroepactie(s) in het verleden, herstel gemeld.`);
    if (v.isDiesel && age > 7) { s -= 0.5; reasons.push("Diesel van middelbare leeftijd: DPF/EGR/AdBlue-gevoelig bij stadsgebruik."); }
    if (transmission === "automaat" && !v.isElektrisch) {
      const km = input.mileage ?? 0;
      if (age > 8 || km > 150000) {
        s -= 0.7; reasons.push("Automaat op leeftijd of met hoge kilometerstand: reparatie van de versnellingsbak kan duizenden euro's kosten.");
        risks.push({ level: "medium", text: "Oudere automaat: vraag naar onderhoud van de versnellingsbak (olie verversen) en let op schokken of slippen tijdens de proefrit." });
      } else reasons.push("Automaat: let op tijdig onderhoud van de versnellingsbak.");
      checks.push("Vraag of de olie van de automatische versnellingsbak volgens schema is ververst.");
    } else if (transmission === "handgeschakeld" && (age > 8 || (input.mileage ?? 0) > 150000)) {
      reasons.push("Handgeschakeld: koppeling is een slijtagedeel; vraag wanneer die is vervangen.");
      checks.push("Controleer de koppeling (aangrijppunt, slippen bij optrekken) en vraag of die al is vervangen.");
    } else if (!transmission) reasons.push("Transmissie niet opgegeven; versnellingsbakrisico niet beoordeeld.");
    reasons.push("Merk-/modelspecifieke betrouwbaarheidsdata is niet gekoppeld; score is algemeen.");
    comps.push({ id: "reliability", label: "Betrouwbaarheid & mechanische risico's", weight: 0.2, score: clamp(s), reasons });
  }

  // 3. Markt & vraagprijs: vergeleken met de live vraagprijzen van vergelijkbare auto's
  {
    const reasons: string[] = [];
    let s: number | null = null;
    if (input.askingPrice && market) {
      const ref = marketReference(market, input.mileage);
      const ratio = input.askingPrice / ref.price;
      s = clamp(10 - (ratio - 0.9) * 12, 1, 10);
      if (ratio <= 0.9) s = 10;
      reasons.push(`Mediaan vraagprijs ${eur(market.median)} van ${market.label}; bandbreedte ${eur(market.low)} – ${eur(market.high)}.`);
      if (ref.kmAdj !== 0) reasons.push(`Gecorrigeerd voor ${input.mileage!.toLocaleString("nl-NL")} km t.o.v. mediaan ${market.medianKm!.toLocaleString("nl-NL")} km: ${ref.kmAdj > 0 ? "+" : ""}${(ref.kmAdj * 100).toFixed(1)}% → referentie ${eur(ref.price)}.`);
      reasons.push(`Vraagprijs ${eur(input.askingPrice)} is ${(Math.abs(ratio - 1) * 100).toFixed(0)}% ${ratio > 1 ? "boven" : "onder"} de referentie${input.askingPrice > market.high ? " en boven de bandbreedte" : input.askingPrice < market.low ? " en onder de bandbreedte" : ""}.`);
      if (ratio > 1.15) risks.push({ level: "medium", text: "Vraagprijs ligt ruim boven wat vergelijkbare auto's kosten; onderhandel of vergelijk." });
      if (ratio < 0.7) risks.push({ level: "high", text: "Vraagprijs ligt opvallend ver onder vergelijkbare auto's: wees alert op fraude of verborgen gebreken." });
    } else if (!market) reasons.push("Te weinig vergelijkbare advertenties gevonden (minimaal 3 nodig); niet beoordeeld.");
    else reasons.push(`Geen vraagprijs ingevoerd. Mediaan van ${market.label}: ${eur(market.median)} (${eur(market.low)} – ${eur(market.high)}).`);
    comps.push({ id: "market", label: "Vraagprijs t.o.v. de markt", weight: 0.2, score: s, reasons });
  }

  // 4. Eigendomskosten
  {
    const reasons: string[] = [];
    let s: number | null = null;
    if (own) {
      const m = own.perMonth;
      s = clamp(10 - (m - 250) / 90, 2, 10);
      reasons.push(`Geschatte kosten € ${Math.round(m)} per maand (€ ${own.perKm.toFixed(2)} per km), bij standaardaannames.`);
    } else reasons.push("Onvoldoende gegevens voor kostenberekening.");
    comps.push({ id: "costs", label: "Eigendomskosten", weight: 0.15, score: s, reasons });
  }

  // 5. Schade & keuringen
  {
    const reasons: string[] = [];
    let s: number | null = null;
    const insp = b.inspections;
    if (insp.length) {
      s = 9;
      const withDefects = insp.filter((i) => i.defects.length);
      const totalDefects = insp.reduce((n, i) => n + i.defects.reduce((m, d) => m + d.count, 0), 0);
      if (withDefects.length) { s -= Math.min(4, withDefects.length * 0.8 + totalDefects * 0.2); reasons.push(`${totalDefects} gebrek(en) bij ${withDefects.length} van ${insp.length} APK-melding(en).`); }
      else reasons.push(`${insp.length} APK-melding(en) zonder geregistreerde gebreken.`);
    } else reasons.push("Geen APK-meldingen in open data (nieuwe auto of nog niet keuringsplichtig).");
    if (v.apkVervaldatum) {
      const exp = new Date(v.apkVervaldatum);
      if (exp < now) { s = (s ?? 7) - 2; reasons.push("APK is verlopen."); risks.push({ level: "high", text: `APK verlopen op ${v.apkVervaldatum}.` }); checks.push("Laat de auto vóór aankoop keuren of bedingen dat de verkoper een nieuwe APK regelt."); }
      else if ((exp.getTime() - now.getTime()) / 86400000 < 60) { reasons.push("APK verloopt binnen 2 maanden."); risks.push({ level: "low", text: "APK verloopt binnenkort." }); }
    }
    reasons.push("Schadehistorie is niet beschikbaar in open data en telt daarom niet mee.");
    comps.push({ id: "inspection", label: "Keuringen & schade", weight: 0.15, score: s == null ? null : clamp(s), reasons });
  }

  // 6. Uitrusting & waarde voor geld
  {
    const reasons: string[] = [];
    let s: number | null = null;
    if (input.askingPrice && v.catalogusprijs) {
      const retained = input.askingPrice / v.catalogusprijs;
      const age = (v.leeftijdMaanden ?? 60) / 12;
      const expected = 0.88 * Math.exp(-0.13 * age);
      s = clamp(6 + (expected - retained) * 12);
      reasons.push(`Vraagprijs is ${(retained * 100).toFixed(0)}% van de catalogusprijs (verwacht ≈ ${(expected * 100).toFixed(0)}%).`);
    } else reasons.push("Uitrustingsdata en vraagprijs ontbreken; niet beoordeeld.");
    comps.push({ id: "value", label: "Uitrusting & waarde voor geld", weight: 0.1, score: s, reasons });
  }

  const avail = comps.filter((c) => c.score != null);
  const wSum = avail.reduce((n, c) => n + c.weight, 0);
  const overall = wSum > 0 ? avail.reduce((n, c) => n + c.score! * c.weight, 0) / wSum : 5;
  const confidence = wSum / comps.reduce((n, c) => n + c.weight, 0);

  checks.push("Laat een onafhankelijke keuring (bijv. ANWB/BOVAG) uitvoeren voor aankoop.");
  checks.push("Controleer VIN op auto, kentekenbewijs en papieren; vraag naar schadeverleden en eerdere eigenaren.");
  checks.push("Maak een proefrit en let op geluiden, schakelgedrag, waarschuwingslampen en uitlaatgassen.");
  if (v.isElektrisch || v.isHybride) checks.push("Vraag een batterijgezondheidsrapport (State of Health) en controleer de resterende garantie op de accu.");
  if (v.isDiesel) checks.push("Controleer DPF/EGR/AdBlue-systeem op storingen en vraag naar het gebruikspatroon (korte ritten?).");

  return {
    overall: Math.round(clamp(overall) * 10) / 10,
    confidence,
    confidenceLabel: confidence >= 0.7 ? "Hoog" : confidence >= 0.45 ? "Gemiddeld" : "Laag",
    components: comps,
    risks: risks.sort((a, b2) => ({ high: 0, medium: 1, low: 2 })[a.level] - ({ high: 0, medium: 1, low: 2 })[b2.level]),
    checks: [...new Set(checks)],
  };
}
