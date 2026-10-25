import type { Vehicle } from "../types";
import { CITIES, DEFAULT_CITY } from "./cities";

export type InsuranceType = "wa" | "wa-beperkt" | "allrisk";

export interface OwnershipInputs {
  city: string;
  kmPerYear: number;
  fuelPrice: number; // €/l (brandstof) of €/kWh (elektrisch)
  insurance: InsuranceType;
  extraParkingPerMonth: number; // overschrijft stad-indicatie als > 0
  useCityParking: boolean;
  financingPrincipal: number;
  financingRatePct: number;
  financingMonths: number;
  /** huidige marktwaarde, gebruikt voor afschrijving en verzekering */
  currentValue: number;
  includeOptional: { tires: boolean; wash: boolean };
}

export interface OwnershipLine {
  id: string;
  label: string;
  perYear: number;
  note: string;
}

export interface OwnershipResult {
  lines: OwnershipLine[];
  perYear: number;
  perMonth: number;
  perKm: number;
}

export interface OwnershipVehicleFacts {
  mass: number;
  ageYears: number;
  fuelType: "benzine" | "diesel" | "elektrisch" | "hybride";
  consumption: number; // l/100km of kWh/100km
  power: number | null;
  isElectric: boolean;
}

export function ownershipFacts(v: Vehicle): OwnershipVehicleFacts {
  const fuelType = v.isElektrisch ? "elektrisch" : v.isHybride ? "hybride" : v.isDiesel ? "diesel" : "benzine";
  const consumption = v.isElektrisch
    ? (v.elektrischVerbruik ?? 170) / 10 // Wh/km → kWh/100km
    : (v.verbruik ?? (v.isDiesel ? 5.5 : 7));
  return {
    mass: v.massaRijklaar ?? 1400,
    ageYears: (v.leeftijdMaanden ?? 60) / 12,
    fuelType,
    consumption,
    power: v.vermogenKw,
    isElectric: v.isElektrisch,
  };
}

export const DEFAULT_FUEL_PRICE = { benzine: 2.1, diesel: 1.85, elektrisch: 0.32, hybride: 2.1 } as const;

const MRB_PETROL: [number, number][] = [
  [600, 100], [800, 180], [1000, 290], [1200, 420], [1500, 640], [1800, 880], [2200, 1250], [3000, 2000],
];
function interp(points: [number, number][], x: number) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

/** Indicatieve MRB per jaar. Zie docs/DATA_SOURCES.md voor aannames. */
export const MRB_EV_FACTOR = 0.25; // aanname: kwarttarief; controleer actuele regeling
export function estimateMrb(f: OwnershipVehicleFacts, cityFactor: number): number {
  const base = interp(MRB_PETROL, f.mass);
  const typeFactor =
    f.fuelType === "diesel" ? 1.55 : f.fuelType === "elektrisch" ? MRB_EV_FACTOR : f.fuelType === "hybride" ? 0.9 : 1;
  return base * typeFactor * cityFactor;
}

export function defaultInputs(v: Vehicle, currentValue: number | null): OwnershipInputs {
  const f = ownershipFacts(v);
  return {
    city: DEFAULT_CITY,
    kmPerYear: 15000,
    fuelPrice: DEFAULT_FUEL_PRICE[f.fuelType],
    insurance: f.ageYears > 8 ? "wa-beperkt" : "allrisk",
    extraParkingPerMonth: 0,
    useCityParking: false,
    financingPrincipal: 0,
    financingRatePct: 7.5,
    financingMonths: 60,
    currentValue: currentValue ?? Math.round((20000 * 0.88 * Math.exp(-0.13 * f.ageYears)) / 50) * 50,
    includeOptional: { tires: true, wash: false },
  };
}

