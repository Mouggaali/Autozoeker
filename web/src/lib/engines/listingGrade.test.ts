import { describe, expect, it } from "vitest";
import { bundles, listing, listings308Automaat } from "../__fixtures__";
import { gradeListings } from "./listingGrade";
import type { MarketRef } from "./score";

const market: MarketRef = { count: 20, median: 8000, low: 7000, high: 9000, min: 5000, max: 12000, medianKm: 120000, label: "test" };

describe("gradeListings", () => {
  it("geeft elke advertentie een cijfer en sorteert van hoog naar laag", () => {
    const g = gradeListings(bundles.peugeot308, listings308Automaat, 2000, market);
    expect(g).toHaveLength(listings308Automaat.length);
    for (let i = 1; i < g.length; i++) expect(g[i - 1].grade).toBeGreaterThanOrEqual(g[i].grade);
  });

  it("telt importkosten op bij Duitse advertenties", () => {
    const [de] = gradeListings(bundles.peugeot308, [listing({ price: 6000, country: "DE", platform: "AutoScout24.de" })], 2500, market);
    expect(de.effectivePrice).toBe(8500);
  });

  it("herkent de auto uit het rapport en markeert die", () => {
    const own = listing({ price: 8500, year: bundles.peugeot308.vehicle.bouwjaar, mileage: 120000 });
    const [g] = gradeListings(bundles.peugeot308, [own], 0, market, { price: 8500, km: 120000 });
    expect(g.sameAsReport).toBe(true);
  });

  it("waarschuwt bij een opvallend lage prijs", () => {
    const [g] = gradeListings(bundles.peugeot308, [listing({ price: 3000, mileage: 120000 })], 0, market);
    expect(g.flags.some((f) => f.includes("Opvallend goedkoop"))).toBe(true);
  });
});
