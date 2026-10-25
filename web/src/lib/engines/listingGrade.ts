import type { GradedListing, Listing, RdwBundle, TransmissionGroup } from "../types";
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
  /** Transmissie waarbinnen de mediaan is bepaald; null = alle advertenties */
  comparedTransmission: TransmissionGroup | null;
}

/**
 * Cijfer per advertentie: dezelfde score-engine (`calcScore`) en dezelfde schaal als het rapport
 * op kenteken, zodat de cijfers vergelijkbaar zijn. Per advertentie worden bouwjaar, kilometerstand
 * en vraagprijs ingevuld (Duitse auto's: vraagprijs + importkosten). Gegevens die alleen bij
 * een kenteken bestaan (APK-historie, tellerstandoordeel, terugroepacties, export/taxi) zijn bij een
 * advertentie onbekend en tellen dus niet mee; ze verlagen alleen de betrouwbaarheid.
 * Het cijfer beoordeelt de auto zoals geadverteerd, niet de technische staat.
 * Is de transmissie van de eigen auto bekend, dan wordt de mediaan alleen over advertenties met
 * dezelfde transmissie bepaald (automaten zijn duurder dan handbakken).
 */
export function gradeListings(
  bundle: RdwBundle,
  listings: Listing[],
  importExtras: number,
  ref: { price?: number; km?: number; transmission?: TransmissionGroup } = {},
  now = new Date(),
): { graded: GradedListing[]; stats: GradeStats } {
  const eff = (l: Listing) => l.price + (l.country === "DE" ? importExtras : 0);
  const same = ref.transmission ? listings.filter((l) => l.transmissionGroup === ref.transmission) : [];
  const peers = same.length >= 3 ? same : listings;
  const comparedTransmission = peers === same ? ref.transmission! : null;
  const kms = peers.map((l) => l.mileage).filter((x): x is number => x != null && x > 0);
  const medP = peers.length >= 3 ? median(peers.map(eff)) : null;
  const medK = kms.length >= 3 ? median(kms) : null;
  const base = bundle.vehicle;

  // Is dit dezelfde auto als in het rapport? Dan gelden ook de kentekengegevens (APK, tellerstand, recalls)
  // en is het cijfer exact gelijk aan het rapport met dezelfde vraagprijs en kilometerstand.
  const near = (a: number | null | undefined, b: number | undefined) => a != null && b != null && Math.abs(a - b) <= Math.max(1, b * 0.005);
  const isSame = (l: Listing) => !!ref.price && near(l.price, ref.price) && l.year === base.bouwjaar && (ref.km == null || near(l.mileage, ref.km));

  const graded = listings.map((l): GradedListing => {
    if (isSame(l)) {
      const nl = estimateValue(base, ref.km, "NL", ref.transmission);
      const own = calcOwnership(ownershipFacts(base), defaultInputs(base, nl.mid));
      const score = calcScore(bundle, nl, own, { askingPrice: ref.price, mileage: ref.km, transmission: ref.transmission });
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
    const tr = l.transmissionGroup ?? undefined;
    const nl = estimateValue(vehicle, km, "NL", tr);
    const own = calcOwnership(ownershipFacts(vehicle), defaultInputs(vehicle, nl.mid));
    const score = calcScore(b, nl, own, { askingPrice: effectivePrice, mileage: km, transmission: tr });

    const reasons: string[] = [];
    const flags: string[] = [];
    const market = score.components.find((c) => c.id === "market");
    if (market?.reasons[0]) reasons.push(market.reasons[0].replace("de geschatte marktwaarde", "de modelwaarde"));
    const otherTransmission = comparedTransmission != null && l.transmissionGroup !== comparedTransmission;
    if (otherTransmission) {
      reasons.push(l.transmissionGroup ? `andere transmissie (${l.transmissionGroup}): niet meegeteld in de mediaan` : "transmissie onbekend: niet meegeteld in de mediaan");
    } else if (medP) {
      const peersLabel = comparedTransmission ? `gevonden ${comparedTransmission === "automaat" ? "automaten" : "handgeschakelde auto's"}` : "gevonden auto's";
      const pct = Math.round(Math.abs(effectivePrice / medP - 1) * 100);
      reasons.push(pct < 3 ? `in lijn met de mediaan van de ${peersLabel}` : `${pct}% ${effectivePrice > medP ? "boven" : "onder"} de mediaan van de ${peersLabel}${l.country === "DE" ? " (incl. import)" : ""}`);
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
  return { graded, stats: { count: peers.length, medianPrice: medP, medianMileage: medK, comparedTransmission } };
}
