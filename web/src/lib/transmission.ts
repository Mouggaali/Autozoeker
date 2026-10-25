import type { TransmissionGroup, Vehicle } from "./types";

export const TRANSMISSIONS: TransmissionGroup[] = ["handgeschakeld", "automaat"];
export const TRANSMISSION_LABEL: Record<TransmissionGroup, string> = { handgeschakeld: "Handgeschakeld", automaat: "Automaat" };

/** Leest de transmissie uit een queryparameter of advertentietekst ("Automatik", "Schaltgetriebe", ...). */
export function parseTransmission(s: string | null | undefined): TransmissionGroup | undefined {
  const n = (s ?? "").toLowerCase();
  if (/auto|dsg|cvt|semi/.test(n)) return "automaat";
  if (/hand|schalt|manu/.test(n)) return "handgeschakeld";
  return undefined;
}

/** Elektrische auto's hebben altijd een automaat; anders geldt de invoer van de gebruiker. */
export function effectiveTransmission(v: Vehicle, input?: TransmissionGroup): TransmissionGroup | undefined {
  return v.isElektrisch ? "automaat" : input;
}
