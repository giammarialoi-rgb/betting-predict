import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import { blockBootstrapMeanCI } from "@/domain/eval/validation-028/stats";
import type { WalkRow030 } from "@/domain/eval/final-feature-reconstruction";

export type Stress032 = {
  n: number;
  ci95_delta_brier: { low: number; high: number } | null;
  ci95_delta_logloss: { low: number; high: number } | null;
  fragile: boolean;
  fragile_note: string;
  by_year: Record<string, { n: number; delta_brier: number | null }>;
  by_side: Record<string, { n: number; delta_brier: number | null }>;
  by_home_prob_bucket: Record<string, { n: number; delta_brier: number | null }>;
  missing_feature_delta_brier: number | null;
  top_1pct_events: number;
};

function meanDelta(
  rows: readonly WalkRow030[],
  getP: (r: WalkRow030) => [number, number, number],
): number | null {
  if (rows.length === 0) return null;
  let s = 0;
  for (const r of rows) s += brier3(getP(r), r.actual) - brier3(r.market, r.actual);
  return s / rows.length;
}

export function stressSelected032(input: {
  test: readonly WalkRow030[];
  getP: (r: WalkRow030) => [number, number, number];
  getPMissing: (r: WalkRow030) => [number, number, number];
  nBoot: number;
  seed: number;
  alpha: number;
  topFraction: number;
}): Stress032 {
  const test = input.test;
  const dBrier = test.map((r) => brier3(input.getP(r), r.actual) - brier3(r.market, r.actual));
  const dLl = test.map((r) => logLoss3(input.getP(r), r.actual) - logLoss3(r.market, r.actual));
  const ciB = blockBootstrapMeanCI({
    values: dBrier,
    blockIds: test.map((r) => r.week),
    nBoot: input.nBoot,
    seed: input.seed,
    alpha: input.alpha,
  });
  const ciL = blockBootstrapMeanCI({
    values: dLl,
    blockIds: test.map((r) => r.week),
    nBoot: input.nBoot,
    seed: input.seed + 1,
    alpha: input.alpha,
  });

  const indexed = dBrier.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const dropN = Math.max(1, Math.floor(test.length * input.topFraction));
  const drop = new Set(indexed.slice(0, dropN).map((x) => x.i));
  const kept = test.filter((_, i) => !drop.has(i));
  const full = meanDelta(test, input.getP);
  const afterDrop = meanDelta(kept, input.getP);
  const fragile = full != null && full < 0 && (afterDrop == null || afterDrop >= 0);

  const by_year: Stress032["by_year"] = {};
  for (const r of test) {
    const k = String(r.year);
    by_year[k] ??= { n: 0, delta_brier: 0 };
    by_year[k]!.n += 1;
    by_year[k]!.delta_brier =
      (by_year[k]!.delta_brier ?? 0) + (brier3(input.getP(r), r.actual) - brier3(r.market, r.actual));
  }
  for (const k of Object.keys(by_year)) {
    const row = by_year[k]!;
    row.delta_brier = row.n ? (row.delta_brier ?? 0) / row.n : null;
  }

  const sides = ["HOME", "DRAW", "AWAY"] as const;
  const by_side: Stress032["by_side"] = {};
  for (const s of sides) {
    const sub = test.filter((r) => (s === "HOME" ? r.actual === 0 : s === "DRAW" ? r.actual === 1 : r.actual === 2));
    by_side[s] = { n: sub.length, delta_brier: meanDelta(sub, input.getP) };
  }

  const by_home_prob_bucket: Stress032["by_home_prob_bucket"] = {};
  for (const r of test) {
    const b = Math.min(9, Math.max(0, Math.floor(r.market[0]! * 10)));
    const k = `${b / 10}-${(b + 1) / 10}`;
    by_home_prob_bucket[k] ??= { n: 0, delta_brier: 0 };
    by_home_prob_bucket[k]!.n += 1;
    by_home_prob_bucket[k]!.delta_brier =
      (by_home_prob_bucket[k]!.delta_brier ?? 0) + (brier3(input.getP(r), r.actual) - brier3(r.market, r.actual));
  }
  for (const k of Object.keys(by_home_prob_bucket)) {
    const row = by_home_prob_bucket[k]!;
    row.delta_brier = row.n ? (row.delta_brier ?? 0) / row.n : null;
  }

  return {
    n: test.length,
    ci95_delta_brier: ciB ? { low: ciB.low, high: ciB.high } : null,
    ci95_delta_logloss: ciL ? { low: ciL.low, high: ciL.high } : null,
    fragile,
    fragile_note: fragile
      ? `ΔBrier sign flips after dropping top ${dropN} (${(input.topFraction * 100).toFixed(0)}%) improving events`
      : "no 1% concentration flip, or no negative ΔBrier to concentrate",
    by_year,
    by_side,
    by_home_prob_bucket,
    missing_feature_delta_brier: meanDelta(test, input.getPMissing),
    top_1pct_events: dropN,
  };
}
