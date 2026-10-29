import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Kleine cache met verlooptijd.
 * - Met UPSTASH_REDIS_REST_URL en UPSTASH_REDIS_REST_TOKEN: Upstash Redis (overleeft herstarts en deploys op Render).
 * - Zonder: bestanden in web/.data/cache (gaat verloren bij elke deploy op het gratis Render-plan).
 * Fouten in de cache zijn nooit fataal: dan wordt er gewoon opnieuw opgehaald.
 */
const DIR = path.join(process.cwd(), ".data", "cache");
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = "autozoeker:";

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(url!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error(`Upstash ${r.status}`);
  return ((await r.json()) as { result: unknown }).result;
}

const fileOf = (key: string) => path.join(DIR, `${key.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 180)}.json`);

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (url && token) {
      const raw = await redis(["GET", PREFIX + key]);
      return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
    }
    const { expires, value } = JSON.parse(await fs.readFile(fileOf(key), "utf8")) as { expires: number; value: T };
    return Date.now() < expires ? value : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    if (url && token) {
      await redis(["SET", PREFIX + key, JSON.stringify(value), "EX", ttlSeconds]);
      return;
    }
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(fileOf(key), JSON.stringify({ expires: Date.now() + ttlSeconds * 1000, value }));
  } catch {}
}

export const cacheBackend = () => (url && token ? "upstash" : "bestand");
