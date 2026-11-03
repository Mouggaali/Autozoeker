import { describe, expect, it } from "vitest";
import { bundles } from "../__fixtures__";
import { matchIssues } from "../knownIssues";
import { negotiate, type NegotiationInput } from "./negotiation";

const now = new Date("2026-11-03T12:00:00Z");
const p308 = bundles.peugeot308;
const base = (p: Partial<NegotiationInput> = {}): NegotiationInput => ({
  asking: 10000,
  ref: { mid: 9000, low: 8000, high: 10150, kind: "fair" },
  score: 7,
  issues: [],
  inspections: [],
  apkExpires: "2027-06-01",
  odometer: "Logisch",
  now,
  ...p,
});

describe("negotiate", () => {
  it("geeft niets zonder vraagprijs of referentie", () => {
    expect(negotiate(base({ asking: 0 }))).toBeNull();
    expect(negotiate(base({ ref: { mid: 0, low: 0, high: 0, kind: "median" } }))).toBeNull();
  });

  it("opent op de onderkant van de markt en stopt bij de eerlijke prijs", () => {
    const n = negotiate(base())!;
    expect(n.open).toBe(8000);
    expect(n.walkAway).toBe(9000);
    expect(n.arguments[0].text).toMatch(/€ 1\.000 boven de eerlijke prijs/);
    expect(n.opener).toMatch(/€ 8\.000 bieden/);
  });

  it("verrekent de PureTech-riem van NL260L, maar nooit onder 85% van de onderkant", () => {
    const issues = matchIssues(p308.vehicle, "automaat");
    expect(issues.some((x) => x.id === "psa-puretech-turbo")).toBe(true);
    const n = negotiate(base({ asking: 8500, issues }))!;
    expect(n.deduction).toBeGreaterThan(0);
    expect(n.open).toBeLessThan(8000);
    expect(n.open).toBeGreaterThanOrEqual(Math.round((8000 * 0.85) / 250) * 250);
    expect(n.arguments.some((a) => a.text.includes("PureTech"))).toBe(true);
    expect(n.opener).toMatch(/aandachtspunten van deze motor/);
  });

  it("zakt nooit boven de vraagprijs en mag bij een sterk cijfer tot de bovenkant", () => {
    expect(negotiate(base({ asking: 8800 }))!.walkAway).toBe(8750);
    expect(negotiate(base({ asking: 12000, score: 8.4 }))!.walkAway).toBe(10250);
  });

  it("noemt APK, teller en lang online alleen als ze gelden", () => {
    const n = negotiate(base({
      apkExpires: "2026-12-15",
      odometer: "Onlogisch",
      listedAt: "2026-09-01",
      inspections: [{ date: "2026-05-01", type: "Periodieke controle", expires: "2027-05-01", defects: [{ code: "X", description: "Remschijf versleten", count: 1 }] }],
    }))!;
    const all = n.arguments.map((a) => a.text).join(" ");
    expect(all).toMatch(/APK verloopt over 1 maand/);
    expect(all).toMatch(/onlogisch/);
    expect(all).toMatch(/63 dagen online/);
    expect(all).toMatch(/remschijf versleten/);
    expect(negotiate(base({ listedAt: "2026-10-20" }))!.arguments.some((a) => a.text.includes("online"))).toBe(false);
  });

  it("raadt bij een lage vraagprijs extra's aan in plaats van zakken", () => {
    const n = negotiate(base({ asking: 7500 }))!;
    expect(n.open).toBe(7500);
    expect(n.opener).toMatch(/marktconform/);
  });
});
