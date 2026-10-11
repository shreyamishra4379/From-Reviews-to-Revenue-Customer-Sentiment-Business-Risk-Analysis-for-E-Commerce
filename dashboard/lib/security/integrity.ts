import { createHash } from "crypto";
import { createReadStream, existsSync, readFileSync } from "fs";
import { join } from "path";
import { logSecurityEvent } from "./audit";

// Verifies data/processed/integrity_manifest.json (written by src/security/integrity.py):
// recomputes the SHA-256 of every fingerprinted result file and reports any that changed
// or disappeared since the analysis ran.

const ROOT = join(process.cwd(), "..");
const MANIFEST = join(ROOT, "data", "processed", "integrity_manifest.json");
const CACHE_MS = 60_000;

export interface IntegrityReport {
  ok: boolean;
  algorithm: string;
  generated_at: string | null;
  checked: number;
  modified: string[];
  missing: string[];
  error?: string;
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", d => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

const g = globalThis as unknown as { __integrity?: { at: number; report: IntegrityReport } };

export async function verifyIntegrity(): Promise<IntegrityReport> {
  if (g.__integrity && Date.now() - g.__integrity.at < CACHE_MS) return g.__integrity.report;

  let report: IntegrityReport;
  if (!existsSync(MANIFEST)) {
    report = { ok: false, algorithm: "SHA-256", generated_at: null, checked: 0, modified: [], missing: [],
      error: "No integrity manifest. Run: python src/security/integrity.py --write" };
  } else {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8")) as {
      algorithm: string; generated_at: string; files: Record<string, { sha256: string }>;
    };
    const modified: string[] = [];
    const missing: string[] = [];
    await Promise.all(Object.entries(manifest.files).map(async ([rel, info]) => {
      const path = join(ROOT, rel);
      if (!existsSync(path)) missing.push(rel);
      else if ((await sha256(path)) !== info.sha256) modified.push(rel);
    }));
    report = {
      ok: modified.length === 0 && missing.length === 0,
      algorithm: manifest.algorithm,
      generated_at: manifest.generated_at,
      checked: Object.keys(manifest.files).length,
      modified: modified.sort(),
      missing: missing.sort(),
    };
    if (!report.ok) {
      logSecurityEvent("integrity_mismatch", "integrity-check", "server",
        `${modified.length} modified, ${missing.length} missing: ${[...modified, ...missing].slice(0, 5).join(", ")}`);
    }
  }
  g.__integrity = { at: Date.now(), report };
  return report;
}
