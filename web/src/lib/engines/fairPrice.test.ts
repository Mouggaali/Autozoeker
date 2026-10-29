import { describe, expect, it } from "vitest";
import { fairPrice, fitFairPrice, kmEffect } from "./fairPrice";

const now = new Date("2026-06-01");

/** Synthetische markt: 15.000 basis, −8% per jaar, −4% per 10.000 km, met wat ruis. */
function market(n = 20, noise = 0.03) {
  return Array.from({ length: n }, (_, i) => {
    const year = 2016 + (i % 3);
    const mileage = 60000 + ((i * 37) % 20) * 7500;
    const age = now.getFullYear() - year + 0.5;
    const jitter = Math.sin(i * 12.9898) * noise; // deterministische ruis
    return { price: Math.round(15000 * Math.exp(-0.08 * age - 0.04 * (mileage / 10000) + jitter)), year, mileage };
  });
}

describe("fitFairPrice", () => {
  it("vindt de km- en leeftijdseffecten terug", () => {
    const m = fitFairPrice(market(), now)!;
    expect(m).not.toBeNull();
    expect(m.c).toBeCloseTo(-0.04, 2);
    expect(m.b).toBeCloseTo(-0.08, 1);
    expect(m.r2).toBeGreaterThan(0.8);
    expect(kmEffect(m)).toBeCloseTo(0.039, 2);
  });

  it("geeft null bij te weinig advertenties", () => {
    expect(fitFairPrice(market(7), now)).toBeNull();
  });

  it("geeft null als meer km duurder lijkt (ongeloofwaardig)", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ price: 5000 + i * 500, year: 2017, mileage: 50000 + i * 10000 }));
    expect(fitFairPrice(pts, now)).toBeNull();
  });

  it("geeft null als er geen verband is (lage R²)", () => {
    const pts = Array.from({ length: 12 }, (_, i) => ({ price: [9000, 6000, 8500, 6500, 9500, 6200][i % 6], year: 2017, mileage: 50000 + i * 10000 }));
    expect(fitFairPrice(pts, now)).toBeNull();
  });

  it("werkt met alleen km als alle auto's hetzelfde bouwjaar hebben", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ price: Math.round(10000 * Math.exp(-0.05 * (5 + i))), year: 2017, mileage: 50000 + i * 10000 }));
    const m = fitFairPrice(pts, now)!;
    expect(m.b).toBe(0);
    expect(m.c).toBeCloseTo(-0.05, 3);
  });

  it("negeert advertenties zonder km of bouwjaar", () => {
    const pts = [...market(), { price: 99999, year: null, mileage: null }, { price: 1, year: 2017, mileage: null }];
    expect(fitFairPrice(pts, now)!.n).toBe(20);
  });
});

describe("fairPrice", () => {
  it("minder km geeft een hogere eerlijke prijs, met een bandbreedte eromheen", () => {
    const m = fitFairPrice(market(), now)!;
    const low = fairPrice(m, 2017, 80000, now);
    const high = fairPrice(m, 2017, 160000, now);
    expect(low.mid).toBeGreaterThan(high.mid);
    expect(low.low).toBeLessThan(low.mid);
    expect(low.high).toBeGreaterThan(low.mid);
  });
});
