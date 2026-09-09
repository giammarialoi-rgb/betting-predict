import { computeOverround } from "@/domain/odds/math";
import { deVigPower, deVigProportional, deVigShin } from "@/domain/markets/consensus-engine";
import { marketDevig } from "@/domain/eval/turnaround-025/models";
import type { BookQuote029 } from "@/domain/eval/incremental-029/overlay";

export function asTriple(p: number[]): [number, number, number] | null {
  if (p.length !== 3 || p.some((x) => !(x > 0) || !Number.isFinite(x))) return null;
  const s = p[0]! + p[1]! + p[2]!;
  if (s <= 0) return null;
  return [p[0]! / s, p[1]! / s, p[2]! / s];
}

export function deVigAdditive(odds: readonly number[]): [number, number, number] | null {
  const { rawImpliedProbabilities, overround } = computeOverround(odds);
  if (rawImpliedProbabilities.length !== 3) return null;
  const margin = overround - 1;
  const n = 3;
  const raw = rawImpliedProbabilities.map((p) => p - margin / n);
  if (raw.some((p) => p <= 0)) return asTriple(deVigProportional(odds).output_probabilities);
  return asTriple(raw);
}

export function proportionalP(odds: { home: number; draw: number; away: number }): [number, number, number] | null {
  return marketDevig(odds);
}

export function shinP(odds: { home: number; draw: number; away: number }): [number, number, number] | null {
  const d = deVigShin([odds.home, odds.draw, odds.away]);
  if (d.status !== "COMPUTED") return proportionalP(odds);
  return asTriple(d.output_probabilities);
}

export function powerP(odds: { home: number; draw: number; away: number }): [number, number, number] | null {
  const d = deVigPower([odds.home, odds.draw, odds.away]);
  if (d.status !== "COMPUTED") return proportionalP(odds);
  return asTriple(d.output_probabilities);
}

export function quantile(xs: readonly number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo]!;
  return s[lo]! * (hi - i) + s[hi]! * (i - lo);
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: readonly number[]): number | null {
  const m = mean(xs);
  if (m == null || xs.length < 2) return m == null ? null : 0;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

export function trimmedMean(xs: readonly number[], trim = 0.1): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * trim);
  const cut = s.slice(k, s.length - k || s.length);
  return mean(cut.length ? cut : s);
}

export type Dispersion034 = {
  n: number;
  best_back: number | null;
  worst_price: number | null;
  median_price: number | null;
  mean_price: number | null;
  trimmed_mean: number | null;
  std_dev: number | null;
  cv: number | null;
  min_implied: number | null;
  max_implied: number | null;
  range: number | null;
};

export function priceDispersion(odds: readonly number[]): Dispersion034 {
  if (odds.length === 0) {
    return {
      n: 0,
      best_back: null,
      worst_price: null,
      median_price: null,
      mean_price: null,
      trimmed_mean: null,
      std_dev: null,
      cv: null,
      min_implied: null,
      max_implied: null,
      range: null,
    };
  }
  const implied = odds.map((o) => 1 / o);
  const m = mean(odds);
  const sd = stdev(odds);
  return {
    n: odds.length,
    best_back: Math.max(...odds),
    worst_price: Math.min(...odds),
    median_price: quantile(odds, 0.5),
    mean_price: m,
    trimmed_mean: trimmedMean(odds),
    std_dev: sd,
    cv: m && sd != null && m !== 0 ? sd / m : null,
    min_implied: Math.min(...implied),
    max_implied: Math.max(...implied),
    range: Math.max(...odds) - Math.min(...odds),
  };
}

export function overroundOf(odds: { home: number; draw: number; away: number }): number {
  return computeOverround([odds.home, odds.draw, odds.away]).overround - 1;
}

export function bestPriceOdds(books: readonly BookQuote029[], fallback: { home: number; draw: number; away: number }): {
  home: number;
  draw: number;
  away: number;
} {
  if (books.length < 2) return fallback;
  return {
    home: Math.max(...books.map((b) => b.home)),
    draw: Math.max(...books.map((b) => b.draw)),
    away: Math.max(...books.map((b) => b.away)),
  };
}

export function medianOdds(books: readonly BookQuote029[], fallback: { home: number; draw: number; away: number }): {
  home: number;
  draw: number;
  away: number;
} {
  if (books.length < 2) return fallback;
  return {
    home: quantile(books.map((b) => b.home), 0.5) ?? fallback.home,
    draw: quantile(books.map((b) => b.draw), 0.5) ?? fallback.draw,
    away: quantile(books.map((b) => b.away), 0.5) ?? fallback.away,
  };
}

export function mixToward(
  now: [number, number, number],
  early: [number, number, number],
  mix: number,
): [number, number, number] {
  const h = now[0]! + mix * (now[0]! - early[0]!);
  const d = now[1]! + mix * (now[1]! - early[1]!);
  const a = now[2]! + mix * (now[2]! - early[2]!);
  return asTriple([Math.max(1e-9, h), Math.max(1e-9, d), Math.max(1e-9, a)]) ?? now;
}

export function flbBin(p: number): number {
  return Math.min(9, Math.max(0, Math.floor(p * 10)));
}

export type FlbRow = { bin: number; n: number; mean_implied: number; observed: number; residual: number };

export function flbTable(pairs: readonly { p: number; y: 0 | 1 }[]): FlbRow[] {
  const acc = Array.from({ length: 10 }, () => ({ n: 0, ip: 0, y: 0 }));
  for (const r of pairs) {
    const b = flbBin(r.p);
    acc[b]!.n += 1;
    acc[b]!.ip += r.p;
    acc[b]!.y += r.y;
  }
  return acc.map((a, bin) => ({
    bin,
    n: a.n,
    mean_implied: a.n ? a.ip / a.n : 0,
    observed: a.n ? a.y / a.n : 0,
    residual: a.n ? a.y / a.n - a.ip / a.n : 0,
  }));
}

export function shannonEntropy(weights: readonly number[]): number | null {
  const pos = weights.filter((w) => w > 0 && Number.isFinite(w));
  if (pos.length === 0) return null;
  const s = pos.reduce((a, b) => a + b, 0);
  if (!(s > 0)) return null;
  let h = 0;
  for (const w of pos) {
    const p = w / s;
    h -= p * Math.log2(p);
  }
  return h;
}

export function crossBookEntropy(odds: readonly number[]): number | null {
  if (odds.length < 2) return null;
  return shannonEntropy(odds.map((o) => 1 / o));
}

export function favoriteBand(odds: number): string {
  if (odds < 1.5) return "<1.50";
  if (odds < 1.8) return "1.50–1.80";
  if (odds < 2.2) return "1.80–2.20";
  if (odds < 3) return "2.20–3.00";
  return ">3.00";
}
