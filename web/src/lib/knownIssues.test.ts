import { describe, expect, it } from "vitest";
import { bundles } from "./__fixtures__";
import { matchIssues } from "./knownIssues";
import type { Vehicle } from "./types";

const ids = (v: Vehicle, t?: "automaat" | "handgeschakeld") => matchIssues(v, t).map((i) => i.id);
const car = (p: Partial<Vehicle>): Vehicle => ({ ...bundles.peugeot308.vehicle, ...p });

describe("matchIssues", () => {
  it("herkent de PureTech-turbo in de Peugeot 308 uit 2017 (NL260L)", () => {
    expect(ids(bundles.peugeot308.vehicle)).toEqual(["psa-puretech-turbo"]);
  });

  it("herkent de EA111 1.4 TSI in de Golf uit 2009 (00HJK6)", () => {
    expect(ids(bundles.golf.vehicle, "handgeschakeld")).toEqual(["vag-ea111-tsi"]);
  });

  it("DSG7 alleen als de transmissie als automaat is opgegeven", () => {
    expect(ids(bundles.golf.vehicle, "automaat")).toContain("vag-dq200");
    expect(ids(bundles.golf.vehicle)).not.toContain("vag-dq200");
  });

  it("geen aandachtspunten voor een elektrische auto", () => {
    expect(ids(bundles.i3.vehicle)).toEqual([]);
  });

  it("valt buiten de bouwjaren of motorinhoud niet in de lijst", () => {
    expect(ids(car({ bouwjaar: 2012 }))).toEqual([]); // PureTech-turbo pas vanaf 2014
    expect(ids(car({ cilinderinhoud: 1598, cilinders: 4 }))).toEqual([]); // 1.6 THP
  });

  it("onderscheidt PureTech met en zonder turbo op vermogen", () => {
    expect(ids(car({ vermogenKw: 60 }))).toEqual(["psa-puretech-na"]);
  });

  it("matcht merknamen met een achtervoegsel (RDW: 'BMW I') maar niet op deelwoorden", () => {
    const n47 = car({ merk: "BMW", cilinderinhoud: 1995, cilinders: 4, bouwjaar: 2010, isDiesel: true, brandstoffen: ["Diesel"] });
    expect(ids(n47)).toEqual(["bmw-n47"]);
    expect(ids({ ...n47, merk: "BMW ALPINA" })).toEqual(["bmw-n47"]);
    expect(ids({ ...n47, merk: "BMWX" })).toEqual([]);
  });
});
