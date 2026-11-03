import { describe, expect, it } from "vitest";
import { bundles } from "./__fixtures__";
import { buildChecklist } from "./checklist";
import { matchIssues } from "./knownIssues";

const ids = (g: ReturnType<typeof buildChecklist>) => g.flatMap((x) => x.items.map((i) => i.id));

describe("buildChecklist", () => {
  it("zet de PureTech-controle van NL260L bovenaan, met automaat-items", () => {
    const b = bundles.peugeot308;
    const groups = buildChecklist({ bundle: b, issues: matchIssues(b.vehicle, "automaat"), checks: [], transmission: "automaat" });
    expect(groups[0].id).toBe("own");
    expect(groups[0].items[0].why).toMatch(/PureTech/);
    expect(ids(groups)).toContain("d-automaat");
    expect(ids(groups)).not.toContain("d-koppeling");
    expect(ids(groups)).not.toContain("d-accu");
  });

  it("geeft een EV accu-items en geen koppeling of automaatbak", () => {
    const b = bundles.i3;
    const all = ids(buildChecklist({ bundle: b, issues: [], checks: [] }));
    expect(all).toContain("d-accu");
    expect(all).toContain("p-laadkabel");
    expect(all).not.toContain("d-koppeling");
    expect(all).not.toContain("d-automaat");
  });

  it("heeft unieke, stabiele id's en neemt controles uit het cijfer over", () => {
    const b = bundles.golf;
    const args = { bundle: b, issues: matchIssues(b.vehicle, undefined), checks: ["Controleer de distributieketting"] };
    const a = ids(buildChecklist(args));
    expect(new Set(a).size).toBe(a.length);
    expect(a).toEqual(ids(buildChecklist(args)));
    expect(buildChecklist(args)[0].items.some((i) => i.text === "Controleer de distributieketting")).toBe(true);
  });
});
