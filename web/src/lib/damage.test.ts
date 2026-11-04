import { describe, expect, it } from "vitest";
import { bundles } from "./__fixtures__";
import { buildChecklist } from "./checklist";
import { canRegister, damageSignals, importInfo } from "./damage";
import { calcScore } from "./engines/score";
import { negotiate } from "./engines/negotiation";
import type { RdwBundle } from "./types";

const withVehicle = (b: RdwBundle, v: Partial<RdwBundle["vehicle"]>): RdwBundle => ({ ...b, vehicle: { ...b.vehicle, ...v } });
const status = (b: RdwBundle, id: string) => damageSignals(b.vehicle).find((s) => s.id === id)!.status;

describe("schade-signalen", () => {
  it("NL260L: op naam te zetten, geen import; WOK altijd onbekend", () => {
    const b = withVehicle(bundles.peugeot308, { tenaamstellenMogelijk: true });
    expect(status(b, "register")).toBe("ok");
    expect(status(b, "import")).toBe("ok");
    expect(status(b, "wok")).toBe("unknown");
  });

  it("valt terug op de ruwe RDW-data als het veld ontbreekt", () => {
    const v = { ...bundles.golf.vehicle, tenaamstellenMogelijk: undefined, raw: { tenaamstellen_mogelijk: "Nee" } };
    expect(canRegister(v)).toBe(false);
  });

  it("herkent import aan de datums", () => {
    const b = withVehicle(bundles.golf, { eersteToelating: "2015-03-01", eersteTenaamstellingNL: "2019-06-01" });
    expect(importInfo(b.vehicle)).toEqual({ imported: true, months: 51 });
    expect(status(b, "import")).toBe("warn");
  });

  it("blokkade en import werken door in cijfer, onderhandelen en checklist", () => {
    const base = withVehicle(bundles.peugeot308, { tenaamstellenMogelijk: true });
    const bad = withVehicle(bundles.peugeot308, { tenaamstellenMogelijk: false, eersteToelating: "2015-03-01", eersteTenaamstellingNL: "2017-06-01" });
    const s0 = calcScore(base, null, null, {});
    const s1 = calcScore(bad, null, null, {});
    expect(s1.overall).toBeLessThan(s0.overall);
    expect(s1.risks.some((r) => r.level === "high" && /op naam/.test(r.text))).toBe(true);
    expect(s1.risks.some((r) => /Importauto/.test(r.text))).toBe(true);

    const n = negotiate({ asking: 9000, ref: { mid: 9000, low: 8000, high: 10000, kind: "fair" }, score: 7, issues: [], inspections: [], apkExpires: null, odometer: "Logisch", blocked: true, imported: true })!;
    expect(n.arguments.map((a) => a.text).join(" ")).toMatch(/niet op naam[^]*importauto/i);

    const ids = buildChecklist({ bundle: bad, issues: [], checks: [] })[0].items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["blocked", "import"]));
  });
});
