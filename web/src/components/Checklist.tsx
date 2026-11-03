"use client";
import { useEffect, useState } from "react";
import type { ChecklistGroup } from "@/lib/checklist";

/** Afvinkbare checklist; de stand blijft per kenteken bewaard in deze browser (localStorage). */
export default function Checklist({ kenteken, groups }: { kenteken: string; groups: ChecklistGroup[] }) {
  const key = `az:checklist:${kenteken}`;
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Pas na hydratatie lezen: de server kent localStorage niet
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setDone(JSON.parse(localStorage.getItem(key) ?? "{}")); } catch { /* geen opslag: alleen deze sessie */ }
  }, [key]);

  function toggle(id: string) {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* idem */ }
      return next;
    });
  }

  const all = groups.flatMap((g) => g.items);
  const count = all.filter((i) => done[i.id]).length;

  return (
    <>
      <div className="surface sticky top-[calc(64px+env(safe-area-inset-top))] z-10 mb-4 p-4 print:static">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">{count} van {all.length} gecontroleerd</span>
          <span className="flex gap-3 print:hidden">
            <button type="button" onClick={() => window.print()} className="text-brand hover:underline">Afdrukken</button>
            {count > 0 && <button type="button" onClick={() => { setDone({}); try { localStorage.removeItem(key); } catch {} }} className="text-muted hover:underline">Wissen</button>}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-good transition-[width] duration-300" style={{ width: `${(count / (all.length || 1)) * 100}%` }} />
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.id} className="surface mb-4 p-2 sm:p-3">
          <h2 className="px-3 pt-2 pb-1 text-lg font-semibold">{g.title}</h2>
          <ul className="rows">
            {g.items.map((i) => (
              <li key={i.id}>
                <label className="row-hit flex cursor-pointer items-start gap-3 px-3 py-3.5">
                  <input type="checkbox" checked={!!done[i.id]} onChange={() => toggle(i.id)} className="mt-0.5 h-5 w-5 flex-none" />
                  <span>
                    <span className={done[i.id] ? "text-muted line-through" : ""}>{i.text}</span>
                    {i.why && <span className="mt-0.5 block text-xs text-muted">{i.why}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
