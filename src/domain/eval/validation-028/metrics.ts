import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import type { Score028 } from "@/domain/eval/validation-028/types";

export function actualIdx(ftHome: number, ftAway: number): 0 | 1 | 2 {
  if (ftHome > ftAway) return 0;
  if (ftHome === ftAway) return 1;
  return 2;
}

export function argmax3(p: [number, number, number]): 0 | 1 | 2 {
  return p[0]! >= p[1]! && p[0]! >= p[2]! ? 0 : p[1]! >= p[2]! ? 1 : 2;
}

export function ece10(
  rows: readonly { p: [number, number, number]; actual: 0 | 1 | 2 }[],
  bins: number,
): number | null {
  if (rows.length === 0) return null;
  const acc = Array.from({ length: bins }, () => ({ n: 0, conf: 0, hit: 0 }));
  for (const r of rows) {
    const side = argmax3(r.p);
    const conf = r.p[side]!;
    const b = Math.min(bins - 1, Math.max(0, Math.floor(conf * bins)));
    acc[b]!.n += 1;
    acc[b]!.conf += conf;
    acc[b]!.hit += side === r.actual ? 1 : 0;
  }
  let s = 0;
  for (const a of acc) {
    if (a.n === 0) continue;
    s += (a.n / rows.length) * Math.abs(a.hit / a.n - a.conf / a.n);
  }
  return s;
}

export function olsSlopeIntercept(xs: readonly number[], ys: readonly number[]): {
  slope: number;
  intercept: number;
} | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

export function scoreRows(
  rows: readonly { p: [number, number, number]; actual: 0 | 1 | 2 }[],
  eceBins: number,
): Score028 {
  if (rows.length === 0) {
    return {
      n: 0,
      brier: null,
      logloss: null,
      ece: null,
      cal_slope: null,
      cal_intercept: null,
      hit_rate: null,
    };
  }
  let brier = 0;
  let ll = 0;
  let hits = 0;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rows) {
    brier += brier3(r.p, r.actual);
    ll += logLoss3(r.p, r.actual);
    if (argmax3(r.p) === r.actual) hits += 1;
    xs.push(r.p[0]!);
    ys.push(r.actual === 0 ? 1 : 0);
  }
  const cal = olsSlopeIntercept(xs, ys);
  return {
    n: rows.length,
    brier: brier / rows.length,
    logloss: ll / rows.length,
    ece: ece10(rows, eceBins),
    cal_slope: cal?.slope ?? null,
    cal_intercept: cal?.intercept ?? null,
    hit_rate: hits / rows.length,
  };
}
