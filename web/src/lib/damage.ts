import type { Vehicle } from "./types";

/**
 * Schadecheck: wat de RDW-open data wél zegt over schade en blokkades, plus doorverwijzing voor de volledige
 * schadehistorie. Die historie (verzekeraars, schadeherstellers, buitenlandse registers) is niet openbaar en
 * alleen te koop per rapport. De WOK-status ("wachten op keuren") staat wel als veld in de open data, maar de
 * RDW verstrekt hem voor geen enkel voertuig ("Geen verstrekking in Open Data"); zie docs/DATA_SOURCES.md.
 */
export type SignalStatus = "ok" | "warn" | "bad" | "unknown";
export interface DamageSignal { id: string; label: string; status: SignalStatus; text: string }

const yn = (x: unknown) => (x === "Ja" ? true : x === "Nee" ? false : null);
const DAY = 86_400_000;

/** Kan de auto op naam worden gezet? (veld ontbreekt in oudere snapshots: dan uit de ruwe RDW-data) */
export const canRegister = (v: Vehicle): boolean | null => v.tenaamstellenMogelijk ?? yn(v.raw?.tenaamstellen_mogelijk);

/** Geïmporteerd: eerste toelating (ergens) ruim vóór de eerste tenaamstelling in Nederland. */
export function importInfo(v: Vehicle): { imported: boolean; months: number } | null {
  if (!v.eersteToelating || !v.eersteTenaamstellingNL) return null;
  const gap = (new Date(v.eersteTenaamstellingNL).getTime() - new Date(v.eersteToelating).getTime()) / DAY;
  return { imported: gap > 30, months: Math.max(0, Math.round(gap / 30.4)) };
}

export function damageSignals(v: Vehicle): DamageSignal[] {
  const reg = canRegister(v);
  const imp = importInfo(v);
  return [
    {
      id: "register",
      label: "Op naam te zetten",
      status: reg == null ? "unknown" : reg ? "ok" : "bad",
      text: reg == null ? "Niet bekend in de RDW-gegevens."
        : reg ? "Ja: er staat geen blokkade op het kenteken."
        : "Nee: het kenteken is geblokkeerd. Mogelijke oorzaken: schade (WOK-status), diefstal, export of sloop. Niet kopen voordat de verkoper dit met RDW-papieren oplost.",
    },
    {
      id: "import",
      label: "Import",
      status: imp == null ? "unknown" : imp.imported ? "warn" : "ok",
      text: imp == null ? "Datums onbekend."
        : imp.imported ? `Ja: ${imp.months >= 12 ? `${Math.round(imp.months / 12)} jaar` : `${imp.months} maanden`} in het buitenland gereden voor de eerste registratie in Nederland. Schade uit die periode is hier niet bekend.`
        : "Nee: sinds de eerste toelating in Nederland geregistreerd.",
    },
    {
      id: "taxi",
      label: "Taxi",
      status: v.taxi == null ? "unknown" : v.taxi ? "warn" : "ok",
      text: v.taxi ? "Ja: (eerder) als taxi geregistreerd; intensief gebruik en meer kans op schade." : v.taxi === false ? "Nee." : "Niet bekend.",
    },
    {
      id: "export",
      label: "Export",
      status: v.exportIndicator == null ? "unknown" : v.exportIndicator ? "bad" : "ok",
      text: v.exportIndicator ? "Ja: de auto staat geregistreerd voor export." : v.exportIndicator === false ? "Nee." : "Niet bekend.",
    },
    {
      id: "wok",
      label: "WOK-status (schadekeuring)",
      status: "unknown",
      text: "De RDW deelt deze status niet in de open data. Een geblokkeerde tenaamstelling hierboven kan erop wijzen; een betaald historierapport toont of de auto ooit WOK heeft gehad.",
    },
  ];
}

/** Betaalde bronnen voor de volledige schadehistorie (geen affiliate-links). */
export const HISTORY_PROVIDERS = [
  { name: "carVertical", url: "https://www.carvertical.com/nl", note: "schade, kilometers en foto's, ook uit buitenlandse registers" },
  { name: "Carscanner", url: "https://www.carscanner.nl/", note: "Nederlandse schade- en kilometerhistorie op kenteken" },
  { name: "AutoDNA", url: "https://www.autodna.com/", note: "Europese historie, sterk bij importauto's" },
] as const;
