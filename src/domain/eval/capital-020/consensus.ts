/**
 * Bookmaker consensus at asOf — only snapshots already available.
 * Never uses close after asOf. Aggregates are not books.
 */

import {
  computeOverround,
  decimalOddsToImpliedProbability,
  normalizeMarketProbabilities,
} from "@/domain/odds/math";
import { snapshotEligibleForStrictCapital } from "@/domain/eval/capital-020/temporal-gate";
import type { MarketSnapshot } from "@/domain/eval/capital-020/types";

export type Consensus020 = {
  n_books: number;
  mean: number | null;
  median: number | null;
  trimmed_mean: number | null;
  min: number | null;
  max: number | null;
  dispersion: number | null;
  overround: number | null;
  de_vig: number[] | null;
  disagreement: number | null;
  mode: "STRICT" | "RESEARCH_DATE";
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function filterSnapshotsAsOf(
  snaps: readonly MarketSnapshot[],
  asOf: Date,
  mode: "STRICT" | "RESEARCH_DATE",
): MarketSnapshot[] {
  return snaps.filter((s) => {
    if (s.observationKind === "close") return false;
    if (Date.parse(s.observedAt) > asOf.getTime()) return false;
    if (mode === "STRICT") return snapshotEligibleForStrictCapital(s, asOf);
    return s.temporalClass === "DATE_ONLY" && s.observationKind === "open";
  });
}

export function bookmakerConsensus(
  snaps: readonly MarketSnapshot[],
  asOf: Date,
  mode: "STRICT" | "RESEARCH_DATE",
): Consensus020 {
  const avail = filterSnapshotsAsOf(snaps, asOf, mode);
  const byBook = new Map<string, number>();
  for (const s of avail) {
    if (!byBook.has(s.bookmaker)) byBook.set(s.bookmaker, s.odds);
  }
  const odds = [...byBook.values()];
  if (odds.length < 3) {
    return {
      n_books: odds.length,
      mean: odds.length ? odds.reduce((a, b) => a + b, 0) / odds.length : null,
      median: odds.length ? median(odds) : null,
      trimmed_mean: null,
      min: odds.length ? Math.min(...odds) : null,
      max: odds.length ? Math.max(...odds) : null,
      dispersion: null,
      overround: null,
      de_vig: null,
      disagreement: null,
      mode,
    };
  }
  const mean = odds.reduce((a, b) => a + b, 0) / odds.length;
  const med = median(odds);
  const sorted = [...odds].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  const tmean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  const variance =
    odds.reduce((s, x) => s + (x - mean) ** 2, 0) / odds.length;
  let overround: number | null = null;
  let deVig: number[] | null = null;
  try {
    overround = computeOverround(odds).overround;
    deVig = normalizeMarketProbabilities(odds);
  } catch {
    overround = null;
  }
  return {
    n_books: odds.length,
    mean,
    median: med,
    trimmed_mean: tmean,
    min: Math.min(...odds),
    max: Math.max(...odds),
    dispersion: Math.sqrt(variance),
    overround,
    de_vig: deVig,
    disagreement: Math.max(...odds) / Math.min(...odds) - 1,
    mode,
  };
}

export function impliedFromOdds(odds: number): number {
  return decimalOddsToImpliedProbability(odds);
}
