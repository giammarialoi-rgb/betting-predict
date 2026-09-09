import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import { argmax3 } from "@/domain/eval/validation-028/metrics";
import type { WalkRow028 } from "@/domain/eval/validation-028/walk";

export type Slice028 = {
  key: string;
  n: number;
  brier_model: number | null;
  brier_market: number | null;
  logloss_model: number | null;
  logloss_market: number | null;
};

export type EfficiencyBin028 = {
  key: string;
  n: number;
  mean_market_p: number | null;
  empirical_freq: number | null;
};

export function slicesBy(
  rows: readonly WalkRow028[],
  keyFn: (r: WalkRow028) => string,
  modelId: string,
): Slice028[] {
  const map = new Map<string, { n: number; bm: number; mm: number; bl: number; ml: number }>();
  for (const r of rows) {
    const p = r.probs[modelId];
    if (!p) continue;
    const k = keyFn(r);
    const acc = map.get(k) ?? { n: 0, bm: 0, mm: 0, bl: 0, ml: 0 };
    acc.n += 1;
    acc.bm += brier3(p, r.actual);
    acc.mm += brier3(r.market, r.actual);
    acc.bl += logLoss3(p, r.actual);
    acc.ml += logLoss3(r.market, r.actual);
    map.set(k, acc);
  }
  return [...map.entries()]
    .map(([key, a]) => ({
      key,
      n: a.n,
      brier_model: a.n ? a.bm / a.n : null,
      brier_market: a.n ? a.mm / a.n : null,
      logloss_model: a.n ? a.bl / a.n : null,
      logloss_market: a.n ? a.ml / a.n : null,
    }))
    .sort((a, b) => b.n - a.n);
}

export function marketEfficiency028(rows: readonly WalkRow028[]): {
  favorite: EfficiencyBin028;
  underdog: EfficiencyBin028;
  odds_range: EfficiencyBin028[];
  overround: EfficiencyBin028[];
} {
  const fav = { n: 0, pSum: 0, hit: 0 };
  const dog = { n: 0, pSum: 0, hit: 0 };
  const ranges = [
    { key: "fav_odds_1.01-1.50", lo: 1.01, hi: 1.5, n: 0, pSum: 0, hit: 0 },
    { key: "fav_odds_1.50-2.00", lo: 1.5, hi: 2, n: 0, pSum: 0, hit: 0 },
    { key: "fav_odds_2.00-3.00", lo: 2, hi: 3, n: 0, pSum: 0, hit: 0 },
    { key: "fav_odds_3.00+", lo: 3, hi: 99, n: 0, pSum: 0, hit: 0 },
  ];
  const ov = [
    { key: "overround_<1.05", lo: 0, hi: 1.05, n: 0, pSum: 0, hit: 0 },
    { key: "overround_1.05-1.08", lo: 1.05, hi: 1.08, n: 0, pSum: 0, hit: 0 },
    { key: "overround_>=1.08", lo: 1.08, hi: 99, n: 0, pSum: 0, hit: 0 },
  ];
  const push = (
    b: { n: number; pSum: number; hit: number },
    p: number,
    hit: boolean,
  ) => {
    b.n += 1;
    b.pSum += p;
    if (hit) b.hit += 1;
  };
  for (const r of rows) {
    const sideF = argmax3(r.market);
    const sideD: 0 | 1 | 2 = r.market[0]! <= r.market[1]! && r.market[0]! <= r.market[2]! ? 0 : r.market[1]! <= r.market[2]! ? 1 : 2;
    push(fav, r.market[sideF]!, r.actual === sideF);
    push(dog, r.market[sideD]!, r.actual === sideD);
    const oddsF =
      sideF === 0 ? r.event.home_odds : sideF === 1 ? r.event.draw_odds : r.event.away_odds;
    for (const bin of ranges) {
      if (oddsF >= bin.lo && oddsF < bin.hi) push(bin, r.market[sideF]!, r.actual === sideF);
    }
    for (const bin of ov) {
      if (r.overround >= bin.lo && r.overround < bin.hi) push(bin, r.market[sideF]!, r.actual === sideF);
    }
  }
  const pack = (key: string, b: { n: number; pSum: number; hit: number }): EfficiencyBin028 => ({
    key,
    n: b.n,
    mean_market_p: b.n ? b.pSum / b.n : null,
    empirical_freq: b.n ? b.hit / b.n : null,
  });
  return {
    favorite: pack("favorite", fav),
    underdog: pack("underdog", dog),
    odds_range: ranges.map((b) => pack(b.key, b)),
    overround: ov.map((b) => pack(b.key, b)),
  };
}

export function classifyAblation(input: {
  trainMarket: number | null;
  trainModel: number | null;
  testMarket: number | null;
  testModel: number | null;
  testN: number;
}): "USEFUL" | "NEUTRAL" | "HARMFUL" | "UNKNOWN" {
  if (input.testN < 50 || input.trainMarket == null || input.trainModel == null || input.testMarket == null || input.testModel == null) {
    return "UNKNOWN";
  }
  const eps = 0.0005;
  const trainBetter = input.trainModel < input.trainMarket - eps;
  const testBetter = input.testModel < input.testMarket - eps;
  const testWorse = input.testModel > input.testMarket + eps;
  if (trainBetter && testBetter) return "USEFUL";
  if (testWorse) return "HARMFUL";
  return "NEUTRAL";
}
