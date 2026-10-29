/** Herkomst van een gegeven: nooit mengen van geverifieerd, geschat en ontbrekend. */
export type Provenance = "verified" | "estimate" | "unavailable" | "demo";

export interface SourceRef {
  id: string;
  name: string;
  url?: string;
  note?: string;
}

export interface SpecItem {
  label: string;
  value: string | null; // null = niet beschikbaar
  provenance: Provenance;
  source?: string;
}

export interface SpecCategory {
  id: string;
  title: string;
  items: SpecItem[];
  note?: string;
}

export interface Vehicle {
  kenteken: string;
  merk: string;
  model: string;
  uitvoering: string | null;
  voertuigsoort: string;
  inrichting: string | null;
  kleur: string | null;
  brandstoffen: string[];
  isElektrisch: boolean;
  isHybride: boolean;
  isDiesel: boolean;
  eersteToelating: string | null; // ISO
  eersteTenaamstellingNL: string | null;
  laatsteTenaamstelling: string | null;
  apkVervaldatum: string | null;
  bouwjaar: number | null;
  leeftijdMaanden: number | null;
  massaRijklaar: number | null;
  catalogusprijs: number | null;
  brutoBpm: number | null; // werkelijk betaalde bruto BPM (RDW)
  co2: number | null; // g/km gecombineerd
  verbruik: number | null; // l/100km gecombineerd
  elektrischVerbruik: number | null; // Wh/km
  vermogenKw: number | null;
  cilinderinhoud: number | null;
  cilinders: number | null;
  exportIndicator: boolean | null;
  taxi: boolean | null;
  wamVerzekerd: boolean | null;
  openRecall: boolean | null;
  raw: Record<string, unknown>;
}

export interface Inspection {
  date: string; // ISO
  type: string;
  expires: string | null;
  defects: { code: string; description: string; count: number }[];
}

export interface Recall {
  code: string;
  statusCode: string;
  status: string;
}

export interface OdometerInfo {
  verdict: "Logisch" | "Onlogisch" | "Onbekend";
  lastYear: number | null;
  explanation: string;
}

export interface RdwBundle {
  vehicle: Vehicle;
  fuels: Record<string, string>[];
  axles: Record<string, string>[];
  inspections: Inspection[];
  recalls: Recall[];
  odometer: OdometerInfo;
  fetchedAt: string;
}

export type TransmissionGroup = "handgeschakeld" | "automaat";

export interface UserInputs {
  askingPrice?: number;
  mileage?: number;
  transmission?: TransmissionGroup; // ingevoerd door de gebruiker; niet in de RDW-open data
}

export interface TimelineEvent {
  date: string;
  title: string;
  detail?: string;
  tone: "neutral" | "good" | "warn" | "bad";
  provenance: Provenance;
}

export interface Listing {
  id: string;
  platform: "Marktplaats" | "AutoScout24.nl" | "AutoScout24.de" | "mobile.de";
  country: "NL" | "DE";
  title: string;
  price: number;
  mileage: number | null;
  year: number | null;
  fuel: string | null;
  fuelGroup?: string | null;
  body?: string | null;
  transmission: string | null;
  transmissionGroup?: TransmissionGroup | null;
  power: string | null;
  powerKw?: number | null;
  /** Reden waarom de advertentie geen eerlijke marktprijs is (schade, export, ...); null = normaal */
  noise?: string | null;
  location: string | null;
  url: string;
  image?: string | null;
  provenance: Provenance;
}

export interface GradedListing extends Listing {
  grade: number; // 1..10, zelfde schaal en engine als het rapport op kenteken
  sameAsReport?: boolean;
  gradeConfidence: "Hoog" | "Gemiddeld" | "Laag";
  effectivePrice: number; // NL: vraagprijs; DE: vraagprijs + importkosten
  gradeReasons: string[];
  flags: string[];
  /** Niet meegeteld in mediaan, bandbreedte en eerlijke prijs, met reden */
  excluded?: string;
}

/** Vraagprijzen van vergelijkbare advertenties: mediaan en de middelste 50% (P25–P75). */
export interface PriceBand {
  count: number;
  median: number;
  low: number;
  high: number;
  min: number;
  max: number;
  medianKm: number | null;
}

export interface BpmTariff {
  grossBpm: number;
  depreciationPct: number;
  netBpm: number;
  dieselSurcharge: number;
  steps: { label: string; amount: number }[];
}

export interface BpmResult {
  /** Werkelijk betaalde bruto BPM bij eerste registratie (RDW `bruto_bpm`), null als niet geregistreerd */
  paid: number | null;
  /** Restant van de betaalde BPM nu, na forfaitaire afschrijving (wat bij export teruggevraagd kan worden, indicatie) */
  paidRemaining: number | null;
  /** Wat dezelfde auto vandaag zou kosten volgens de huidige tarieven; null zonder CO2-gegevens */
  tariff: BpmTariff | null;
  ageMonths: number;
  assumptions: string[];
}

export interface ImportCostResult {
  purchasePrice: number;
  bpm: number;
  transport: number;
  rdwKeuring: number;
  registration: number;
  total: number;
  nlMarketMid: number | null;
  saving: number | null;
  lines: { label: string; amount: number; note?: string }[];
  assumptions: string[];
}

export interface ScoreComponent {
  id: string;
  label: string;
  weight: number;
  score: number | null; // 1..10, null = geen data
  reasons: string[];
}

export interface ScoreResult {
  overall: number;
  confidence: number; // 0..1, aandeel van gewicht dat met data is onderbouwd
  confidenceLabel: "Hoog" | "Gemiddeld" | "Laag";
  components: ScoreComponent[];
  risks: { level: "high" | "medium" | "low"; text: string }[];
  checks: string[];
}

export type BodyGroup = "hatchback" | "stationwagon" | "sedan" | "suv" | "mpv" | "coupe" | "cabrio";
export type FuelGroup = "benzine" | "diesel" | "hybride" | "elektrisch";

export interface ListingFilters {
  yearFrom: number | null;
  yearTo: number | null;
  kmFrom: number | null;
  kmTo: number | null;
  body: BodyGroup | null; // null = alle
  fuel: FuelGroup | null; // null = alle
  transmission: TransmissionGroup | null; // null = alle
  pkFrom: number | null;
  pkTo: number | null;
  priceFrom: number | null; // vraagprijs in euro
  priceTo: number | null;
}
