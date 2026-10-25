"use client";
import { useState } from "react";

/**
 * Invoerveld dat decimalen toestaat (2.40 én 2,40). De tekst blijft zoals getypt;
 * alleen een geldig getal wordt doorgegeven, zodat typen van "2." of "2," niet wordt teruggezet.
 */
export default function NumberField({ value, onValue, className, placeholder, decimals = true }: {
  value: number;
  onValue: (n: number) => void;
  className?: string;
  placeholder?: string;
  decimals?: boolean;
}) {
  const [text, setText] = useState(value ? String(value).replace(".", ",") : "");
  return (
    <input
      className={className}
      inputMode={decimals ? "decimal" : "numeric"}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const ok = decimals ? /^\d*[.,]?\d{0,3}$/ : /^\d*$/;
        if (!ok.test(raw)) return;
        setText(raw);
        const n = parseFloat(raw.replace(",", "."));
        onValue(Number.isFinite(n) ? n : 0);
      }}
      onBlur={() => setText(value ? String(value).replace(".", ",") : "")}
    />
  );
}
