"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseVehicleKey } from "@/lib/plate";

export default function SearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [price, setPrice] = useState("");
  const [km, setKm] = useState("");
  const [transmission, setTransmission] = useState("");
  const [error, setError] = useState<string | null>(null);

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
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="€ 15.000" className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-fg" />
          </label>
          <label className="eyebrow">
            Kilometerstand (optioneel)
            <input value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="85.000 km" className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-fg" />
          </label>
          <label className="eyebrow col-span-2 sm:col-span-1">
            Transmissie (optioneel)
            <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className="mt-1.5 w-full rounded-md border border-line bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-fg">
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
