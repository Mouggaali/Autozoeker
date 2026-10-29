import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Start een Python-tool uit tools/ (WAT: deterministische scripts) met JSON via stdin/stdout.
 * Gebruikt de venv in tools/.venv als die bestaat (lokaal en in de Docker-image), anders PYTHON_BIN of python3.
 */
const ROOT = path.resolve(process.cwd(), "..");
const VENV_PY = path.join(ROOT, "tools", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

async function pythonBin(): Promise<string> {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  try { await fs.access(VENV_PY); return VENV_PY; } catch { return process.platform === "win32" ? "python" : "python3"; }
}

export function runPythonTool<T>(script: string, input: unknown, timeoutMs = 45_000): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const child = spawn(await pythonBin(), [path.join(ROOT, "tools", script)], { env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Time-out bij ${script}`)); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().split("\n").pop() || `exit ${code}`));
      try { resolve(JSON.parse(out) as T); } catch { reject(new Error(`Ongeldige uitvoer van ${script}`)); }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
