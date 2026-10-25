import type { ImportCostResult, ValuationResult, Vehicle } from "../types";
import { calcBpm } from "./bpm";

/**
 * Deterministische waardeschatting. Er is geen live marktdata beschikbaar zonder commerciële
 * API's (zie docs/DATA_SOURCES.md); daarom wordt de waarde afgeleid van de catalogusprijs
 * (RDW), leeftijd en kilometerstand. Dit is een SCHATTING, geen taxatie.
 */
export const EXPECTED_KM_PER_YEAR = 15000;
/** Aanname: vergelijkbare auto's staan in Duitsland gemiddeld lager geprijsd dan in NL. */
export const DE_PRICE_FACTOR = 0.92;

export function residualFactor(ageYears: number): number {
  return 0.88 * Math.exp(-0.13 * Math.max(0, ageYears));
}

export function estimateValue(v: Vehicle, mileage: number | undefined, country: "NL" | "DE"): ValuationResult {
  const assumptions: string[] = [];
  if (!v.catalogusprijs || v.catalogusprijs <= 0 || v.leeftijdMaanden == null) {
    return {
      country, low: null, mid: null, high: null, provenance: "unavailable",
      method: "Geen catalogusprijs of leeftijd beschikbaar in het RDW-register; waarde niet te schatten.",
      assumptions: ["Voer een vraagprijs en vergelijkbare advertenties handmatig in voor een betere inschatting."],
    };
  }
  const age = v.leeftijdMaanden / 12;
  let value = v.catalogusprijs * residualFactor(age);
  assumptions.push(`Catalogusprijs € ${v.catalogusprijs.toLocaleString("nl-NL")} (RDW) × restwaardefactor ${(residualFactor(age) * 100).toFixed(0)}% bij ${age.toFixed(1)} jaar.`);

  let spread = 0.15;
  if (mileage != null) {
    const expected = Math.max(age, 0.25) * EXPECTED_KM_PER_YEAR;
    const delta = (mileage - expected) / 10000; // per 10.000 km afwijking
    const adj = Math.max(-0.2, Math.min(0.2, -delta * 0.035));
    value *= 1 + adj;
    spread = 0.1;
    assumptions.push(`Kilometerstand ${mileage.toLocaleString("nl-NL")} km t.o.v. verwacht ${Math.round(expected).toLocaleString("nl-NL")} km: ${(adj * 100).toFixed(1)}% correctie.`);
  } else {
    assumptions.push("Kilometerstand onbekend: gemiddelde jaarkilometrage (15.000 km) verondersteld; bredere bandbreedte.");
  }
  if (country === "DE") {
    value *= DE_PRICE_FACTOR;
    assumptions.push(`Duitse marktprijs aangenomen op ${Math.round(DE_PRICE_FACTOR * 100)}% van het Nederlandse niveau (schatting; geen live data).`);
  }
  const round = (n: number) => Math.round(n / 50) * 50;
  return {
    country, provenance: "estimate",
    low: round(value * (1 - spread)), mid: round(value), high: round(value * (1 + spread)),
    method: "Afschrijvingsmodel op basis van catalogusprijs, leeftijd en kilometerstand.",
    assumptions,
  };
}

/** Importkosten van een Duitse auto naar Nederland (indicatief). */
export function estimateImport(v: Vehicle, dePrice: number, nlMid: number | null): ImportCostResult | null {
  const tariff = calcBpm(v).tariff;
  if (!tariff) return null;
  const transport = 600;
  const rdwKeuring = 150;
  const registration = 120;
  const total = dePrice + tariff.netBpm + transport + rdwKeuring + registration;
  return {
    purchasePrice: dePrice,
    bpm: tariff.netBpm,
    transport,
    rdwKeuring,
    registration,
    total,
    nlMarketMid: nlMid,
    saving: nlMid != null ? nlMid - total : null,
    lines: [
      { label: "Aankoopprijs Duitsland", amount: dePrice, note: "Geschatte marktprijs of ingevoerde prijs" },
      { label: "BPM (na forfaitaire afschrijving)", amount: tariff.netBpm, note: "Zie BPM-sectie" },
      { label: "Transport / overschrijving", amount: transport, note: "Indicatie; trailer, tijdelijke Duitse kentekens, reiskosten" },
      { label: "RDW-keuring (import)", amount: rdwKeuring, note: "Indicatie; tarief verschilt per keuringsstation" },
      { label: "Registratie, kentekenplaten & overig", amount: registration, note: "Indicatie" },
    ],
    assumptions: [
      "Aangenomen: gebruikte auto uit een EU-land, waarbij BTW al in de prijs is inbegrepen (margeregeling of particuliere verkoop).",
      "Nieuwe auto's (<6 maanden of <6.000 km) vallen onder andere BTW-regels; dat is niet meegenomen.",
      "Bedragen voor transport, keuring en registratie zijn gemiddelden; vraag offertes aan.",
    ],
  };
}
