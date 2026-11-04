import { describe, expect, it } from "vitest";
import { bundles } from "./__fixtures__";
import { expectedKm, kmVerdict } from "./engines/kmNorm";
import { negotiate } from "./engines/negotiation";
import { calcScore } from "./engines/score";
import { defaultInputs } from "./engines/ownership";
import { FALLBACK_FUEL, FALLBACK_KM, setLiveData } from "./liveData";
import { milieuzoneAccess } from "./milieuzones";
import type { RdwBundle } from "./types";

const diesel = (cls: string | null): RdwBundle => ({
  ...bundles.golf,
  vehicle: { ...bundles.golf.vehicle, isDiesel: true, brandstoffen: ["Diesel"] },
  fuels: [{ ...bundles.golf.fuels[0], emissiecode_omschrijving: cls ?? "" }],
});

describe("kilometernorm (CBS)", () => {
  it("telt per leeftijdsjaar het CBS-gemiddelde op, vanaf het eerste volle jaar", () => {
    expect(expectedKm(FALLBACK_KM, "benzine", 1)).toBe(13260);
    expect(expectedKm(FALLBACK_KM, "benzine", 2.5)).toBe(13260 + 13302 + Math.round(13108 * 0.5));
    // na 9 jaar geldt de waarde "9 jaar of ouder"
    expect(expectedKm(FALLBACK_KM, "benzine", 12) - expectedKm(FALLBACK_KM, "benzine", 11)).toBe(9604);
  });

  it("geeft laag/normaal/hoog/zeer hoog voor NL260L (benzine, ~9 jaar)", () => {
    const v = bundles.peugeot308.vehicle;
    const exp = expectedKm(FALLBACK_KM, "benzine", v.leeftijdMaanden! / 12);
    expect(kmVerdict(v, Math.round(exp * 0.5), FALLBACK_KM)!.level).toBe("laag");
    expect(kmVerdict(v, exp, FALLBACK_KM)!.level).toBe("normaal");
    expect(kmVerdict(v, Math.round(exp * 1.5), FALLBACK_KM)!.level).toBe("hoog");
    expect(kmVerdict(v, Math.round(exp * 2), FALLBACK_KM)!.level).toBe("zeer hoog");
    expect(kmVerdict(v, 0, FALLBACK_KM)).toBeNull();
  });

  it("veel km verlaagt de historie en wordt een onderhandelingsargument", () => {
    const b = bundles.peugeot308;
    const exp = expectedKm(FALLBACK_KM, "benzine", b.vehicle.leeftijdMaanden! / 12);
    const hist = (km: number) => calcScore(b, null, null, { mileage: km }).components.find((c) => c.id === "history")!.score!;
    expect(hist(Math.round(exp * 2))).toBeLessThan(hist(exp));
    const km = kmVerdict(b.vehicle, Math.round(exp * 2), FALLBACK_KM);
    const n = negotiate({ asking: 9000, ref: { mid: 9000, low: 8000, high: 10000, kind: "fair" }, score: 7, issues: [], inspections: [], apkExpires: null, odometer: "Logisch", km })!;
    expect(n.arguments.some((a) => /bovengemiddeld veel gereden/.test(a.text))).toBe(true);
  });
});

describe("milieuzones", () => {
  it("benzine mag overal in", () => {
    expect(milieuzoneAccess(bundles.peugeot308).denied).toEqual([]);
  });
  it("diesel: Euro 5+ overal, Euro 4 alleen Den Haag, Euro 3 nergens, onbekend = checken", () => {
    expect(milieuzoneAccess(diesel("6")).denied).toEqual([]);
    expect(milieuzoneAccess(diesel("5")).denied).toEqual([]);
    expect(milieuzoneAccess(diesel("4")).denied).toEqual(["Amsterdam", "Arnhem", "Utrecht"]);
    expect(milieuzoneAccess(diesel("4")).allowed).toEqual(["Den Haag"]);
    expect(milieuzoneAccess(diesel("3")).denied).toHaveLength(4);
    expect(milieuzoneAccess(diesel(null)).summary).toMatch(/milieuzones\.nl/);
  });
});

describe("brandstofprijs (CBS)", () => {
  it("gebruikt de actuele pompprijs als standaard", () => {
    setLiveData({ fuel: { ...FALLBACK_FUEL, diesel: 2.5, benzine: 2.2, source: "cbs" } });
    expect(defaultInputs(diesel("6").vehicle, null).fuelPrice).toBe(2.5);
    expect(defaultInputs(bundles.peugeot308.vehicle, null).fuelPrice).toBe(2.2);
    setLiveData({ fuel: FALLBACK_FUEL });
  });
});
