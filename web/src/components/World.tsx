"use client";
import { useEffect, useRef, useState } from "react";
import { LIGHTS } from "@/lib/lights";

/*
 * Keuringslicht: de wereld achter het glas bestaat uit zes lichten, één per onderdeel van het cijfer.
 * - Grootte = de weging van dat onderdeel in het cijfer (score.ts).
 * - Kleur = de deelscore zodra een rapport er is (goed / let op / slecht, grijs zonder data); op de
 *   homepage de eigen kleur van het onderdeel.
 * - De sectie die je leest ([data-light="<id>"]) trekt haar licht achter zich; aanwijzen
 *   ([data-light-hover="<id>"]) doet hetzelfde voor één rij. De rest wacht in een krans rond
 *   [data-light-home] (het cijferpaneel), of rechts in beeld als dat niet zichtbaar is.
 * Alles loopt via transform; onder prefers-reduced-motion geen zweef en geen parallax (globals.css).
 */


export type ScoreLight = { id: string; score: number | null };
const EVENT = "az:score";

/** Zet de lichten op de deelscores van een rapport (null = terug naar de homepage-kleuren). */
export function setScoreLights(components: ScoreLight[] | null) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: components }));
}

const tone = (s: number | null) => (s == null ? "#7d8aa6" : s >= 7.5 ? "var(--good)" : s >= 5.5 ? "var(--warn)" : "var(--bad)");
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function World() {
  const orbs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scores, setScores] = useState<Record<string, number | null> | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ScoreLight[] | null>).detail;
      setScores(d ? Object.fromEntries(d.map((c) => [c.id, c.score])) : null);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    let frame = 0;
    let hover: { id: string; el: Element } | null = null;
    let lastCurrent: string | null = null;

    const place = (id: string, x: number, y: number, k: number, o: number | null) => {
      const el = orbs.current[id];
      if (!el) return;
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${k})`;
      if (o == null) el.style.removeProperty("--o"); else el.style.setProperty("--o", String(o));
    };

    function update() {
      frame = 0;
      const w = innerWidth, h = innerHeight;
      const shift = reduce() ? 0 : Math.min(scrollY * 0.03, 220);

      // De sectie op de leeslijn (45% van de hoogte) bepaalt welk licht naar voren komt
      let reading: { id: string; el: Element } | null = null;
      for (const el of document.querySelectorAll("[data-light]")) {
        const r = el.getBoundingClientRect();
        if (r.top <= h * 0.45 && r.bottom >= h * 0.45) { reading = { id: el.getAttribute("data-light")!, el }; break; }
      }
      const readId = reading?.id ?? null;
      if (readId !== lastCurrent) { lastCurrent = readId; setCurrent(readId); }
      const focus = hover ?? reading;

      // Krans rond het cijferpaneel, of rechts in beeld (op de telefoon bovenin)
      const home = document.querySelector("[data-light-home]")?.getBoundingClientRect();
      const homeVisible = home && home.bottom > 60 && home.top < h - 60;
      const cx = homeVisible ? home.left + home.width / 2 : w < 860 ? w * 0.5 : w * 0.76;
      const cy = homeVisible ? home.top + home.height / 2 : (w < 860 ? h * 0.3 : h * 0.48) - shift;
      const rx = homeVisible ? Math.max(home.width * 0.62, 140) : w < 860 ? w * 0.42 : w * 0.2;
      const ry = homeVisible ? Math.max(home.height * 0.6, 120) : w < 860 ? h * 0.2 : h * 0.32;

      LIGHTS.forEach((l, i) => {
        if (focus && focus.id === l.id) {
          const r = focus.el.getBoundingClientRect();
          const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, h);
          const y = bottom > top ? top + (bottom - top) * 0.45 : r.top + r.height / 2;
          place(l.id, r.left + r.width * (hover ? 0.8 : 0.7), y, hover ? 1.15 : 1.4, 1);
          return;
        }
        const a = -Math.PI / 2 + (i / LIGHTS.length) * Math.PI * 2;
        place(l.id, cx + rx * Math.cos(a), cy + ry * Math.sin(a), 1, focus ? 0.32 : null);
      });
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    const over = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("[data-light-hover]");
      if (e.type === "pointerover" && (e as PointerEvent).pointerType !== "mouse" && !el) return;
      const next = el ? { id: el.getAttribute("data-light-hover")!, el } : null;
      if (next?.el === hover?.el) return;
      hover?.el.classList.remove("is-lit");
      next?.el.classList.add("is-lit");
      hover = next;
      schedule();
    };

    // Secties komen later binnen (streaming, navigatie): bijhouden welke onderdelen op de pagina staan
    const scan = () => {
      const ids = [...new Set([...document.querySelectorAll("[data-light]")].map((e) => e.getAttribute("data-light")!))];
      setSections((prev) => (prev.join() === ids.join() ? prev : ids));
      if (hover && !hover.el.isConnected) hover = null;
      schedule();
    };
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", over);
    scan();
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", over);
    };
  }, []);

  const color = (id: string, hue: string) => (scores ? tone(scores[id] ?? null) : hue);
  const railLights = LIGHTS.filter((l) => sections.includes(l.id));

  return (
    <>
      <div className="world" aria-hidden="true">
        {LIGHTS.map((l, i) => (
          <div
            key={l.id}
            ref={(el) => { orbs.current[l.id] = el; }}
            className="orb"
            style={{ "--s": `${13 + l.weight * 55}vmax`, "--d": `${14 + ((i * 7) % 11)}s`, "--c": color(l.id, l.hue) } as React.CSSProperties}
          >
            <i />
          </div>
        ))}
      </div>
      {railLights.length > 1 && (
        <nav className="rail glass" aria-label="Onderdelen van het cijfer">
          {railLights.map((l) => {
            const s = scores?.[l.id];
            return (
              <a
                key={l.id}
                href={`#deel-${l.id}`}
                aria-current={current === l.id}
                data-light-hover={l.id}
                style={{ "--c": color(l.id, l.hue) } as React.CSSProperties}
                aria-label={`${l.label}${s != null ? `: ${s.toFixed(1)}` : ""}`}
              >
                <i />
                <span>{l.label}{s != null ? ` · ${s.toFixed(1).replace(".", ",")}` : ""}</span>
              </a>
            );
          })}
        </nav>
      )}
    </>
  );
}

/** Zet in een rapport de lichten op de deelscores; bij weggaan terug naar de homepage-kleuren. */
export function ScoreLights({ components }: { components: ScoreLight[] }) {
  const key = components.map((c) => `${c.id}:${c.score}`).join();
  useEffect(() => {
    setScoreLights(components);
    return () => setScoreLights(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
