import type { GradedListing, Listing, RdwBundle } from "../types";
import { calcOwnership, defaultInputs, ownershipFacts } from "./ownership";
import { calcScore } from "./score";
import { estimateValue } from "./valuation";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface GradeStats {
  count: number;
  medianPrice: number | null; // mediaan effectieve prijs (DE incl. importkosten)
  medianMileage: number | null;
}

/**
 * Cijfer per advertentie: dezelfde score-engine (`calcScore`) en dezelfde schaal als het rapport
 * op kenteken, zodat de cijfers vergelijkbaar zijn. Per advertentie worden bouwjaar, kilometerstand
 * en vraagprijs ingevuld (Duitse auto's: vraagprijs + importkosten). Gegevens die alleen bij
 * een kenteken bestaan (APK-historie, tellerstandoordeel, terugroepacties, export/taxi) zijn bij een
 * advertentie onbekend en tellen dus niet mee; ze verlagen alleen de betrouwbaarheid.
 * Het cijfer beoordeelt de auto zoals geadverteerd, niet de technische staat.
 */
export function gradeListings(
  bundle: RdwBundle,
  listings: Listing[],
  importExtras: number,
  ref: { price?: number; km?: number } = {},
  now = new Date(),
): { graded: GradedListing[]; stats: GradeStats } {
  const eff = (l: Listing) => l.price + (l.country === "DE" ? importExtras : 0);
  const kms = listings.map((l) => l.mileage).filter((x): x is number => x != null && x > 0);
  const medP = listings.length >= 3 ? median(listings.map(eff)) : null;
  const medK = kms.length >= 3 ? median(kms) : null;
  const base = bundle.vehicle;

  // Is dit dezelfde auto als in het rapport? Dan gelden ook de kentekengegevens (APK, tellerstand, recalls)
  // en is het cijfer exact gelijk aan het rapport met dezelfde vraagprijs en kilometerstand.
  const near = (a: number | null | undefined, b: number | undefined) => a != null && b != null && Math.abs(a - b) <= Math.max(1, b * 0.005);
  const isSame = (l: Listing) => !!ref.price && near(l.price, ref.price) && l.year === base.bouwjaar && (ref.km == null || near(l.mileage, ref.km));

  const graded = listings.map((l): GradedListing => {
    if (isSame(l)) {
      const nl = estimateValue(base, ref.km, "NL");
      const own = calcOwnership(ownershipFacts(base), defaultInputs(base, nl.mid));
      const score = calcScore(bundle, nl, own, { askingPrice: ref.price, mileage: ref.km });
      const eff0 = eff(l);
      return {
        ...l,
        grade: score.overall,
        gradeConfidence: score.confidenceLabel,
        effectivePrice: eff0,
        gradeReasons: ["Dit is de auto uit je rapport: zelfde cijfer, met kentekengegevens (APK, tellerstand, terugroepacties)"],
        flags: [],
        sameAsReport: true,
      };
    }
    const year = l.year ?? base.bouwjaar;
    const vehicle = {
      ...base,
      bouwjaar: year,
      leeftijdMaanden: year ? Math.max(0, (now.getFullYear() - year) * 12 + 6) : base.leeftijdMaanden,
      apkVervaldatum: null,
      exportIndicator: null,
      taxi: null,
      wamVerzekerd: null,
      openRecall: null,
    };
    const b = { ...bundle, vehicle, inspections: [], recalls: [], odometer: { verdict: "Onbekend" as const, lastYear: null, explanation: "" } };
    const effectivePrice = eff(l);
    const km = l.mileage ?? undefined;
    const nl = estimateValue(vehicle, km, "NL");
    const own = calcOwnership(ownershipFacts(vehicle), defaultInputs(vehicle, nl.mid));
    const score = calcScore(b, nl, own, { askingPrice: effectivePrice, mileage: km });

    const reasons: string[] = [];
    const flags: string[] = [];
    const market = score.components.find((c) => c.id === "market");
    if (market?.reasons[0]) reasons.push(market.reasons[0].replace("de geschatte marktwaarde", "de modelwaarde"));
    if (medP) {
      const pct = Math.round(Math.abs(effectivePrice / medP - 1) * 100);
      reasons.push(pct < 3 ? "in lijn met de mediaan van de gevonden auto's" : `${pct}% ${effectivePrice > medP ? "boven" : "onder"} de mediaan van de gevonden auto's${l.country === "DE" ? " (incl. import)" : ""}`);
      if (effectivePrice / medP < 0.65) flags.push("Opvallend goedkoop: wees alert op fraude of verborgen gebreken");
    }
    if (l.mileage == null) flags.push("Kilometerstand onbekend");
    else if (year) {
      const age = Math.max(0.5, now.getFullYear() - year + 0.5);
      const ratio = l.mileage / (age * 15000);
      reasons.push(`${l.mileage.toLocaleString("nl-NL")} km = ${Math.round(ratio * 100)}% van verwachte stand`);
      if (ratio < 0.3 && age > 3) flags.push("Opvallend lage kilometerstand voor de leeftijd: controleer de tellerstand (NAP)");
      if (l.mileage < 1000 && age > 2) flags.push("Kilometerstand lijkt een invoerfout");
    }
    if (base.bouwjaar && year && year !== base.bouwjaar) reasons.push(`bouwjaar ${year} (gezocht ${base.bouwjaar})`);

    return {
      ...l,
      grade: score.overall,
      gradeConfidence: score.confidenceLabel,
      effectivePrice,
      gradeReasons: reasons,
      flags,
    };
  });

  graded.sort((a, b) => b.grade - a.grade);
  return { graded, stats: { count: listings.length, medianPrice: medP, medianMileage: medK } };
}
