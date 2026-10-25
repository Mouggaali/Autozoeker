import type { BpmResult, BpmTariff, Vehicle } from "../types";

/**
 * BPM-tarieven 2026 (personenauto's, o.b.v. CO₂ WLTP).
 * Bron voor schijven/vaste voeten: openbare samenvattingen van het Belastingplan 2026
 * (VNA, Rekenmachinepro). LET OP: nog niet gecontroleerd tegen de officiële Belastingdienst-tabel.
 * Pas deze constanten aan bij wijziging van de wetgeving.
 */
export const BPM_YEAR = 2026;
export const BPM_TRANCHES = [
  { upTo: 77, perGram: 2 },
  { upTo: 100, perGram: 82 },
  { upTo: 139, perGram: 181 },
  { upTo: 155, perGram: 297 },
  { upTo: Infinity, perGram: 594 },
];
export const BPM_BASE = 687;
export const DIESEL_SURCHARGE_PER_GRAM = 114.83;
export const DIESEL_SURCHARGE_THRESHOLD = 69;

/** Benadering van de Belastingdienst-koerslijst (afschrijving bruto BPM naar leeftijd). */
const DEPRECIATION: [months: number, pct: number][] = [
  [0, 0], [3, 0.1], [12, 0.27], [24, 0.42], [36, 0.53], [60, 0.67],
  [84, 0.77], [120, 0.85], [180, 0.91], [240, 0.94],
];

export function depreciationPct(months: number): number {
  if (months <= 0) return 0;
  for (let i = 1; i < DEPRECIATION.length; i++) {
    const [m1, p1] = DEPRECIATION[i];
    const [m0, p0] = DEPRECIATION[i - 1];
    if (months <= m1) return p0 + ((p1 - p0) * (months - m0)) / (m1 - m0);
  }
  return DEPRECIATION[DEPRECIATION.length - 1][1];
}

export function grossBpm(co2: number, diesel: boolean) {
  const steps: { label: string; amount: number }[] = [{ label: "Basisbedrag", amount: BPM_BASE }];
  let prev = 0;
  for (const t of BPM_TRANCHES) {
    const grams = Math.max(0, Math.min(co2, t.upTo) - prev);
    if (grams > 0) steps.push({ label: `${grams} g/km × €${t.perGram}`, amount: grams * t.perGram });
    prev = t.upTo;
    if (co2 <= t.upTo) break;
  }
  let surcharge = 0;
  if (diesel && co2 > DIESEL_SURCHARGE_THRESHOLD) {
    surcharge = (co2 - DIESEL_SURCHARGE_THRESHOLD) * DIESEL_SURCHARGE_PER_GRAM;
    steps.push({ label: `Dieseltoeslag ${co2 - DIESEL_SURCHARGE_THRESHOLD} g/km × €${DIESEL_SURCHARGE_PER_GRAM}`, amount: surcharge });
  }
  const gross = steps.reduce((s, x) => s + x.amount, 0);
  return { gross, surcharge, steps };
}

export function calcBpm(v: Vehicle, ageMonths?: number): BpmResult {
  const months = ageMonths ?? v.leeftijdMaanden ?? 0;
  const dep = depreciationPct(months);
  const paid = v.brutoBpm && v.brutoBpm > 0 ? v.brutoBpm : null;
  const assumptions: string[] = [];

  if (paid != null) {
    assumptions.push("De betaalde bruto BPM komt uit het RDW-kentekenregister (veld bruto_bpm) en is het bedrag dat bij de eerste registratie is vastgesteld, volgens de tarieven van dat jaar.");
    assumptions.push(`De restant-BPM is een indicatie: bruto BPM minus ${(dep * 100).toFixed(0)}% forfaitaire afschrijving bij ${months} maanden (benadering van de koerslijst van de Belastingdienst).`);
  } else {
    assumptions.push("In het RDW-register staat geen bruto BPM voor dit voertuig (bijvoorbeeld elektrisch, van vóór de BPM-registratie, of geïmporteerd met een afwijkende vaststelling).");
  }

  let tariff: BpmTariff | null = null;
  if (v.co2 != null || v.isElektrisch) {
    const co2 = v.isElektrisch ? 0 : v.co2!;
    const { gross, surcharge, steps } = grossBpm(co2, v.isDiesel && !v.isHybride);
    tariff = {
      grossBpm: Math.round(gross),
      depreciationPct: dep,
      netBpm: Math.round(gross * (1 - dep)),
      dieselSurcharge: Math.round(surcharge),
      steps: steps.map((s) => ({ ...s, amount: Math.round(s.amount) })),
    };
    assumptions.push(`Ter vergelijking: tarieven ${BPM_YEAR} voor ${co2} g/km (WLTP). Dit is alleen relevant bij import van een vergelijkbare auto en is nog niet gecontroleerd tegen de officiële tabel van de Belastingdienst.`);
  }
  assumptions.push("Controleer het definitieve bedrag altijd met de BPM-calculator van de Belastingdienst.");
  return { paid, paidRemaining: paid != null ? Math.round(paid * (1 - dep)) : null, tariff, ageMonths: months, assumptions };
}
