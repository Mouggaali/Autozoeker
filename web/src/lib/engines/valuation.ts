import type { ImportCostResult, Vehicle } from "../types";
import { calcBpm } from "./bpm";

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
      { label: "Aankoopprijs Duitsland", amount: dePrice, note: "Mediaan vraagprijs van vergelijkbare Duitse advertenties" },
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
