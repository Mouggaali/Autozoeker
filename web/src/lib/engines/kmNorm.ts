import type { KmNorms } from "../liveData";
import type { Vehicle } from "../types";

/**
 * Kilometerstand tegenover het CBS-gemiddelde voor particuliere auto's van dezelfde brandstof en leeftijd.
 * CBS "0 jaar oud" is een deeljaar (auto's die dat jaar zijn ingeschreven); het eerste volle jaar van een auto
 * rekenen we daarom met "1 jaar oud", enzovoort; vanaf 9 jaar met "9 jaar of ouder".
 */
export type KmLevel = "laag" | "normaal" | "hoog" | "zeer hoog";
export interface KmVerdict { level: KmLevel; ratio: number; perYear: number; expected: number; expectedPerYear: number; fuel: string }

export const normFuel = (v: Vehicle): "benzine" | "diesel" | "lpg" =>
  v.isDiesel ? "diesel" : v.brandstoffen.some((b) => /lpg/i.test(b)) ? "lpg" : "benzine";

/** Verwacht totaal aantal km na `ageYears` jaar. */
export function expectedKm(norms: KmNorms, fuel: "benzine" | "diesel" | "lpg", ageYears: number): number {
  const row = norms[fuel];
  let total = 0;
  for (let i = 0; i < ageYears; i++) total += row[Math.min(i + 1, row.length - 1)] * Math.min(1, ageYears - i);
  return Math.round(total);
}

export function kmVerdict(v: Vehicle, km: number, norms: KmNorms): KmVerdict | null {
  const age = (v.leeftijdMaanden ?? 0) / 12;
  if (!(km > 0) || age < 1) return null;
  const fuel = normFuel(v);
  const expected = expectedKm(norms, fuel, age);
  const ratio = km / expected;
  const level: KmLevel = ratio < 0.6 ? "laag" : ratio > 1.8 ? "zeer hoog" : ratio > 1.4 ? "hoog" : "normaal";
  return { level, ratio, perYear: Math.round(km / age), expected, expectedPerYear: Math.round(expected / age), fuel };
}
