import type { Provenance, RdwBundle, SpecCategory, SpecItem, TimelineEvent } from "./types";

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : null);

function item(label: string, value: string | number | null | undefined, unit = "", source = "RDW"): SpecItem {
  const has = value !== null && value !== undefined && value !== "";
  return {
    label,
    value: has ? `${typeof value === "number" ? value.toLocaleString("nl-NL") : value}${unit ? ` ${unit}` : ""}` : null,
    provenance: (has ? "verified" : "unavailable") as Provenance,
    source: has ? source : undefined,
  };
}
const n = (s?: string) => (s && !isNaN(Number(s)) ? Number(s) : null);

export function buildSpecs(b: RdwBundle): SpecCategory[] {
  const v = b.vehicle;
  const raw = v.raw as Record<string, string>;
  const f0 = b.fuels[0] ?? {};
  const driven = b.axles.filter((a) => a.aangedreven_as === "J").length;

  return [
    {
      id: "motor",
      title: "Motor & aandrijving",
      items: [
        item("Brandstof", v.brandstoffen.join(" + ") || null),
        item("Vermogen (netto max.)", v.vermogenKw, "kW"),
        item("Vermogen in pk", v.vermogenKw ? Math.round(v.vermogenKw * 1.35962) : null, "pk", "Berekend uit RDW-kW"),
        item("Cilinderinhoud", v.cilinderinhoud, "cc"),
        item("Aantal cilinders", v.cilinders),
        item("Aangedreven assen", b.axles.length ? driven : null),
        item("Aantal assen", b.axles.length || null),
        item("Maximale snelheid (constructie)", n(raw.maximale_constructiesnelheid), "km/u"),
        item("Transmissie", null),
      ],
      note: "Transmissie (handbak/automaat) en motorcode staan niet in de open data van de RDW.",
    },
    {
      id: "milieu",
      title: "Milieu & verbruik",
      items: [
        item("CO₂-uitstoot (gecombineerd)", v.co2, "g/km"),
        item("Brandstofverbruik (gecombineerd)", v.verbruik, "l/100 km"),
        item("Brandstofverbruik stad", n(f0.brandstofverbruik_stad), "l/100 km"),
        item("Brandstofverbruik snelweg", n(f0.brandstofverbruik_buiten), "l/100 km"),
        item("Elektrisch verbruik (WLTP)", n(f0.elektrisch_verbruik_enkel_elektrisch_wltp), "Wh/km"),
        item("Actieradius elektrisch (WLTP)", n(f0.actie_radius_enkel_elektrisch_wltp ?? f0.actieradius_extern_oplaadbaar), "km"),
        item("Emissieklasse", f0.emissiecode_omschrijving || f0.uitlaatemissieniveau || null),
        item("Milieuklasse EG-goedkeuring", f0.milieuklasse_eg_goedkeuring_licht || null),
        item("Geluidsniveau rijdend", n(f0.geluidsniveau_rijdend), "dB(A)"),
        item("Geluidsniveau stationair", n(f0.geluidsniveau_stationair), "dB(A)"),
      ],
    },
    {
      id: "afmetingen",
      title: "Afmetingen & gewicht",
      items: [
        item("Lengte", n(raw.lengte), "cm"),
        item("Breedte", n(raw.breedte), "cm"),
        item("Hoogte", n(raw.hoogte_voertuig), "cm"),
        item("Wielbasis", n(raw.wielbasis), "cm"),
        item("Massa rijklaar", v.massaRijklaar, "kg"),
        item("Massa ledig", n(raw.massa_ledig_voertuig), "kg"),
        item("Toegestane maximummassa", n(raw.toegestane_maximum_massa_voertuig), "kg"),
        item("Max. trekgewicht ongeremd", n(raw.maximum_massa_trekken_ongeremd), "kg"),
        item("Max. trekgewicht geremd", n(raw.maximum_trekken_massa_geremd), "kg"),
      ],
    },
    {
      id: "banden",
      title: "Banden & velgen",
      items: [
        ...b.axles.map((a) => item(`Spoorbreedte as ${a.as_nummer} (${a.plaatscode_as === "V" ? "voor" : "achter"})`, n(a.spoorbreedte), "cm")),
        ...b.axles.map((a) => item(`Max. aslast as ${a.as_nummer}`, n(a.technisch_toegestane_maximum_aslast), "kg")),
        item("Bandenmaat", null),
        item("Velgmaat", null),
      ],
      note: "Bandenmaat en velgen worden niet in de open RDW-data gepubliceerd. Controleer de bandenmaat op de zijkant van de band of in het kentekenbewijs / fabrikantgegevens.",
    },
    {
      id: "geschiedenis",
      title: "Geschiedenis",
      items: [
        item("Eerste toelating", fmtDate(v.eersteToelating)),
        item("Eerste tenaamstelling in Nederland", fmtDate(v.eersteTenaamstellingNL)),
        item("Laatste tenaamstelling", fmtDate(v.laatsteTenaamstelling)),
        item("APK vervaldatum", fmtDate(v.apkVervaldatum)),
        item("Tellerstandoordeel", b.odometer.verdict === "Onbekend" ? null : b.odometer.verdict),
        item("Jaar laatste tellerstandregistratie", b.odometer.lastYear == null ? null : String(b.odometer.lastYear)),
        item("Geëxporteerd", v.exportIndicator == null ? null : v.exportIndicator ? "Ja" : "Nee"),
        item("Taxi", v.taxi == null ? null : v.taxi ? "Ja" : "Nee"),
        item("WAM-verzekerd", v.wamVerzekerd == null ? null : v.wamVerzekerd ? "Ja" : "Nee"),
        item("Openstaande terugroepactie", v.openRecall == null ? null : v.openRecall ? "Ja" : "Nee"),
        item("Aantal eigenaren", null),
        item("Schadehistorie", null),
      ],
      note: "Eigenarenhistorie, schadeverleden en kilometerreeks zijn niet openbaar. Hiervoor is een gelicentieerde databron (bijv. Carvertical, AutoDNA, NAP-rapport) nodig; zie docs/DATA_SOURCES.md.",
    },
    {
      id: "uitrusting",
      title: "Opties & uitrusting",
      items: [
        item("Carrosserie", v.inrichting),
        item("Kleur", v.kleur),
        item("Tweede kleur", clean(raw.tweede_kleur)),
        item("Aantal deuren", n(raw.aantal_deuren)),
        item("Aantal zitplaatsen", n(raw.aantal_zitplaatsen)),
        item("Catalogusprijs (nieuw)", v.catalogusprijs, "€"),
        item("Optiepakketten / uitrustingsniveau", null),
      ],
      note: "Opties zijn niet in het kentekenregister opgenomen. Controleer de uitrusting aan de hand van de advertentie en de bouwspecificatie van de fabrikant.",
    },
  ];
}

