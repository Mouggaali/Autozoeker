import { describe, expect, it } from "vitest";
import { bundles, listing } from "./__fixtures__";
import { parseFilters, priceBand } from "./market";

const params = (o: Record<string, string>) => (k: string) => (k in o ? o[k] : null);

describe("priceBand", () => {
  it("geeft null bij minder dan 3 advertenties", () => {
    expect(priceBand([listing({ price: 5000 }), listing({ price: 6000 })])).toBeNull();
  });

  it("berekent mediaan, kwartielen en uitersten", () => {
    const band = priceBand([1000, 2000, 3000, 4000, 5000].map((price) => listing({ price })))!;
    expect(band).toMatchObject({ count: 5, median: 3000, low: 2000, high: 4000, min: 1000, max: 5000 });
  });

  it("telt een opslag (importkosten) bij elke prijs op", () => {
    const band = priceBand([1000, 2000, 3000].map((price) => listing({ price })), 500)!;
    expect(band.median).toBe(2500);
  });
});

describe("parseFilters", () => {
  const v = bundles.peugeot308.vehicle;

  it("valt terug op de standaardfilters zonder parameters", () => {
    const f = parseFilters(params({}), v, "automaat");
    expect(f.yearFrom).toBe(v.bouwjaar! - 1);
    expect(f.yearTo).toBe(v.bouwjaar! + 1);
    expect(f.transmission).toBe("automaat");
    expect(f.fuel).toBe("benzine");
    // 81 kW ≈ 110 pk, ±20% afgerond op 5 pk
    expect(f.pkFrom).toBe(85);
    expect(f.pkTo).toBe(135);
    expect(f.priceFrom).toBeNull();
  });

  it("leeg of 'alle' betekent: niet filteren", () => {
    const f = parseFilters(params({ yearFrom: "", transmission: "alle", pkTo: "" }), v, "automaat");
    expect(f.yearFrom).toBeNull();
    expect(f.transmission).toBeNull();
    expect(f.pkTo).toBeNull();
  });

  it("neemt ingevulde waarden over", () => {
    const f = parseFilters(params({ priceFrom: "7000", priceTo: "10000", body: "hatchback" }), v);
    expect(f).toMatchObject({ priceFrom: 7000, priceTo: 10000, body: "hatchback" });
  });
});
