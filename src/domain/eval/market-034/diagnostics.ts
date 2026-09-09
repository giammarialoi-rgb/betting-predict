import { brier3 } from "@/domain/eval/capital-020/models";
import { quantile } from "@/domain/eval/market-034/price";

/** Frozen before TEST. Absolute Δp of the T-1h favorite between T-24 and T-1h. */
export const MOVEMENT_DRIFT_ABS = 0.005;
export const MOVEMENT_STEAM_ABS = 0.02;

export type MovementLabel034 =
  | "steam"
  | "reverse_steam"
  | "drift"
  | "stability"
  | "no_second_snapshot"
  | "late_reversal"
  | "t1_to_kickoff";

export function classifyMovement034(deltaFavP: number | null): MovementLabel034 {
  if (deltaFavP == null) return "no_second_snapshot";
  const a = Math.abs(deltaFavP);
  if (a < MOVEMENT_DRIFT_ABS) return "stability";
  if (a < MOVEMENT_STEAM_ABS) return "drift";
  return deltaFavP > 0 ? "steam" : "reverse_steam";
}

export function quartileCuts(xs: readonly number[]): { q25: number; q50: number; q75: number } | null {
  const a = quantile(xs, 0.25);
  const b = quantile(xs, 0.5);
  const c = quantile(xs, 0.75);
  if (a == null || b == null || c == null) return null;
  return { q25: a, q50: b, q75: c };
}

export function assignQuartile(x: number, cuts: { q25: number; q50: number; q75: number }): 1 | 2 | 3 | 4 {
  if (x <= cuts.q25) return 1;
  if (x <= cuts.q50) return 2;
  if (x <= cuts.q75) return 3;
  return 4;
}

export type Hl034 = { n: number; bins: number; chi2: number | null; df: number };

/** Hosmer–Lemeshow on a binary series. Empty bins dropped. */
export function hosmerLemeshow(pairs: readonly { p: number; y: 0 | 1 }[], bins = 10): Hl034 {
  if (pairs.length === 0) return { n: 0, bins, chi2: null, df: 0 };
  const acc = Array.from({ length: bins }, () => ({ n: 0, p: 0, y: 0 }));
  for (const r of pairs) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(r.p * bins)));
    acc[b]!.n += 1;
    acc[b]!.p += r.p;
    acc[b]!.y += r.y;
  }
  const used = acc.filter((a) => a.n > 0);
  let chi2 = 0;
  for (const a of used) {
    const e = a.p;
    const o = a.y;
    const meanP = a.p / a.n;
    const var_ = a.n * meanP * (1 - meanP);
    if (var_ <= 1e-12) continue;
    chi2 += (o - e) ** 2 / var_;
  }
  return { n: pairs.length, bins, chi2, df: Math.max(0, used.length - 2) };
}

export type BrierDecomp034 = {
  n: number;
  brier: number | null;
  reliability: number | null;
  resolution: number | null;
  uncertainty: number | null;
};

/** Murphy binary decomposition on home-win (p_home vs y_home). */
export function brierDecompHome(
  rows: readonly { p: [number, number, number]; actual: 0 | 1 | 2 }[],
  bins = 10,
): BrierDecomp034 {
  if (rows.length === 0) {
    return { n: 0, brier: null, reliability: null, resolution: null, uncertainty: null };
  }
  const acc = Array.from({ length: bins }, () => ({ n: 0, p: 0, y: 0 }));
  let brier = 0;
  let ySum = 0;
  for (const r of rows) {
    const p = r.p[0]!;
    const y = r.actual === 0 ? 1 : 0;
    ySum += y;
    brier += (p - y) ** 2;
    const b = Math.min(bins - 1, Math.max(0, Math.floor(p * bins)));
    acc[b]!.n += 1;
    acc[b]!.p += p;
    acc[b]!.y += y;
  }
  const n = rows.length;
  const ybar = ySum / n;
  let rel = 0;
  let res = 0;
  for (const a of acc) {
    if (a.n === 0) continue;
    const fk = a.p / a.n;
    const ok = a.y / a.n;
    rel += (a.n / n) * (fk - ok) ** 2;
    res += (a.n / n) * (ok - ybar) ** 2;
  }
  return {
    n,
    brier: brier / n,
    reliability: rel,
    resolution: res,
    uncertainty: ybar * (1 - ybar),
  };
}

export function meanBrier(
  rows: readonly { p: [number, number, number]; actual: 0 | 1 | 2 }[],
): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + brier3(r.p, r.actual), 0) / rows.length;
}

export type GroupBrier = { group: string; level: string; n: number; brier: number | null };

export function groupBrier(
  rows: readonly { key: string; p: [number, number, number]; actual: 0 | 1 | 2 }[],
  group: string,
): GroupBrier[] {
  const map = new Map<string, { n: number; brier: number }>();
  for (const r of rows) {
    const g = map.get(r.key) ?? { n: 0, brier: 0 };
    g.n += 1;
    g.brier += brier3(r.p, r.actual);
    map.set(r.key, g);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([level, g]) => ({ group, level, n: g.n, brier: g.n ? g.brier / g.n : null }));
}