function clean(s?: string) {
  return s && !/niet geregistreerd/i.test(s) ? s : null;
}

export function buildTimeline(b: RdwBundle): TimelineEvent[] {
  const v = b.vehicle;
  const ev: TimelineEvent[] = [];
  if (v.eersteToelating) ev.push({ date: v.eersteToelating, title: "Eerste toelating", detail: "Eerste registratie van het voertuig.", tone: "neutral", provenance: "verified" });
  if (v.eersteTenaamstellingNL && v.eersteTenaamstellingNL !== v.eersteToelating)
    ev.push({ date: v.eersteTenaamstellingNL, title: "Eerste tenaamstelling in Nederland", detail: "Mogelijk geïmporteerd: de datum wijkt af van de eerste toelating.", tone: "warn", provenance: "verified" });
  for (const i of [...b.inspections].reverse()) {
    const count = i.defects.reduce((s, d) => s + d.count, 0);
    ev.push({
      date: i.date,
      title: `APK: ${i.type}`,
      detail: count ? `${count} gebrek(en): ${i.defects.map((d) => d.description).join("; ")}` : "Geen gebreken geregistreerd.",
      tone: count ? "warn" : "good",
      provenance: "verified",
    });
  }
  if (b.odometer.lastYear) ev.push({ date: `${b.odometer.lastYear}-12-31`, title: `Laatste tellerstand geregistreerd (${b.odometer.lastYear})`, detail: `Oordeel: ${b.odometer.verdict}.`, tone: b.odometer.verdict === "Onlogisch" ? "bad" : "good", provenance: "verified" });
  if (v.laatsteTenaamstelling) ev.push({ date: v.laatsteTenaamstelling, title: "Laatste tenaamstelling", detail: "Huidige eigenaar/houder sinds deze datum (naam is niet openbaar).", tone: "neutral", provenance: "verified" });
  if (v.apkVervaldatum) ev.push({ date: v.apkVervaldatum, title: "APK vervalt", tone: new Date(v.apkVervaldatum) < new Date() ? "bad" : "neutral", provenance: "verified" });
  return ev.sort((a, c) => a.date.localeCompare(c.date));
}
