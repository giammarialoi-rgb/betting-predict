import type { PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export function normalizeProb3(h: number, d: number, a: number): PiProb3 {
  const hh = Math.max(1e-12, h);
  const dd = Math.max(1e-12, d);
  const aa = Math.max(1e-12, a);
  const s = hh + dd + aa;
  return { HOME: hh / s, DRAW: dd / s, AWAY: aa / s };
}

export function assertProbSumsToOne(p: PiProb3, eps = 1e-9): void {
  const s = p.HOME + p.DRAW + p.AWAY;
  if (Math.abs(s - 1) > eps) throw new Error(`probability sum ${s} !== 1`);
}

export function probsClose(a: PiProb3, b: PiProb3, eps = 0.02): boolean {
  return (
    Math.abs(a.HOME - b.HOME) < eps &&
    Math.abs(a.DRAW - b.DRAW) < eps &&
    Math.abs(a.AWAY - b.AWAY) < eps
  );
}
