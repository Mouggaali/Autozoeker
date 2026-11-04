import type { KnownIssue } from "../knownIssues";
import type { KmVerdict } from "./kmNorm";
import type { Inspection, OdometerInfo } from "../types";

/**
 * Onderhandelingsadvies: een openingsbod, een maximumprijs en de argumenten die bij déze auto echt gelden.
 * Puur en zonder netwerk; de referentie is de eerlijke prijs (regressie) of, zonder km, de mediaanband.
 */
export interface NegotiationInput {
  asking: number;
  /** Eerlijke prijs voor bouwjaar + km, of de mediaanband van vergelijkbare auto's */
  ref: { mid: number; low: number; high: number; kind: "fair" | "median" };
  score: number;
  issues: KnownIssue[];
  inspections: Inspection[];
  apkExpires: string | null;
  odometer: OdometerInfo["verdict"];
  /** Datum waarop de advertentie (volgens het platform) online kwam of is bijgewerkt */
  listedAt?: string | null;
  /** Schade-signalen uit de RDW (lib/damage.ts) */
  blocked?: boolean;
  imported?: boolean;
  /** Kilometerstand tegenover het CBS-gemiddelde */
  km?: KmVerdict | null;
  now?: Date;
}

export interface Argument { text: string; amount?: number }
export interface Negotiation {
  open: number;
  walkAway: number;
  /** Verwachte reparatiekosten die in het openingsbod zijn verrekend */
  deduction: number;
  arguments: Argument[];
  opener: string;
}

const round250 = (n: number) => Math.round(n / 250) * 250;
const floor250 = (n: number) => Math.floor(n / 250) * 250;
const DAY = 86_400_000;
const eur = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

export function negotiate(i: NegotiationInput): Negotiation | null {
  const { asking, ref } = i;
  if (!(asking > 0) || !(ref.mid > 0)) return null;
  const now = i.now ?? new Date();
  const args: Argument[] = [];
  const refName = ref.kind === "fair" ? "de eerlijke prijs voor dit bouwjaar en deze km-stand" : "de mediaan van vergelijkbare auto's";

  if (asking > ref.mid) args.push({ text: `De vraagprijs ligt ${eur(asking - ref.mid)} boven ${refName} (${eur(ref.mid)}).`, amount: asking - ref.mid });

  // Bekende zwakke plekken: het midden van de reparatiekosten, gewogen naar hoe vaak het voorkomt
  let deduction = 0;
  for (const x of i.issues) {
    if (!x.cost) { args.push({ text: `${x.title}: bekend aandachtspunt. ${x.check}` }); continue; }
    const mid = (x.cost[0] + x.cost[1]) / 2;
    deduction += mid * (x.risk === "high" ? 0.5 : 0.25);
    args.push({ text: `${x.title}: bekend aandachtspunt, reparatie indicatief ${eur(x.cost[0])} – ${eur(x.cost[1])}. Zonder bewijs van onderhoud is dat een risico voor jou.`, amount: mid });
  }

  const last = i.inspections[0];
  if (last?.defects.length) {
    const list = last.defects.slice(0, 3).map((d) => d.description.toLowerCase()).join(", ");
    args.push({ text: `Bij de laatste APK (${new Date(last.date).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}) zijn gebreken vastgesteld: ${list}. Vraag of die verholpen zijn.` });
  }

  if (i.apkExpires) {
    const days = (new Date(i.apkExpires).getTime() - now.getTime()) / DAY;
    if (days < 0) args.push({ text: "De APK is verlopen; keuring en eventuele reparaties komen voor jouw rekening." });
    else if (days < 92) args.push({ text: `De APK verloopt over ${Math.max(1, Math.round(days / 30))} maand(en); vraag om een nieuwe APK bij aflevering of reken de keuring mee.` });
  }

  if (i.odometer === "Onlogisch") args.push({ text: "De RDW beoordeelt de tellerstand als onlogisch. Zonder sluitende verklaring is dat een reden om af te haken of fors te zakken." });

  if (i.km && (i.km.level === "hoog" || i.km.level === "zeer hoog")) {
    args.push({ text: `De auto heeft bovengemiddeld veel gereden: ${i.km.perYear.toLocaleString("nl-NL")} km per jaar, tegen gemiddeld ${i.km.expectedPerYear.toLocaleString("nl-NL")} voor deze leeftijd en brandstof (CBS). Dat betekent meer slijtage.` });
  }
  if (i.blocked) args.push({ text: "Het kenteken kan niet op naam worden gezet (blokkade, mogelijk schade of WOK-status). Niet kopen voordat dit is opgelost." });
  if (i.imported) args.push({ text: "Het is een importauto: de buitenlandse schadehistorie is onbekend. Vraag om papieren of een historierapport, of reken een risico-marge." });

  if (i.listedAt) {
    const days = Math.floor((now.getTime() - new Date(i.listedAt).getTime()) / DAY);
    if (days > 30) args.push({ text: `De advertentie staat al ${days} dagen online; de verkoper heeft waarschijnlijk weinig reacties gehad.` });
  }

  // Openingsbod: niet boven de onderkant van de markt, verminderd met de verwachte reparaties; niet beledigend laag
  const open = floor250(Math.max(Math.min(ref.low, asking - deduction), ref.low * 0.85));
  // Maximum: nooit boven de vraagprijs; bij een sterk cijfer mag het tot de bovenkant van de band
  const walkAway = round250(Math.min(asking, i.score >= 8 ? ref.high : ref.mid));
  const finalOpen = Math.min(open, walkAway);

  const grounds = [
    "vergelijkbare advertenties",
    i.issues.length > 0 && "de bekende aandachtspunten van deze motor",
    last?.defects.length && "de gebreken bij de laatste APK",
  ].filter(Boolean) as string[];
  const opener = finalOpen >= asking
    ? "De vraagprijs is marktconform. Vraag liever naar extra's: een nieuwe APK, een onderhoudsbeurt of een set banden."
    : `Ik ben geïnteresseerd in de auto. Op basis van ${grounds.length > 1 ? `${grounds.slice(0, -1).join(", ")} en ${grounds.at(-1)}` : grounds[0]} wil ik ${eur(finalOpen)} bieden.`;

  return { open: finalOpen, walkAway, deduction: Math.round(deduction), arguments: args, opener };
}
