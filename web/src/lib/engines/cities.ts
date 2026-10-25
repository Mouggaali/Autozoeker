/**
 * Indicatieve regiofactoren. Opcenten MRB verschillen per provincie, verzekeringspremies
 * per postcodegebied en parkeervergunningen per gemeente. Waarden zijn schattingen,
 * geen officiële tarieven.
 */
export interface City {
  name: string;
  province: string;
  /** Provinciale opcenten t.o.v. landelijk gemiddelde (1 = gemiddeld) */
  mrbFactor: number;
  /** Verzekeringsfactor t.o.v. landelijk gemiddelde */
  insuranceFactor: number;
  /** Indicatie parkeervergunning per maand in €, 0 = meestal geen betaald parkeren */
  parkingPerMonth: number;
}

export const CITIES: City[] = [
  { name: "Amsterdam", province: "Noord-Holland", mrbFactor: 1.0, insuranceFactor: 1.25, parkingPerMonth: 25 },
  { name: "Rotterdam", province: "Zuid-Holland", mrbFactor: 1.02, insuranceFactor: 1.2, parkingPerMonth: 20 },
  { name: "Den Haag", province: "Zuid-Holland", mrbFactor: 1.02, insuranceFactor: 1.15, parkingPerMonth: 18 },
  { name: "Utrecht", province: "Utrecht", mrbFactor: 0.97, insuranceFactor: 1.05, parkingPerMonth: 22 },
  { name: "Eindhoven", province: "Noord-Brabant", mrbFactor: 1.0, insuranceFactor: 1.0, parkingPerMonth: 10 },
  { name: "Groningen", province: "Groningen", mrbFactor: 1.06, insuranceFactor: 0.9, parkingPerMonth: 12 },
  { name: "Tilburg", province: "Noord-Brabant", mrbFactor: 1.0, insuranceFactor: 0.97, parkingPerMonth: 5 },
  { name: "Almere", province: "Flevoland", mrbFactor: 1.08, insuranceFactor: 1.05, parkingPerMonth: 0 },
  { name: "Breda", province: "Noord-Brabant", mrbFactor: 1.0, insuranceFactor: 0.97, parkingPerMonth: 8 },
  { name: "Nijmegen", province: "Gelderland", mrbFactor: 1.05, insuranceFactor: 0.97, parkingPerMonth: 14 },
  { name: "Arnhem", province: "Gelderland", mrbFactor: 1.05, insuranceFactor: 0.98, parkingPerMonth: 12 },
  { name: "Enschede", province: "Overijssel", mrbFactor: 1.02, insuranceFactor: 0.88, parkingPerMonth: 4 },
  { name: "Maastricht", province: "Limburg", mrbFactor: 1.04, insuranceFactor: 0.95, parkingPerMonth: 15 },
  { name: "Leeuwarden", province: "Friesland", mrbFactor: 1.06, insuranceFactor: 0.85, parkingPerMonth: 6 },
  { name: "Zwolle", province: "Overijssel", mrbFactor: 1.02, insuranceFactor: 0.88, parkingPerMonth: 6 },
  { name: "Haarlem", province: "Noord-Holland", mrbFactor: 1.0, insuranceFactor: 1.1, parkingPerMonth: 20 },
  { name: "Middelburg", province: "Zeeland", mrbFactor: 1.03, insuranceFactor: 0.85, parkingPerMonth: 0 },
  { name: "Assen", province: "Drenthe", mrbFactor: 1.05, insuranceFactor: 0.85, parkingPerMonth: 0 },
];
export const DEFAULT_CITY = "Utrecht";
