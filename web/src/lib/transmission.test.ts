import { describe, expect, it } from "vitest";
import { bundles } from "./__fixtures__";
import { effectiveTransmission, parseTransmission } from "./transmission";

describe("parseTransmission", () => {
  it.each([
    ["Automaat", "automaat"],
    ["Automatisch", "automaat"],
    ["Automatik", "automaat"],
    ["Halbautomatik", "automaat"],
    ["DSG", "automaat"],
    ["Handgeschakeld", "handgeschakeld"],
    ["Schaltgetriebe", "handgeschakeld"],
    ["", undefined],
    [null, undefined],
  ])("%s → %s", (input, expected) => {
    expect(parseTransmission(input)).toBe(expected);
  });
});

describe("effectiveTransmission", () => {
  it("een elektrische auto is altijd automaat", () => {
    expect(effectiveTransmission(bundles.i3.vehicle, "handgeschakeld")).toBe("automaat");
  });

  it("anders geldt de invoer", () => {
    expect(effectiveTransmission(bundles.golf.vehicle, "handgeschakeld")).toBe("handgeschakeld");
    expect(effectiveTransmission(bundles.golf.vehicle)).toBeUndefined();
  });
});
