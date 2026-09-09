import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiFeatureVector, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { PI_RANDOM_SEED } from "@/domain/eval/predictive-intelligence/config";

export type LogisticWeightsPi = {
  keys: string[];
  // 3 classes × (bias + features)
  W: number[][];
  mean: number[];
  std: number[];
  seed: number;
  epochs: number;
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rawVec(features: PiFeatureVector, keys: string[]): number[] {
  return keys.map((k) => {
    const v = features.values[k];
    return v == null || !Number.isFinite(v) ? 0 : Number(v);
  });
}

function scale(x: number[], mean: number[], std: number[]): number[] {
  return x.map((v, i) => (v - mean[i]!) / (std[i]! || 1));
}

function softmax(logits: number[]): PiProb3 {
  const m = Math.max(...logits);
  const e = logits.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return normalizeProb3(e[0]! / s, e[1]! / s, e[2]! / s);
}

const LABEL_IX = { HOME: 0, DRAW: 1, AWAY: 2 } as const;

export function predictLogisticChallenger(input: {
  features: PiFeatureVector;
  weights: LogisticWeightsPi;
}): PiProb3 {
  const x = scale(rawVec(input.features, input.weights.keys), input.weights.mean, input.weights.std);
  const logits = input.weights.W.map((row) => {
    let s = row[0]!;
    for (let i = 0; i < x.length; i += 1) s += row[i + 1]! * x[i]!;
    return s;
  });
  return softmax(logits);
}

/** Deterministic multinomial logistic with z-score features — no odds. */
export function trainLogisticChallenger(input: {
  rows: { features: PiFeatureVector; label: "HOME" | "DRAW" | "AWAY" }[];
  keys: string[];
  seed?: number;
  epochs?: number;
  lr?: number;
}): LogisticWeightsPi {
  const seed = input.seed ?? PI_RANDOM_SEED;
  const epochs = input.epochs ?? 60;
  const lr = input.lr ?? 0.02;
  const rand = mulberry32(seed);
  const d = input.keys.length;

  const mean = new Array(d).fill(0);
  const m2 = new Array(d).fill(0);
  const n = Math.max(1, input.rows.length);
  for (const row of input.rows) {
    const x = rawVec(row.features, input.keys);
    for (let i = 0; i < d; i += 1) mean[i]! += x[i]!;
  }
  for (let i = 0; i < d; i += 1) mean[i]! /= n;
  for (const row of input.rows) {
    const x = rawVec(row.features, input.keys);
    for (let i = 0; i < d; i += 1) {
      const diff = x[i]! - mean[i]!;
      m2[i]! += diff * diff;
    }
  }
  const std = m2.map((s) => Math.sqrt(s / n) || 1);

  const W: number[][] = [0, 1, 2].map(() => {
    const row = [0];
    for (let i = 0; i < d; i += 1) row.push((rand() - 0.5) * 0.01);
    return row;
  });

  for (let ep = 0; ep < epochs; ep += 1) {
    for (const row of input.rows) {
      const x = scale(rawVec(row.features, input.keys), mean, std);
      const logits = W.map((w) => {
        let s = w[0]!;
        for (let i = 0; i < d; i += 1) s += w[i + 1]! * x[i]!;
        return s;
      });
      const p = softmax(logits);
      const y = LABEL_IX[row.label];
      const probs = [p.HOME, p.DRAW, p.AWAY];
      for (let c = 0; c < 3; c += 1) {
        const err = probs[c]! - (c === y ? 1 : 0);
        W[c]![0]! -= lr * err;
        for (let i = 0; i < d; i += 1) {
          W[c]![i + 1]! -= lr * err * x[i]!;
        }
      }
    }
  }

  return { keys: input.keys, W, mean, std, seed, epochs };
}