export function calcOwnership(f: OwnershipVehicleFacts, i: OwnershipInputs): OwnershipResult {
  const city = CITIES.find((c) => c.name === i.city) ?? CITIES[3];
  const lines: OwnershipLine[] = [];
  const km = Math.max(0, i.kmPerYear);

  lines.push({
    id: "mrb",
    label: "Motorrijtuigenbelasting (MRB)",
    perYear: estimateMrb(f, city.mrbFactor),
    note: `Indicatie o.b.v. gewicht ${f.mass} kg, brandstof en provincie ${city.province}.`,
  });

  lines.push({
    id: "fuel",
    label: f.isElectric ? "Elektriciteit" : "Brandstof",
    perYear: (km / 100) * f.consumption * i.fuelPrice,
    note: `${f.consumption.toFixed(1)} ${f.isElectric ? "kWh" : "l"}/100 km × ${i.fuelPrice.toFixed(2)} €/${f.isElectric ? "kWh" : "l"} (fabrieksverbruik; praktijk is vaak 10–25% hoger).`,
  });

  const rate = { wa: 0.016, "wa-beperkt": 0.027, allrisk: 0.043 }[i.insurance];
  const insurance = Math.max(i.insurance === "wa" ? 380 : 480, i.currentValue * rate + 250) * city.insuranceFactor;
  const insLabel = i.insurance === "wa" ? "WA" : i.insurance === "wa-beperkt" ? "WA + beperkt casco" : "allrisk";
  lines.push({
    id: "insurance",
    label: "Autoverzekering",
    perYear: insurance,
    note: `Schatting voor ${insLabel} in ${city.name}; vraag altijd een echte offerte.`,
  });

  const ageFactor = 1 + Math.min(f.ageYears, 15) * 0.07;
  const maint =
    (f.isElectric ? 0.045 : 0.07) * Math.max(km, 8000) * ageFactor * (f.mass > 1700 ? 1.2 : 1) * 0.55 + 250;
  lines.push({ id: "maintenance", label: "Onderhoud", perYear: maint, note: "Indicatie op basis van leeftijd, gewicht en jaarkilometrage." });

  const repairs = (f.ageYears < 3 ? 100 : 150 + f.ageYears * 55) * (f.isElectric ? 0.8 : 1) * (f.mass > 1700 ? 1.2 : 1);
  lines.push({ id: "repairs", label: "Reparaties (reservering)", perYear: repairs, note: "Voorziening voor onverwachte defecten; stijgt met leeftijd." });

  lines.push({
    id: "apk",
    label: "APK",
    perYear: f.ageYears < 4 ? 0 : 50,
    note: "Circa € 50 per keuring; eerste keuring bij 4 jaar (benzine/diesel), daarna tweejaarlijks tot 8 jaar en jaarlijks daarna.",
  });

  const deprRate = f.ageYears < 3 ? 0.14 : f.ageYears < 8 ? 0.1 : 0.07;
  lines.push({
    id: "depreciation",
    label: "Waardevermindering",
    perYear: i.currentValue * deprRate,
    note: `${(deprRate * 100).toFixed(0)}% van de huidige waarde per jaar (schatting).`,
  });

  if (i.includeOptional.tires)
    lines.push({ id: "tires", label: "Banden", perYear: (km / 40000) * (350 + f.mass * 0.25), note: "Set banden per ~40.000 km." });
  if (i.includeOptional.wash) lines.push({ id: "wash", label: "Wassen & verzorging", perYear: 120, note: "Optioneel." });

  const parking = i.extraParkingPerMonth > 0 ? i.extraParkingPerMonth : i.useCityParking ? city.parkingPerMonth : 0;
  if (parking > 0)
    lines.push({
      id: "parking",
      label: "Parkeren",
      perYear: parking * 12,
      note: i.extraParkingPerMonth > 0 ? "Zelf ingevuld." : `Indicatie parkeervergunning ${city.name}.`,
    });

  if (i.financingPrincipal > 0 && i.financingMonths > 0) {
    const r = i.financingRatePct / 100 / 12;
    const n = i.financingMonths;
    const pay = r === 0 ? i.financingPrincipal / n : (i.financingPrincipal * r) / (1 - Math.pow(1 + r, -n));
    const interest = pay * n - i.financingPrincipal;
    lines.push({
      id: "financing",
      label: "Financiering (rente)",
      perYear: interest / (n / 12),
      note: `Annuïteit ${pay.toFixed(0)} €/mnd; alleen rentekosten tellen mee (aflossing is vermogen).`,
    });
  }

  const rounded = lines.map((l) => ({ ...l, perYear: Math.round(l.perYear) }));
  const perYear = rounded.reduce((s, l) => s + l.perYear, 0);
  return { lines: rounded, perYear, perMonth: perYear / 12, perKm: km > 0 ? perYear / km : 0 };
}
