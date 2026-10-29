"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ParsedListing } from "@/app/api/parse-link/route";
import { formatPlate, parseVehicleKey } from "@/lib/plate";

const fieldCls = "mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-fg";
const isListingUrl = (s: string) => /^https?:\/\/\S*(marktplaats\.nl|autoscout24\.(nl|de))\//i.test(s.trim());

export default function SearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [price, setPrice] = useState("");
  const [km, setKm] = useState("");
  const [transmission, setTransmission] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkState, setLinkState] = useState<{ busy?: boolean; ok?: string; warn?: string; error?: string }>({});

  async function readLink(url: string) {
    if (!isListingUrl(url)) {
      setLinkState(url.trim() ? { error: "Plak een link van Marktplaats of AutoScout24 (.nl/.de)." } : {});
      return;
    }
    setLinkState({ busy: true });
    try {
      const r = await fetch("/api/parse-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const d = (await r.json()) as ParsedListing | { error: string };
      if ("error" in d) return setLinkState({ error: d.error });
      if (d.price) setPrice(String(d.price));
      if (d.mileage) setKm(String(d.mileage));
      if (d.transmissionGroup) setTransmission(d.transmissionGroup);
      if (d.kenteken) setQ(formatPlate(d.kenteken));
      const what = [d.price && "prijs", d.mileage && "km", d.transmissionGroup && "transmissie", d.kenteken && "kenteken"].filter(Boolean).join(", ");
      setError(null);
      setLinkState(d.kenteken
        ? { ok: `Ingevuld uit ${d.platform}: ${what}.` }
        : { warn: `Ingevuld uit ${d.platform}: ${what}. Het kenteken staat niet in de advertentie; vul het zelf in (vaak zichtbaar op de foto's, of vraag het de verkoper).` });
    } catch {
      setLinkState({ error: "De advertentie kon niet worden gelezen. Vul de gegevens zelf in." });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const key = parseVehicleKey(q);
    if (!key) return setError("Voer een geldig kenteken (6 tekens) of VIN (17 tekens) in.");
    setError(null);
    const p = new URLSearchParams();
    if (price) p.set("prijs", price);
    if (km) p.set("km", km);
    if (transmission) p.set("transmissie", transmission);
    router.push(`/auto/${key.value}${p.size ? `?${p}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      {!compact && (
        <label className="eyebrow mb-3 block">
          Advertentielink plakken (optioneel)
          <div className="mt-1.5 flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onPaste={(e) => { const t = e.clipboardData.getData("text"); setLink(t); void readLink(t); e.preventDefault(); }}
              onBlur={() => link && !linkState.ok && !linkState.warn && void readLink(link)}
              inputMode="url"
              placeholder="https://www.marktplaats.nl/v/auto-s/…"
              className={`${fieldCls} mt-0 flex-1`}
            />
            <button type="button" onClick={() => void readLink(link)} disabled={linkState.busy || !link} className="rounded-md border border-line px-3 font-sans text-sm normal-case tracking-normal text-fg hover:border-brand disabled:opacity-50">
              {linkState.busy ? "Lezen…" : "Lees uit"}
            </button>
          </div>
          {linkState.ok && <span className="mt-1.5 block font-sans text-xs normal-case tracking-normal text-good">✓ {linkState.ok}</span>}
          {linkState.warn && <span className="mt-1.5 block font-sans text-xs normal-case tracking-normal text-warn">{linkState.warn}</span>}
          {linkState.error && <span className="mt-1.5 block font-sans text-xs normal-case tracking-normal text-bad">{linkState.error}</span>}
        </label>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kenteken, bijv. G-001-BB"
          aria-label="Kenteken of VIN"
          className="plate w-full flex-1 px-4 py-3 text-center text-2xl placeholder:text-black/35 focus:outline-none focus:ring-4 focus:ring-brand/40"
          autoFocus={!compact}
        />
        <button className="rounded-md bg-fg px-6 py-3 font-semibold text-bg transition hover:bg-brand hover:text-white">Check auto →</button>
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="eyebrow">
            Vraagprijs (optioneel)
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="€ 15.000" className={fieldCls} />
          </label>
          <label className="eyebrow">
            Kilometerstand (optioneel)
            <input value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="85.000 km" className={fieldCls} />
          </label>
          <label className="eyebrow col-span-2 sm:col-span-1">
            Transmissie (optioneel)
            <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={fieldCls}>
              <option value="">Weet ik niet</option>
              <option value="handgeschakeld">Handgeschakeld</option>
              <option value="automaat">Automaat</option>
            </select>
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </form>
  );
}
