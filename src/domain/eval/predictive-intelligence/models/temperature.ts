import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiProb3 } from "@/domain/eval/predictive-intelligence/types";

/** Softmax temperature — T>1 flattens; fit ONLY on validation (never holdout/train labels for selection on holdout). */
export function applyTemperature(p: PiProb3, temperature: number): PiProb3 {
  const T = Math.max(0.25, Math.min(4, temperature));
  const logits = [
    Math.log(Math.max(1e-12, p.HOME)) / T,
    Math.log(Math.max(1e-12, p.DRAW)) / T,
    Math.log(Math.max(1e-12, p.AWAY)) / T,
  ];
  const m = Math.max(...logits);
  const e = logits.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return normalizeProb3(e[0]! / s, e[1]! / s, e[2]! / s);
}

/** Grid-search temperature on VALIDATION rows only. */
export function fitTemperatureOnValidation(
  rows: { p: PiProb3; y: "HOME" | "DRAW" | "AWAY" }[],
): number {
  if (!rows.length) return 1;
  let bestT = 1;
  let bestLoss = Infinity;
  for (const T of [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.8]) {
    let loss = 0;
    for (const r of rows) {
      const q = applyTemperature(r.p, T);
      loss += -Math.log(Math.max(1e-12, q[r.y]));
    }
    loss /= rows.length;
    if (loss < bestLoss) {
      bestLoss = loss;
      bestT = T;
    }
  }
  return bestT;
}
