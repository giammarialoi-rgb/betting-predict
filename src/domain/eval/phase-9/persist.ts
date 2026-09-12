import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PHASE9_ARTIFACTS_DIR } from "@/domain/eval/phase-9/config";

export function writePhase9Json(name: string, value: unknown): string {
  mkdirSync(PHASE9_ARTIFACTS_DIR, { recursive: true });
  const p = join(PHASE9_ARTIFACTS_DIR, name);
  writeFileSync(p, JSON.stringify(value, null, 2));
  return p;
}

export function readPhase9Json<T>(name: string): T | null {
  const p = join(PHASE9_ARTIFACTS_DIR, name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function loadPhase9Bundle(): Record<string, unknown> {
  const names = [
    "dataset-manifest.json",
    "backtest-results.json",
    "model-comparison.json",
    "market-comparison.json",
    "promotion-candidates.json",
    "leakage-audit.json",
    "calibration-report.json",
    "error-analysis.json",
    "ui-copy.json",
    "windows.json",
  ];
  const out: Record<string, unknown> = { neon_in_use: false };
  for (const n of names) {
    out[n.replace(/\.json$/, "")] = readPhase9Json(n);
  }
  return out;
}
