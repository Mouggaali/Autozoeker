/**
 * Eerlijke prijs via regressie op live advertenties:
 *   ln(prijs) = a + b·leeftijd (jaar) + c·km (per 10.000 km)
 * Logaritmisch, omdat afschrijving procentueel werkt (elke 10.000 km kost ongeveer hetzelfde percentage).
 * Het model wordt alleen gebruikt als het geloofwaardig is: genoeg advertenties, meer km = lagere prijs
 * en een redelijke verklaarde variantie (R²). Anders valt de app terug op de mediaan.
 */
export interface FairPriceModel {
  a: number;
  b: number; // per jaar ouder (0 als het bouwjaar niet varieert)
  c: number; // per 10.000 km
  n: number;
  r2: number;
  sigma: number; // standaardafwijking van het residu (log-schaal)
  kmRange: [number, number];
}

export const MIN_POINTS = 8;
export const MIN_R2 = 0.3;

const ageOf = (year: number, now: Date) => Math.max(0, now.getFullYear() - year + 0.5);

/** Kleinste kwadraten via de normaalvergelijkingen (X'X)β = X'y, opgelost met Gauss-eliminatie. */
function ols(X: number[][], y: number[]): number[] | null {
  const k = X[0].length;
  const A = Array.from({ length: k }, (_, i) => [
    ...Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)),
    X.reduce((s, r, n) => s + r[i] * y[n], 0),
  ]);
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9) return null; // singulier: kolommen zijn (bijna) gelijk
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= k; c++) A[r][c] -= f * A[col][c];
    }
  }
  return A.map((row, i) => row[k] / row[i]);
}

export function fitFairPrice(points: { price: number; year: number | null; mileage: number | null }[], now = new Date()): FairPriceModel | null {
  const pts = points.filter((p): p is { price: number; year: number; mileage: number } => p.price > 0 && p.year != null && p.mileage != null && p.mileage > 0);
  if (pts.length < MIN_POINTS) return null;
  const y = pts.map((p) => Math.log(p.price));
  const ages = pts.map((p) => ageOf(p.year, now));
  const kms = pts.map((p) => p.mileage / 10000);
  const varies = (xs: number[]) => Math.max(...xs) - Math.min(...xs) > 1e-9;
  if (!varies(kms)) return null;

  // Met leeftijd als het bouwjaar varieert; anders (of als ouder = duurder) alleen km
  let beta: number[] | null = null;
  let withAge = false;
  if (varies(ages)) {
    beta = ols(pts.map((_, i) => [1, ages[i], kms[i]]), y);
    withAge = !!beta && beta[1] <= 0;
  }
  if (!withAge) {
    const b2 = ols(pts.map((_, i) => [1, kms[i]]), y);
    beta = b2 ? [b2[0], 0, b2[1]] : null;
  }
  if (!beta) return null;
  const [a, b, c] = beta;
  if (c >= 0) return null; // meer km moet goedkoper zijn

  const pred = pts.map((_, i) => a + b * ages[i] + c * kms[i]);
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  if (r2 < MIN_R2) return null;
  const params = withAge ? 3 : 2;
  const sigma = Math.sqrt(ssRes / Math.max(1, pts.length - params));
  const kmSorted = pts.map((p) => p.mileage).sort((x, z) => x - z);
  return { a, b, c, n: pts.length, r2, sigma, kmRange: [kmSorted[0], kmSorted[kmSorted.length - 1]] };
}

/** Verwachte vraagprijs plus bandbreedte (±1σ) voor een auto van dit bouwjaar met deze kilometerstand. */
export function fairPrice(m: FairPriceModel, year: number | null, km: number, now = new Date()): { mid: number; low: number; high: number } {
  const age = year != null ? ageOf(year, now) : 0;
  const ln = m.a + m.b * age + m.c * (km / 10000);
  const r = (x: number) => Math.round(Math.exp(x) / 50) * 50;
  return { mid: r(ln), low: r(ln - m.sigma), high: r(ln + m.sigma) };
}

/** Prijsverlies per 10.000 km volgens het model, als percentage (bijv. 0.035 = 3,5%). */
export const kmEffect = (m: FairPriceModel) => 1 - Math.exp(m.c);
