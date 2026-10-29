import golf from "./00HJK6.json";
import i3 from "./G001BB.json";
import listings308 from "./listings_308_automaat.json";
import peugeot308 from "./NL260L.json";
import type { Listing, RdwBundle } from "../types";

/** Vaste RDW-snapshots en advertenties voor tests (geen netwerk). */
export const bundles = {
  peugeot308: peugeot308 as unknown as RdwBundle, // 2017, 1.2 PureTech 81 kW, benzine
  golf: golf as unknown as RdwBundle, // 2009, 1.4 TSI 103 kW, benzine
  i3: i3 as unknown as RdwBundle, // 2019, elektrisch
};

export const listings308Automaat = (listings308 as { listings: Listing[] }).listings;

/** Minimale advertentie voor tests; overschrijf wat nodig is. */
export function listing(p: Partial<Listing> & { price: number }): Listing {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    platform: "Marktplaats",
    country: "NL",
    title: "Test",
    mileage: 100000,
    year: 2017,
    fuel: "Benzine",
    transmission: null,
    power: null,
    location: null,
    url: "https://example.test",
    provenance: "verified",
    ...p,
  };
}
