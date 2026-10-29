import { describe, expect, it } from "vitest";
import { bundles } from "../__fixtures__";
import { type MarketRef, calcScore, marketReference } from "./score";

const market: MarketRef = { count: 20, median: 8000, low: 7000, high: 9000, min: 5000, max: 12000, medianKm: 120000, label: "20 vergelijkbare auto's in Nederland" };
const marketScore = (r: ReturnType<typeof calcScore>) => r.components.find((c) => c.id === "market")!.score;

describe("marketReference", () => {
  it("gebruikt de mediaan zonder kilometerstand", () => {
    expect(marketReference(market)).toEqual({ price: 8000, kmAdj: 0 });
  });

  it("corrigeert 3% per 10.000 km afwijking, begrensd op ±15%", () => {
    expect(marketReference(market, 100000).kmAdj).toBeCloseTo(0.06);
    expect(marketReference(market, 500000).kmAdj).toBe(-0.15);
  });
});

describe("calcScore – marktdeel", () => {
  const b = bundles.peugeot308;

  it("telt niet mee zonder marktdata", () => {
    expect(marketScore(calcScore(b, null, null, { askingPrice: 8000 }))).toBeNull();
  });

  it("geeft een 10 voor een prijs ruim onder de referentie", () => {
    expect(marketScore(calcScore(b, market, null, { askingPrice: 6000, mileage: 120000 }))).toBe(10);
  });

  it("geeft een lager cijfer en een risico voor een te hoge prijs", () => {
    const r = calcScore(b, market, null, { askingPrice: 11000, mileage: 120000 });
    expect(marketScore(r)!).toBeLessThan(5);
    expect(r.risks.some((x) => x.text.includes("boven wat vergelijkbare auto's kosten"))).toBe(true);
  });

  it("houdt het eindcijfer tussen 1 en 10", () => {
    for (const price of [1000, 8000, 30000]) {
      const o = calcScore(b, market, null, { askingPrice: price }).overall;
      expect(o).toBeGreaterThanOrEqual(1);
      expect(o).toBeLessThanOrEqual(10);
    }
  });
});
