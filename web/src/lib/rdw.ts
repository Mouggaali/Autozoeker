import type { Inspection, OdometerInfo, RdwBundle, Recall, Vehicle } from "./types";

const BASE = "https://opendata.rdw.nl/resource";
const DS = {
  vehicles: "m9d7-ebf2",
  fuel: "8ys7-d773",
  axles: "3huj-srit",
  inspections: "sgfe-77wx",
  defects: "a34c-vvps",
  defectText: "hx2c-gt7k",
  recalls: "t49b-isb7",
};

type Row = Record<string, string>;

async function soda(dataset: string, params: Record<string, string>): Promise<Row[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${BASE}/${dataset}.json?${qs}`, {
    next: { revalidate: 60 * 60 * 12 },
    headers: { Accept: "application/json", ...(process.env.RDW_APP_TOKEN ? { "X-App-Token": process.env.RDW_APP_TOKEN } : {}) },
  });
  if (!res.ok) throw new Error(`RDW ${dataset} gaf status ${res.status}`);
  return (await res.json()) as Row[];
}

const iso = (d?: string) =>
  d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null;
const num = (v?: string) => {
  if (v === undefined || v === "" || /niet|geen/i.test(v)) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const yn = (v?: string) => (v === "Ja" ? true : v === "Nee" ? false : null);
const clean = (v?: string) => (v && !/^niet geregistreerd$/i.test(v) && v !== "" ? v : null);

function monthsSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const n = new Date();
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
}

export async function fetchRdw(kenteken: string): Promise<RdwBundle | null> {
  const [vRows, fuels, axles, meldingen, defects, recallRows] = await Promise.all([
    soda(DS.vehicles, { kenteken }),
    soda(DS.fuel, { kenteken }),
    soda(DS.axles, { kenteken, $order: "as_nummer" }),
    soda(DS.inspections, { kenteken, $order: "meld_datum_door_keuringsinstantie DESC", $limit: "50" }),
    soda(DS.defects, { kenteken, $limit: "500" }),
    soda(DS.recalls, { kenteken }),
  ]);
  const v = vRows[0];
  if (!v) return null;

  // Omschrijvingen van gebreken (één regel per gebrek-id; nieuwste definitie wint)
  const codes = [...new Set(defects.map((d) => d.gebrek_identificatie))];
  const textRows = codes.length
    ? await soda(DS.defectText, {
        $where: `gebrek_identificatie in (${codes.map((c) => `'${c.replace(/'/g, "")}'`).join(",")})`,
        $order: "ingangsdatum_gebrek DESC",
        $limit: "1000",
      })
    : [];
  const text = new Map<string, string>();
  for (const t of textRows) if (!text.has(t.gebrek_identificatie)) text.set(t.gebrek_identificatie, t.gebrek_omschrijving);

  const inspections: Inspection[] = meldingen.map((m) => {
    const date = iso(m.meld_datum_door_keuringsinstantie)!;
    return {
      date,
      type: m.soort_melding_ki_omschrijving || m.soort_erkenning_omschrijving || "Keuring",
      expires: iso(m.vervaldatum_keuring),
      defects: defects
        .filter((d) => d.meld_datum_door_keuringsinstantie === m.meld_datum_door_keuringsinstantie)
        .map((d) => ({
          code: d.gebrek_identificatie,
          description: text.get(d.gebrek_identificatie) ?? "Omschrijving niet beschikbaar",
          count: Number(d.aantal_gebreken_geconstateerd) || 1,
        })),
    };
  });

  const recalls: Recall[] = recallRows.map((r) => ({
    code: r.referentiecode_rdw,
    statusCode: r.code_status,
    status: r.status,
  }));

  const fuelNames = fuels.map((f) => f.brandstof_omschrijving).filter(Boolean);
  const f0 = fuels[0] ?? {};
  const eersteToelating = iso(v.datum_eerste_toelating);
  const isElektrisch = fuelNames.length > 0 && fuelNames.every((n) => /elektriciteit/i.test(n));
  const isHybride = fuelNames.some((n) => /elektriciteit/i.test(n)) && !isElektrisch;
  const kwFuel = fuels.map((f) => num(f.nettomaximumvermogen) ?? num(f.netto_max_vermogen_elektrisch)).filter((x): x is number => x != null);
  const odoVerdict = v.tellerstandoordeel;
  const odometer: OdometerInfo = {
    verdict: odoVerdict === "Logisch" ? "Logisch" : odoVerdict === "Onlogisch" ? "Onlogisch" : "Onbekend",
    lastYear: num(v.jaar_laatste_registratie_tellerstand),
    explanation:
      odoVerdict === "Logisch"
        ? "De Nationale Autopas (RDW) beoordeelt de geregistreerde tellerstanden als logisch."
        : odoVerdict === "Onlogisch"
          ? "Let op: de geregistreerde tellerstanden zijn door de RDW als onlogisch beoordeeld. Dit kan wijzen op een teruggedraaide teller of een administratieve fout."
          : "Er is geen tellerstandoordeel beschikbaar in de open data van de RDW.",
  };

  const vehicle: Vehicle = {
    kenteken,
    merk: v.merk ?? "Onbekend",
    model: v.handelsbenaming ?? "",
    uitvoering: clean(v.uitvoering),
    voertuigsoort: v.voertuigsoort ?? "",
    inrichting: clean(v.inrichting),
    kleur: clean(v.eerste_kleur),
    brandstoffen: fuelNames,
    isElektrisch,
    isHybride,
    isDiesel: fuelNames.some((n) => /diesel/i.test(n)),
    eersteToelating,
    eersteTenaamstellingNL: iso(v.datum_eerste_tenaamstelling_in_nederland),
    laatsteTenaamstelling: iso(v.datum_tenaamstelling),
    apkVervaldatum: iso(v.vervaldatum_apk),
    bouwjaar: eersteToelating ? Number(eersteToelating.slice(0, 4)) : null,
    leeftijdMaanden: monthsSince(eersteToelating),
    massaRijklaar: num(v.massa_rijklaar),
    catalogusprijs: num(v.catalogusprijs),
    brutoBpm: num(v.bruto_bpm),
    co2: num(f0.co2_uitstoot_gecombineerd),
    verbruik: num(f0.brandstofverbruik_gecombineerd),
    elektrischVerbruik: num(f0.elektriciteitsverbruik_volledig_elektrisch) ?? num(f0.elektrisch_verbruik_enkel_elektrisch_wltp),
    vermogenKw: kwFuel.length ? Math.max(...kwFuel) : null,
    cilinderinhoud: num(v.cilinderinhoud),
    cilinders: num(v.aantal_cilinders),
    exportIndicator: yn(v.export_indicator),
    taxi: yn(v.taxi_indicator),
    wamVerzekerd: yn(v.wam_verzekerd),
    openRecall: yn(v.openstaande_terugroepactie_indicator),
    raw: v,
  };

  return { vehicle, fuels, axles, inspections, recalls, odometer, fetchedAt: new Date().toISOString() };
}
