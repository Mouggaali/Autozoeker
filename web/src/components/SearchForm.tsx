"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseVehicleKey } from "@/lib/plate";

export default function SearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [price, setPrice] = useState("");
  const [km, setKm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const key = parseVehicleKey(q);
    if (!key) return setError("Voer een geldig kenteken (6 tekens) of VIN (17 tekens) in.");
    setError(null);
    const p = new URLSearchParams();
    if (price) p.set("prijs", price);
    if (km) p.set("km", km);
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
          className="plate w-full flex-1 px-4 py-3 text-center text-xl placeholder:text-black/40 focus:outline-none focus:ring-4 focus:ring-brand/40"
          autoFocus={!compact}
        />
        <button className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:opacity-90">Check auto</button>
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            Vraagprijs (optioneel)
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="€ 15.000" className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-fg" />
          </label>
          <label className="text-sm text-muted">
            Kilometerstand (optioneel)
            <input value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="85.000 km" className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-fg" />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </form>
  );
}
