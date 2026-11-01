/** De zes keuringslichten: één per onderdeel van het cijfer, met dezelfde id's en wegingen als engines/score.ts. */
export const LIGHTS = [
  { id: "history", label: "Historie & km", weight: 0.2, hue: "#6f8cff" },
  { id: "reliability", label: "Betrouwbaarheid", weight: 0.2, hue: "#3fc8c0" },
  { id: "market", label: "Prijs t.o.v. markt", weight: 0.2, hue: "#f6c90e" },
  { id: "costs", label: "Kosten", weight: 0.15, hue: "#ff8f6b" },
  { id: "inspection", label: "Keuringen", weight: 0.15, hue: "#59b7ff" },
  { id: "value", label: "Waarde voor geld", weight: 0.1, hue: "#7ee0a1" },
] as const;
export type LightId = (typeof LIGHTS)[number]["id"];
