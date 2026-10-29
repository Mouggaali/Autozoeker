import type { GradedListing, Listing, RdwBundle } from "../types";
import { calcOwnership, defaultInputs, ownershipFacts } from "./ownership";
import { type MarketRef, calcScore, marketReference } from "./score";

/**
 * Cijfer per advertentie: dezelfde score-engine (`calcScore`) en dezelfde schaal als het rapport
 * op kenteken, zodat de cijfers vergelijkbaar zijn. Per advertentie worden bouwjaar, kilometerstand,
 * transmissie en vraagprijs ingevuld (Duitse auto's: vraagprijs + importkosten) en vergeleken met
 * dezelfde marktreferentie als het rapport. Gegevens die alleen bij een kenteken bestaan
 * (APK-historie, tellerstandoordeel, terugroepacties, export/taxi) zijn bij een advertentie onbekend
 * en tellen dus niet mee; ze verlagen alleen de betrouwbaarheid.
 * Het cijfer beoordeelt de auto zoals geadverteerd, niet de technische staat.
 */
const eur = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

export function gradeListings(
  bundle: RdwBundle,
  listings: Listing[],
  importExtras: number,
  market: MarketRef | null,
  ref: { price?: number; km?: number; transmission?: Listing["transmissionGroup"] } = {},
  now = new Date(),
): GradedListing[] {
  const eff = (l: Listing) => l.price + (l.country === "DE" ? importExtras : 0);
  const base = bundle.vehicle;
  const ownValue = market?.median ?? null;

  // Is dit dezelfde auto als in het rapport? Dan gelden ook de kentekengegevens (APK, tellerstand, recalls)
  // en is het cijfer exact gelijk aan het rapport met dezelfde vraagprijs en kilometerstand.
  const near = (a: number | null | undefined, b: number | undefined) => a != null && b != null && Math.abs(a - b) <= Math.max(1, b * 0.005);
  const isSame = (l: Listing) => !!ref.price && near(l.price, ref.price) && l.year === base.bouwjaar && (ref.km == null || near(l.mileage, ref.km));

  const graded = listings.map((l): GradedListing => {
    const effectivePrice = eff(l);
    if (isSame(l)) {
      const own = calcOwnership(ownershipFacts(base), defaultInputs(base, ownValue));
      const score = calcScore(bundle, market, own, { askingPrice: ref.price, mileage: ref.km, transmission: ref.transmission ?? undefined });
      return {
        ...l,
        grade: score.overall,
        gradeConfidence: score.confidenceLabel,
        effectivePrice,
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
    const km = l.mileage ?? undefined;
    const own = calcOwnership(ownershipFacts(vehicle), defaultInputs(vehicle, ownValue));
    const score = calcScore(b, market, own, { askingPrice: effectivePrice, mileage: km, transmission: l.transmissionGroup ?? undefined });

    const reasons: string[] = [];
    const flags: string[] = [];
    if (market) {
      const r = marketReference(market, km, year, now);
      const diff = effectivePrice - r.price;
      const incl = l.country === "DE" ? " (incl. import)" : "";
      if (r.method === "model") {
        reasons.push(Math.abs(diff) < r.price * 0.03 ? `rond de eerlijke prijs (${eur(r.price)})` : `${eur(Math.abs(diff))} ${diff > 0 ? "boven" : "onder"} de eerlijke prijs van ${eur(r.price)}${incl}`);
      } else {
        const pct = Math.round(Math.abs(effectivePrice / r.price - 1) * 100);
        const what = r.kmAdj !== 0 ? "de km-gecorrigeerde mediaan" : "de mediaan";
        reasons.push(pct < 3 ? `in lijn met ${what}` : `${pct}% ${diff > 0 ? "boven" : "onder"} ${what}${incl}`);
      }
      if (effectivePrice / r.price < 0.65) flags.push("Opvallend goedkoop: wees alert op fraude of verborgen gebreken");
    }
    if (ref.transmission && l.transmissionGroup && l.transmissionGroup !== ref.transmission) reasons.push(`andere transmissie (${l.transmissionGroup})`);
    if (l.mileage == null) flags.push("Kilometerstand onbekend");
    else if (year) {
      const age = Math.max(0.5, now.getFullYear() - year + 0.5);
      const ratio = l.mileage / (age * 15000);
      reasons.push(`${l.mileage.toLocaleString("nl-NL")} km = ${Math.round(ratio * 100)}% van verwachte stand`);
      if (ratio < 0.3 && age > 3) flags.push("Opvallend lage kilometerstand voor de leeftijd: controleer de tellerstand (NAP)");
      if (l.mileage < 1000 && age > 2) flags.push("Kilometerstand lijkt een invoerfout");
    }
    if (base.bouwjaar && year && year !== base.bouwjaar) reasons.push(`bouwjaar ${year} (gezocht ${base.bouwjaar})`);

    return { ...l, grade: score.overall, gradeConfidence: score.confidenceLabel, effectivePrice, gradeReasons: reasons, flags };
  });

  return graded.sort((a, b) => b.grade - a.grade);
}
