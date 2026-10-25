import type { Report } from "./report";

/**
 * AI-samenvatting. Alle getallen komen uit deterministische berekeningen en worden als
 * feiten meegegeven; het model mag ze alleen uitleggen, niet veranderen of aanvullen.
 * Zonder ANTHROPIC_API_KEY wordt een regelgebaseerde samenvatting gegeven.
 */
export async function summarize(r: Report): Promise<{ text: string; source: "ai" | "rule-based" }> {
  const v = r.bundle.vehicle;
  const facts = {
    voertuig: `${v.merk} ${v.model} (${v.bouwjaar ?? "?"}), ${v.brandstoffen.join("/")}${r.input.transmission ? `, ${r.input.transmission}` : ""}`,
    score: r.score.overall,
    betrouwbaarheid_score: r.score.confidenceLabel,
    onderdelen: r.score.components.map((c) => ({ naam: c.label, score: c.score, redenen: c.reasons })),
    risicos: r.score.risks.map((x) => x.text),
    tellerstand: r.bundle.odometer.verdict,
    apk_meldingen: r.bundle.inspections.length,
    waarde_nl: r.nl.mid,
    waarde_de: r.de.mid,
    kosten_per_maand: Math.round(r.ownership.perMonth),
    controles: r.score.checks,
  };
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
          max_tokens: 700,
          system:
            "Je bent een onafhankelijke autokoopadviseur. Schrijf in het Nederlands een korte samenvatting (max. 150 woorden, 3 korte alinea's) van de feiten. Gebruik UITSLUITEND de aangeleverde feiten en getallen, verzin niets, en benoem expliciet wat onbekend is. Geen opsommingstekens.",
          messages: [{ role: "user", content: JSON.stringify(facts) }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content: { type: string; text?: string }[] };
        const text = data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
        if (text) return { text, source: "ai" };
      }
    } catch {}
  }
  const s = r.score;
  const lines = [
    `Deze ${facts.voertuig} krijgt een score van ${s.overall.toFixed(1)}/10 (betrouwbaarheid van de beoordeling: ${s.confidenceLabel.toLowerCase()}, omdat niet alle gegevens openbaar beschikbaar zijn).`,
    s.risks.length ? `Belangrijkste aandachtspunten: ${s.risks.slice(0, 3).map((x) => x.text).join(" ")}` : "Er zijn in de beschikbare data geen duidelijke rode vlaggen gevonden.",
    `Geschatte eigendomskosten bedragen circa € ${facts.kosten_per_maand} per maand. Controleer altijd de historie, schade en tellerstand met een gelicentieerd rapport en laat de auto keuren voor aankoop.`,
  ];
  return { text: lines.join("\n\n"), source: "rule-based" };
}
