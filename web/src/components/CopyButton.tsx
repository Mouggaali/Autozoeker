"use client";
import { useState } from "react";

/** Kopieert een tekst naar het klembord en bevestigt dat kort. */
export default function CopyButton({ text, label = "Kopieer" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1600); }).catch(() => {})}
      className="well rounded-full px-3 py-1.5 text-xs font-semibold text-fg hover:text-brand"
    >
      {done ? "Gekopieerd" : label}
    </button>
  );
}
