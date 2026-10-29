import { describe, expect, it } from "vitest";
import { bundles, listing, listings308Automaat } from "./__fixtures__";
import { analyzeMarket, cleanPeers, parseFilters, priceBand } from "./market";

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

describe("cleanPeers", () => {
  const normal = [7000, 7500, 8000, 8200, 8500, 9000].map((price, i) => listing({ price, mileage: 100000 + i * 5000 }));

  it("haalt ruis eruit met reden", () => {
    const bad = listing({ price: 2500, noise: "schade" });
    const r = cleanPeers([...normal, bad]);
    expect(r.kept).not.toContain(bad);
    expect(r.excluded.noise).toBe(1);
    expect(r.reasons.get(bad.id)).toContain("schade");
  });

  it("telt dezelfde auto op twee platforms maar één keer", () => {
    const a = listing({ price: 8000, mileage: 123000, year: 2017, platform: "Marktplaats" });
    const b = listing({ price: 8040, mileage: 123500, year: 2017, platform: "AutoScout24.nl" });
    const r = cleanPeers([a, b]);
    expect(r.kept).toEqual([a]);
    expect(r.excluded.duplicates).toBe(1);
  });

  it("ziet dezelfde prijs op hetzelfde platform niet als dubbel", () => {
    const r = cleanPeers([listing({ price: 8000, mileage: 1 }), listing({ price: 8000, mileage: 1 })]);
    expect(r.excluded.duplicates).toBe(0);
  });

  it("verwijdert prijsuitschieters pas vanaf 5 advertenties per land", () => {
    const outlier = listing({ price: 30000 });
    const r = cleanPeers([...normal, outlier]);
    expect(r.excluded.outliers).toBe(1);
    expect(r.reasons.get(outlier.id)).toContain("veel hoger");
    expect(cleanPeers([...normal.slice(0, 3), outlier]).excluded.outliers).toBe(0);
  });

  it("beoordeelt uitschieters per land (Duitse prijzen liggen anders)", () => {
    const de = [3000, 3100, 3200, 3300, 3400].map((price) => listing({ price, country: "DE", platform: "AutoScout24.de" }));
    expect(cleanPeers([...normal, ...de]).excluded.outliers).toBe(0);
  });
});

describe("analyzeMarket", () => {
  it("rekent de bandbreedte zonder uitgesloten advertenties en toont die met reden", () => {
    const ls = [7000, 7500, 8000, 8200, 8500].map((price) => listing({ price }));
    const bad = listing({ price: 1500, noise: "export" });
    const m = analyzeMarket(bundles.peugeot308, [...ls, bad], {}, 2000);
    expect(m.nl?.count).toBe(5);
    expect(m.nl?.min).toBe(7000);
    expect(m.listings.find((l) => l.id === bad.id)?.excluded).toContain("export");
    expect(m.reference?.source).toBe("NL");
  });
});

describe("analyzeMarket op echte advertenties (Peugeot 308 automaat 2016–2018)", () => {
  it("maakt een geloofwaardig prijsmodel: meer km = lagere prijs", () => {
    const m = analyzeMarket(bundles.peugeot308, listings308Automaat, { transmission: "automaat" }, 2000);
    const model = m.reference?.model;
    expect(model).toBeTruthy();
    expect(model!.c).toBeLessThan(0);
  });
});
