import { WINDOWS_036, type Coverage036, type Window036 } from "@/domain/eval/prospective-036/types";

const BOUNDS: Record<Window036, { min: number; max: number }> = {
  "T-72h": { min: 48 * 3600, max: 72 * 3600 },
  "T-48h": { min: 24 * 3600, max: 48 * 3600 },
  "T-24h": { min: 12 * 3600, max: 24 * 3600 },
  "T-12h": { min: 6 * 3600, max: 12 * 3600 },
  "T-6h": { min: 3 * 3600, max: 6 * 3600 },
  "T-3h": { min: 3600, max: 3 * 3600 },
  "T-1h": { min: 30 * 60, max: 3600 },
  "T-30m": { min: 15 * 60, max: 30 * 60 },
  "T-15m": { min: 5 * 60, max: 15 * 60 },
  "T-5m": { min: 60, max: 5 * 60 },
  "T-1m": { min: 0, max: 60 },
};

export function secondsToKickoff(quoteMs: number, kickMs: number): number {
  return (kickMs - quoteMs) / 1000;
}

export function windowOf(seconds: number): Window036 | null {
  if (!(seconds > 0)) return null;
  for (const w of WINDOWS_036) {
    const b = BOUNDS[w];
    if (seconds > b.min && seconds <= b.max) return w;
  }
  return null;
}

export function emptyCoverage(): Coverage036 {
  return Object.fromEntries(WINDOWS_036.map((w) => [w, 0])) as Coverage036;
}

export function coverageFromSeconds(secondsList: readonly number[]): Coverage036 {
  const cov = emptyCoverage();
  for (const s of secondsList) {
    const w = windowOf(s);
    if (w) cov[w] = 1;
  }
  return cov;
}

export function mergeCoverage(a: Coverage036, b: Coverage036): Coverage036 {
  const out = emptyCoverage();
  for (const w of WINDOWS_036) out[w] = a[w] === 1 || b[w] === 1 ? 1 : 0;
  return out;
}
