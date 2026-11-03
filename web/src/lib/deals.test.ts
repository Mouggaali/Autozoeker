import { describe, expect, it } from "vitest";
import { listing, listings308Automaat } from "./__fixtures__";
import { rankDeals } from "./deals";

const now = new Date("2026-11-01T12:00:00Z");

describe("rankDeals", () => {
  it("rangschikt echte 308-advertenties op korting, uitgesloten advertenties onderaan", () => {
    const { deals, model } = rankDeals(listings308Automaat, now);
    expect(model).not.toBeNull();
    const clean = deals.filter((d) => !d.excluded);
    const rel = clean.map((d) => d.gap! / d.fair!);
    expect(rel).toEqual([...rel].sort((a, b) => a - b));
    const firstExcluded = deals.findIndex((d) => d.excluded);
    if (firstExcluded >= 0) expect(deals.slice(firstExcluded).every((d) => d.excluded)).toBe(true);
    expect(deals.every((d) => d.country === "NL")).toBe(true);
  });

  it("valt zonder model terug op de mediaan per bouwjaar", () => {
    const ls = [
      listing({ price: 9000, year: 2017 }), listing({ price: 10000, year: 2017 }), listing({ price: 11000, year: 2017 }),
      listing({ price: 14000, year: 2019 }),
    ];
    const { deals, model } = rankDeals(ls, now);
    expect(model).toBeNull();
    expect(deals[0].price).toBe(9000);
    expect(deals[0].gap).toBe(-1000);
    expect(deals.find((d) => d.year === 2019)!.gap).toBe(0);
  });

  it("zet schade-advertenties onderaan, ook als ze het goedkoopst zijn", () => {
    const ls = [listing({ price: 3000, noise: "schade" }), listing({ price: 9000 }), listing({ price: 10000 }), listing({ price: 11000 })];
    const { deals } = rankDeals(ls, now);
    expect(deals.at(-1)!.price).toBe(3000);
    expect(deals.at(-1)!.excluded).toMatch(/schade/);
  });
});
