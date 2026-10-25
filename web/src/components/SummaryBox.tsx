"use client";
import { useEffect, useState } from "react";

export default function SummaryBox({ query }: { query: string }) {
  const [data, setData] = useState<{ text: string; source: "ai" | "rule-based" } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/summary?${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [query]);

  if (failed) return <p className="text-sm text-muted">Samenvatting niet beschikbaar.</p>;
  if (!data) return <div className="animate-pulse space-y-2"><div className="h-3 rounded bg-line" /><div className="h-3 w-5/6 rounded bg-line" /><div className="h-3 w-4/6 rounded bg-line" /></div>;
  return (
    <div>
      {data.text.split("\n\n").map((p, i) => <p key={i} className="mb-2 text-sm leading-relaxed">{p}</p>)}
      <p className="text-xs text-muted">{data.source === "ai" ? "AI-samenvatting op basis van de berekende feiten; getallen komen uit deterministische berekeningen." : "Automatisch gegenereerde samenvatting (stel ANTHROPIC_API_KEY in voor een AI-toelichting)."}</p>
    </div>
  );
}
