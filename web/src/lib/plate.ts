export type VehicleKey = { kind: "plate"; value: string } | { kind: "vin"; value: string };

export function parseVehicleKey(input: string): VehicleKey | null {
  const clean = input.replace(/[\s-]/g, "").toUpperCase();
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) return { kind: "vin", value: clean };
  if (/^[A-Z0-9]{6}$/.test(clean)) return { kind: "plate", value: clean };
  return null;
}

/** Formatteert een kenteken met streepjes volgens het Nederlandse sidecode-patroon. */
export function formatPlate(k: string): string {
  const c = k.toUpperCase();
  const t = c.split("").map((ch) => (/[0-9]/.test(ch) ? "N" : "L")).join("");
  const patterns: Record<string, number[]> = {
    LLNNNN: [2, 4], NNNNLL: [4, 2], NNLLLN: [2, 3, 1], NLLLNN: [1, 3, 2],
    LLLNNL: [3, 2, 1], LNNNLL: [1, 3, 2], LLNNNL: [2, 3, 1], NNLLNN: [2, 2, 2],
    NNNLLN: [3, 2, 1], NLNNNN: [1, 1, 4], LLLNNN: [3, 3], NNNLLL: [3, 3],
    LNNLLL: [1, 2, 3], NLLNNN: [1, 2, 3], LLNLLL: [2, 1, 3], NNLLLL: [2, 4],
  };
  const p = patterns[t];
  if (!p) return c;
  const out: string[] = [];
  let i = 0;
  for (const n of p) { out.push(c.slice(i, i + n)); i += n; }
  return out.join("-");
}
