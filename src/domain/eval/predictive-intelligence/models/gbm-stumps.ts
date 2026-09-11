/**
 * Tiny deterministic GBM (stumps) on the same no-odds feature keys as logistic.
 * Implemented only when train N is large enough; otherwise MODEL_NOT_SUPPORTED_BY_DATA.
 */
import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiFeatureVector, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export const GBM_MODEL_ID = "GBM_STUMPS_v1";
export const GBM_MIN_TRAIN = 200;
export const GBM_MIN_KEYS = 6;

export type GbmStump = {
  feature: string;
  threshold: number;
  logits: [number, number, number];
};

export type GbmParams = {
  keys: string[];
  stumps: GbmStump[];
  bias: [number, number, number];
  train_n: number;
};

const LABEL_IX = { HOME: 0, DRAW: 1, AWAY: 2 } as const;

export function dataSupportsGbm(input: { trainN: number; keyCount: number }): boolean {
  return input.trainN >= GBM_MIN_TRAIN && input.keyCount >= GBM_MIN_KEYS;
}

function val(features: PiFeatureVector, key: string): number {
  const v = features.values[key];
  return v == null || !Number.isFinite(v) ? 0 : Number(v);
}

function softmax(logits: number[]): PiProb3 {
  const m = Math.max(...logits);
  const e = logits.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return normalizeProb3(e[0]! / s, e[1]! / s, e[2]! / s);
}

export function predictGbmStumps(input: { features: PiFeatureVector; params: GbmParams }): PiProb3 {
  const logits = [...input.params.bias];
  for (const st of input.params.stumps) {
    const side = val(input.features, st.feature) <= st.threshold ? 1 : -0.5;
    logits[0] += st.logits[0] * side;
    logits[1] += st.logits[1] * side;
    logits[2] += st.logits[2] * side;
  }
  return softmax(logits);
}

export function trainGbmStumps(input: {
  rows: { features: PiFeatureVector; label: "HOME" | "DRAW" | "AWAY" }[];
  keys: string[];
  rounds?: number;
}): GbmParams | null {
  if (!dataSupportsGbm({ trainN: input.rows.length, keyCount: input.keys.length })) return null;
  const rounds = input.rounds ?? 8;
  const counts = [0, 0, 0];
  for (const r of input.rows) counts[LABEL_IX[r.label]] += 1;
  const n = Math.max(1, input.rows.length);
  const bias: [number, number, number] = [
    Math.log((counts[0] + 1) / n),
    Math.log((counts[1] + 1) / n),
    Math.log((counts[2] + 1) / n),
  ];
  const stumps: GbmStump[] = [];
  const quantiles = [0.35, 0.5, 0.65];
  for (let round = 0; round < rounds; round += 1) {
    const key = input.keys[round % input.keys.length]!;
    const vals = input.rows.map((r) => val(r.features, key)).sort((a, b) => a - b);
    const q = quantiles[round % quantiles.length]!;
    const threshold = vals[Math.min(vals.length - 1, Math.floor(q * vals.length))] ?? 0;
    const left = [0, 0, 0];
    const right = [0, 0, 0];
    for (const r of input.rows) {
      const ix = LABEL_IX[r.label];
      if (val(r.features, key) <= threshold) left[ix] += 1;
      else right[ix] += 1;
    }
    const leftN = left.reduce((a, b) => a + b, 0) || 1;
    const rightN = right.reduce((a, b) => a + b, 0) || 1;
    const lr = 0.15;
    stumps.push({
      feature: key,
      threshold,
      logits: [
        lr * (left[0] / leftN - right[0] / rightN),
        lr * (left[1] / leftN - right[1] / rightN),
        lr * (left[2] / leftN - right[2] / rightN),
      ],
    });
  }
  return { keys: input.keys, stumps, bias, train_n: input.rows.length };
}
