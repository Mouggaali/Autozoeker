import type { RdwBundle } from "./types";

/**
 * Toegang tot milieuzones, op basis van de RDW-emissieklasse. Regels volgens milieuzones.nl (gelezen 4-11-2026):
 * alleen diesel-personenauto's zijn beperkt; Den Haag ("groen") vanaf emissieklasse 4, Amsterdam, Arnhem en
 * Utrecht ("blauw") vanaf emissieklasse 5. Benzine, lpg en elektrisch mogen overal in. Regels kunnen per stad
 * veranderen; daarom altijd de link naar de officiële kentekencheck tonen.
 */
export const MILIEUZONE_CHECK_URL = "https://www.milieuzones.nl/check";
export const MILIEUZONE_PEILDATUM = "4 november 2026";

const BLUE = ["Amsterdam", "Arnhem", "Utrecht"];
const GREEN = ["Den Haag"];

export interface MilieuzoneAccess {
  /** null = onbekend */
  emissionClass: number | null;
  diesel: boolean;
  allowed: string[];
  denied: string[];
  summary: string;
}

export function milieuzoneAccess(b: RdwBundle): MilieuzoneAccess {
  const diesel = b.vehicle.isDiesel;
  const raw = b.fuels.map((f) => String(f.emissiecode_omschrijving ?? "").trim()).find((x) => /^\d$/.test(x));
  const emissionClass = raw != null ? Number(raw) : null;
  const all = [...BLUE, ...GREEN];
  if (!diesel) return { emissionClass, diesel, allowed: all, denied: [], summary: "Geen diesel: toegang tot alle milieuzones." };
  if (emissionClass == null) return { emissionClass, diesel, allowed: [], denied: [], summary: "Diesel met onbekende emissieklasse: controleer de toegang op milieuzones.nl." };
  const denied = emissionClass >= 5 ? [] : emissionClass === 4 ? BLUE : all;
  const allowed = all.filter((c) => !denied.includes(c));
  const summary = denied.length === 0
    ? `Diesel emissieklasse ${emissionClass}: toegang tot alle milieuzones.`
    : `Diesel emissieklasse ${emissionClass}: niet toegestaan in de milieuzone van ${denied.join(", ").replace(/, ([^,]*)$/, " en $1")}.`;
  return { emissionClass, diesel, allowed, denied, summary };
}
