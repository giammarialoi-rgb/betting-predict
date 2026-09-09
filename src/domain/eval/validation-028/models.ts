import {
  marketDevig,
  stage1Probability,
  type ModelId025,
  type Stage1Input,
} from "@/domain/eval/turnaround-025/models";
import type { AblationId028, ModelId028 } from "@/domain/eval/validation-028/types";

export type SoftmaxWeights = number[][];

function softmax(z: number[]): [number, number, number] {
  const m = Math.max(z[0]!, z[1]!, z[2]!);
  const e0 = Math.exp(z[0]! - m);
  const e1 = Math.exp(z[1]! - m);
  const e2 = Math.exp(z[2]! - m);
  const s = e0 + e1 + e2;
  return [e0 / s, e1 / s, e2 / s];
}

export function logisticFeatures(input: Stage1Input, market: [number, number, number]): number[] {
  const elo = (input.eloDiff ?? 0) / 400;
  const form =
    input.formSample > 0
      ? (input.formHomePts - input.formAwayPts) / (3 * Math.max(1, input.formSample))
      : 0;
  return [1, elo, form, market[0]!, market[1]!];
}

export function predictSoftmax(W: SoftmaxWeights, x: number[]): [number, number, number] {
  const z = W.map((row) => row.reduce((s, w, j) => s + w * (x[j] ?? 0), 0));
  return softmax(z);
}

export function fitSoftmax(input: {
  X: number[][];
  y: (0 | 1 | 2)[];
  iters: number;
  lr: number;
  seed: number;
}): SoftmaxWeights {
  const d = input.X[0]?.length ?? 5;
  let s = input.seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const W: SoftmaxWeights = [
    Array.from({ length: d }, () => (rand() - 0.5) * 0.01),
    Array.from({ length: d }, () => (rand() - 0.5) * 0.01),
    Array.from({ length: d }, () => (rand() - 0.5) * 0.01),
  ];
  const n = input.X.length;
  if (n === 0) return W;
  for (let it = 0; it < input.iters; it++) {
    const g = [Array(d).fill(0), Array(d).fill(0), Array(d).fill(0)] as number[][];
    for (let i = 0; i < n; i++) {
      const x = input.X[i]!;
      const p = predictSoftmax(W, x);
      const y = input.y[i]!;
      for (let k = 0; k < 3; k++) {
        const err = p[k]! - (k === y ? 1 : 0);
        for (let j = 0; j < d; j++) g[k]![j] += err * (x[j] ?? 0);
      }
    }
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < d; j++) W[k]![j] -= (input.lr * g[k]![j]!) / n;
    }
  }
  return W;
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  const h = (a[0] + b[0]) / 2;
  const d = (a[1] + b[1]) / 2;
  const w = (a[2] + b[2]) / 2;
  const s = h + d + w;
  return [h / s, d / s, w / s];
}

export function modelProbs028(input: {
  id: ModelId028 | AblationId028;
  stage: Stage1Input;
  logistic: SoftmaxWeights | null;
}): [number, number, number] | null {
  const mkt = input.stage.marketOdds ? marketDevig(input.stage.marketOdds) : null;
  const id = input.id;
  if (id === "market_devig" || id === "market_only") return mkt;
  if (id === "frequency" || id === "market_history") {
    if (id === "market_history") return mkt && mix(mkt, input.stage.freq);
    return input.stage.freq;
  }
  if (id === "elo") return stage1Probability("elo", input.stage);
  if (id === "form") return stage1Probability("form", input.stage);
  if (id === "poisson") return stage1Probability("poisson", input.stage);
  if (id === "market_elo") return stage1Probability("market_elo", input.stage);
  if (id === "market_form") {
    const f = stage1Probability("form", input.stage);
    return mkt && f ? mix(mkt, f) : mkt;
  }
  if (id === "market_all") return stage1Probability("market_elo_form", input.stage);
  if (id === "ensemble") {
    const parts: [number, number, number][] = [];
    for (const k of ["market_devig", "frequency", "elo", "form"] as ModelId025[]) {
      const p = stage1Probability(k, input.stage);
      if (p) parts.push(p);
    }
    if (parts.length === 0) return null;
    const h = parts.reduce((s, p) => s + p[0]!, 0) / parts.length;
    const d = parts.reduce((s, p) => s + p[1]!, 0) / parts.length;
    const a = parts.reduce((s, p) => s + p[2]!, 0) / parts.length;
    const z = h + d + a;
    return [h / z, d / z, a / z];
  }
  if (id === "logistic") {
    if (!input.logistic || !mkt) return null;
    return predictSoftmax(input.logistic, logisticFeatures(input.stage, mkt));
  }
  return null;
}
