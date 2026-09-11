/**
 * Negative-binomial 1X2 — only when goal variance exceeds the mean (overdispersion).
 * If data are Poisson-like, this model is NOT_IMPLEMENTED for that sample.
 */
import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export const NEGBIN_MODEL_ID = "NEGBIN_v1";
export const NEGBIN_MIN_TRAIN = 80;

export type NegBinParams = {
  r: number;
  lambda_floor: number;
};

export const DEFAULT_NEGBIN: NegBinParams = { r: 8, lambda_floor: 0.2 };

function gammaRatio(k: number, r: number): number {
  let g = 1;
  for (let i = 0; i < k; i += 1) g *= (r + i) / (i + 1);
  return g;
}

export function negBinPmf(k: number, lambda: number, r: number): number {
  if (k < 0 || lambda <= 0 || r <= 0) return 0;
  const p = r / (r + lambda);
  return gammaRatio(k, r) * p ** r * (1 - p) ** k;
}

export function goalOverdispersion(goals: number[]): { mean: number; variance: number; overdispersed: boolean } {
  if (goals.length < 8) return { mean: 0, variance: 0, overdispersed: false };
  const mean = goals.reduce((a, b) => a + b, 0) / goals.length;
  const variance = goals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, goals.length - 1);
  return { mean, variance, overdispersed: variance > mean * 1.15 };
}

export function dataSupportsNegBin(input: { trainN: number; goals: number[] }): boolean {
  return input.trainN >= NEGBIN_MIN_TRAIN && goalOverdispersion(input.goals).overdispersed;
}

export function predictNegBin(input: {
  lambda_home: number;
  lambda_away: number;
  params?: NegBinParams;
  maxGoals?: number;
}): PiProb3 {
  const p = input.params ?? DEFAULT_NEGBIN;
  const lh = Math.max(p.lambda_floor, input.lambda_home);
  const la = Math.max(p.lambda_floor, input.lambda_away);
  const max = input.maxGoals ?? 8;
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= max; h += 1) {
    for (let a = 0; a <= max; a += 1) {
      const cell = negBinPmf(h, lh, p.r) * negBinPmf(a, la, p.r);
      if (h > a) home += cell;
      else if (h === a) draw += cell;
      else away += cell;
    }
  }
  return normalizeProb3(home, draw, away);
}
