import type { Provenance, Vehicle } from "../types";

export interface RegistrationPeriod {
  id: string;
  label: string;
  from: string | null; // ISO
  to: string | null; // ISO, null = loopt nog
  days: number | null;
  provenance: Provenance; // verified = datums direct uit RDW; estimate = afgeleid/berekend
  note: string;
}

export interface UnavailableItem {
  label: string;
  reason: string;
}

export interface RegistrationHistory {
  periods: RegistrationPeriod[];
  unavailable: UnavailableItem[];
  transferDetected: boolean | null; // null = onbekend
  minKeepers: number | null; // ondergrens aantal houders sinds eerste Nederlandse tenaamstelling; het werkelijke aantal is niet openbaar
}

const DAY = 86400000;
const diffDays = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY));

export const fmtDuration = (days: number | null) => {
  if (days == null) return "onbekend";
  if (days < 61) return `${days} dagen`;
  const m = Math.round(days / 30.44);
  if (m < 24) return `${m} maanden`;
  const y = Math.floor(m / 12);
  const rest = m % 12;
  return rest ? `${y} jaar en ${rest} maanden` : `${y} jaar`;
};

/**
 * Registratiehistorie uitsluitend op basis van de datums die RDW openbaar maakt in
 * `Gekentekende_voertuigen` (m9d7-ebf2): datum_eerste_toelating, datum_eerste_tenaamstelling_in_nederland
 * en datum_tenaamstelling (laatste tenaamstelling). RDW publiceert GEEN eerdere tenaamstellingen,
 * type houder (particulier/zakelijk/lease) of bedrijfsvoorraad; die onderdelen staan daarom als "niet beschikbaar".
 */
export function registrationHistory(v: Vehicle, now = new Date()): RegistrationHistory {
  const today = now.toISOString().slice(0, 10);
  const periods: RegistrationPeriod[] = [];
  const { eersteToelating: first, eersteTenaamstellingNL: firstNl, laatsteTenaamstelling: last } = v;

  if (first && firstNl && firstNl > first) {
    periods.push({
      id: "pre-nl",
      label: "Voor eerste tenaamstelling in Nederland",
      from: first,
      to: firstNl,
      days: diffDays(first, firstNl),
      provenance: "estimate",
      note: "Eerste toelating (mogelijk in het buitenland of op een tijdelijke registratie) tot eerste Nederlandse tenaamstelling. Duur is berekend uit twee RDW-datums; wat er in die periode gebeurde, is niet openbaar.",
    });
  }

  const start = firstNl ?? first;
  let transferDetected: boolean | null = null;
  if (start && last) {
    transferDetected = last > start;
    if (transferDetected) {
      periods.push({
        id: "earlier",
        label: "Eerdere houder(s) in Nederland (aantal onbekend)",
        from: start,
        to: last,
        days: diffDays(start, last),
        provenance: "estimate",
        note: "De tenaamstelling is na de eerste Nederlandse tenaamstelling gewijzigd, dus er is minstens één overdracht geweest. RDW toont geen tussenliggende tenaamstellingen: dit kan één of meerdere houders (bijv. een handelaar) omvatten. De totale duur is berekend.",
      });
    }
  }

  if (last) {
    periods.push({
      id: "current",
      label: transferDetected === false ? "Eerste en huidige houder" : "Huidige houder",
      from: last,
      to: null,
      days: diffDays(last, today),
      provenance: "estimate",
      note: "Startdatum is de laatste tenaamstelling uit het RDW-register (verified); de duur tot vandaag is berekend. Naam en type houder zijn niet openbaar.",
    });
  }

  return {
    periods,
    transferDetected,
    minKeepers: transferDetected == null ? null : transferDetected ? 2 : 1,
    unavailable: [
      { label: "Exact aantal eigenaren/houders", reason: "Geen enkele RDW-dataset bevat een aantal eigenaren (alle 34 open datasets gecontroleerd). Sites die dit tonen gebruiken andere, vaak niet-openbare bronnen of schatten het." },
      { label: "Type houder (particulier / zakelijk / lease)", reason: "RDW Open Data bevat geen gegevens over het type houder." },
      { label: "Eerdere tenaamstellingen en overdrachtsdata", reason: "Alleen de eerste en de laatste tenaamstelling zijn openbaar; tussenliggende overdrachten niet." },
      { label: "Bedrijfsvoorraad (handelaarsvoorraad) in- en uitstroom", reason: "Er is geen openbaar veld of dataset met bedrijfsvoorraad-registraties." },
      { label: "Statijd bij een handelaar", reason: "Zonder in- en uitstroomdata van bedrijfsvoorraad kan de statijd niet worden berekend." },
    ],
  };
}
