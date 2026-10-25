import type { Listing, Vehicle } from "../types";

/**
 * Diepe zoeklinks naar de marktplaatsen, ook voor mobile.de (waarvoor geen bron is gekoppeld).
 * Live advertenties komen uit listings.ts (Marktplaats + AutoScout24).
 */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface SearchLink {
  platform: Listing["platform"];
  country: "NL" | "DE";
  url: string;
}

export function searchLinks(v: Vehicle): SearchLink[] {
  const make = v.merk.toLowerCase();
  const model = v.model.toLowerCase();
  const y = v.bouwjaar;
  const yFrom = y ? y - 1 : undefined;
  const yTo = y ? y + 1 : undefined;
  const fuelNl = v.isElektrisch ? "ELEKTRISCH" : v.isDiesel ? "DIESEL" : "BENZINE";
  const q = encodeURIComponent(`${v.merk} ${v.model}`);
  return [
    {
      platform: "Marktplaats",
      country: "NL",
      url: `https://www.marktplaats.nl/q/${encodeURIComponent(`${v.merk} ${v.model}`.toLowerCase())}/`,
    },
    {
      platform: "AutoScout24.nl",
      country: "NL",
      url: `https://www.autoscout24.nl/lst/${slug(make)}/${slug(model)}?${yFrom ? `fregfrom=${yFrom}&fregto=${yTo}&` : ""}fuel=${fuelNl === "ELEKTRISCH" ? "E" : fuelNl === "DIESEL" ? "D" : "B"}&sort=standard&desc=0`,
    },
    {
      platform: "AutoScout24.de",
      country: "DE",
      url: `https://www.autoscout24.de/lst/${slug(make)}/${slug(model)}?${yFrom ? `fregfrom=${yFrom}&fregto=${yTo}&` : ""}fuel=${fuelNl === "ELEKTRISCH" ? "E" : fuelNl === "DIESEL" ? "D" : "B"}&sort=standard&desc=0`,
    },
    {
      platform: "mobile.de",
      country: "DE",
      url: `https://suchen.mobile.de/fahrzeuge/search.html?isSearchRequest=true&q=${q}${yFrom ? `&minFirstRegistrationDate=${yFrom}-01-01&maxFirstRegistrationDate=${yTo}-12-31` : ""}`,
    },
  ];
}
