"use client";
import { useMemo, useState } from "react";
import { CITIES } from "@/lib/engines/cities";
import { calcOwnership, type InsuranceType, type OwnershipInputs, type OwnershipVehicleFacts } from "@/lib/engines/ownership";
import NumberField from "./NumberField";
import { Card, eur } from "./ui";

const COLORS = ["#1257d6", "#e5883a", "#14a06a", "#8b5cf6", "#d94f70", "#0ea5b7", "#a3a3a3", "#c2a40a", "#4f46e5", "#65a30d"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg";

export default function Calculator({ facts, defaults }: { facts: OwnershipVehicleFacts; defaults: OwnershipInputs }) {
  const [i, setI] = useState<OwnershipInputs>(defaults);
  const set = <K extends keyof OwnershipInputs>(k: K, v: OwnershipInputs[K]) => setI((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => calcOwnership(facts, i), [facts, i]);
  const unit = facts.isElectric ? "kWh" : "liter";

  return (
    <Card title="Maandelijkse kosten" subtitle="Pas de aannames aan; alle bedragen zijn indicatieve schattingen, berekend zonder AI.">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1 content-start">
          <Field label="Woonplaats">
            <select className={inputCls} value={i.city} onChange={(e) => set("city", e.target.value)}>
              {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={`Kilometers per jaar: ${i.kmPerYear.toLocaleString("nl-NL")}`}>
            <input type="range" min={2000} max={50000} step={1000} value={i.kmPerYear} onChange={(e) => set("kmPerYear", Number(e.target.value))} className="w-full" />
          </Field>
          <Field label={`Prijs per ${unit} (€)`}>
            <NumberField className={inputCls} value={i.fuelPrice} onValue={(n) => set("fuelPrice", n)} placeholder="2,40" />
          </Field>
          <Field label="Verzekering">
            <select className={inputCls} value={i.insurance} onChange={(e) => set("insurance", e.target.value as InsuranceType)}>
              <option value="wa">WA</option>
              <option value="wa-beperkt">WA + beperkt casco</option>
              <option value="allrisk">Allrisk</option>
            </select>
          </Field>
          <Field label="Eigen parkeerkosten per maand (€)">
            <NumberField className={inputCls} value={i.extraParkingPerMonth} onValue={(n) => set("extraParkingPerMonth", n)} placeholder="0" />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={i.useCityParking} onChange={(e) => set("useCityParking", e.target.checked)} /> Vergunning in mijn stad meenemen</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={i.includeOptional.tires} onChange={(e) => set("includeOptional", { ...i.includeOptional, tires: e.target.checked })} /> Banden meenemen</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={i.includeOptional.wash} onChange={(e) => set("includeOptional", { ...i.includeOptional, wash: e.target.checked })} /> Wassen & verzorging</label>
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 text-sm font-semibold">Financiering (optioneel)</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Lening €"><NumberField className={inputCls} decimals={false} value={i.financingPrincipal} onValue={(n) => set("financingPrincipal", n)} placeholder="0" /></Field>
              <Field label="Rente %"><NumberField className={inputCls} value={i.financingRatePct} onValue={(n) => set("financingRatePct", n)} /></Field>
              <Field label="Maanden"><NumberField className={inputCls} decimals={false} value={i.financingMonths} onValue={(n) => set("financingMonths", n)} /></Field>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Per maand</div><div className="text-2xl font-extrabold">{eur(r.perMonth)}</div></div>
            <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Per jaar</div><div className="text-2xl font-extrabold">{eur(r.perYear)}</div></div>
            <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Per km</div><div className="text-2xl font-extrabold">{eur(r.perKm, 2)}</div></div>
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full" role="img" aria-label="Verdeling kosten">
            {r.lines.map((l, idx) => <div key={l.id} title={`${l.label}: ${eur(l.perYear / 12)}/mnd`} style={{ width: `${(l.perYear / r.perYear) * 100}%`, background: COLORS[idx % COLORS.length] }} />)}
          </div>
          <ul className="mt-4 divide-y divide-line">
            {r.lines.map((l, idx) => (
              <li key={l.id} className="py-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-sm" style={{ background: COLORS[idx % COLORS.length] }} />{l.label}</span>
                  <span className="tabular-nums">{eur(l.perYear / 12)} <span className="text-muted">/ mnd</span></span>
                </div>
                <p className="ml-5 text-xs text-muted">{l.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
