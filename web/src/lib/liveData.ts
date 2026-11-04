/**
 * Gratis publieke referentiedata (CBS) met vaste terugvalwaarden. De rekenkernen lezen dit synchroon;
 * providers/cbs.ts ververst het op de server (gecachet). Zonder netwerk gelden de waarden hieronder.
 */

/** Pompprijzen €/l (CBS 80416ned) en een vaste stroomprijs €/kWh (geen CBS-reeks). */
export interface FuelPrices { benzine: number; diesel: number; lpg: number; elektrisch: number; date: string; source: "cbs" | "fallback" }

/** Gemiddeld jaarkilometrage van particuliere auto's per leeftijd 0..8 en 9+ jaar (CBS 85404NED). */
export interface KmNorms { period: string; benzine: number[]; diesel: number[]; lpg: number[]; source: "cbs" | "fallback" }

// CBS 80416ned, 26-10-2026
export const FALLBACK_FUEL: FuelPrices = { benzine: 2.313, diesel: 2.469, lpg: 0.997, elektrisch: 0.32, date: "2026-10-26", source: "fallback" };

// CBS 85404NED, 2024, particulier ("Benzine/overige", "Diesel", "LPG"); index = leeftijd in jaren, laatste = 9+
export const FALLBACK_KM: KmNorms = {
  period: "2024",
  benzine: [7524, 13260, 13302, 13108, 12993, 12950, 12465, 12167, 11841, 9604],
  diesel: [6943, 11244, 11763, 12353, 15511, 20291, 21688, 21395, 20384, 15576],
  lpg: [10021, 19354, 18371, 18141, 18047, 19338, 19370, 18641, 18394, 12091],
  source: "fallback",
};

const state = { fuel: FALLBACK_FUEL, km: FALLBACK_KM };

export const fuelPricesNow = () => state.fuel;
export const kmNormsNow = () => state.km;
export function setLiveData(d: { fuel?: FuelPrices; km?: KmNorms }) {
  if (d.fuel) state.fuel = d.fuel;
  if (d.km) state.km = d.km;
}
