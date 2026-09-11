/**
 * Dixon–Coles 1X2 — independent Poisson score matrix with tau on low-score cells.
 * Trains only on historical goals (no odds). Requires enough prior matches.
 */
import { poisson1x2, poissonPmf } from "@/domain/eval/poisson-baseline";
import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export const DIXON_COLES_MODEL_ID = "DIXON_COLES_v1";
export const DIXON_COLES_MIN_TRAIN = 40;

export type DixonColesParams = {
  rho: number;
  lambda_floor: number;
};

export const DEFAULT_DIXON_COLES: DixonColesParams = {
  rho: -0.08,
  lambda_floor: 0.2,
};

function tau(h: number, a: number, lambdaH: number, lambdaA: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lambdaH * lambdaA * rho;
  if (h === 0 && a === 1) return 1 + lambdaH * rho;
  if (h === 1 && a === 0) return 1 + lambdaA * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

export function predictDixonColes(input: {
  lambda_home: number;
  lambda_away: number;
  params?: DixonColesParams;
  maxGoals?: number;
}): PiProb3 {
  const p = input.params ?? DEFAULT_DIXON_COLES;
  const lh = Math.max(p.lambda_floor, input.lambda_home);
  const la = Math.max(p.lambda_floor, input.lambda_away);
  const max = input.maxGoals ?? 8;
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= max; h += 1) {
    for (let a = 0; a <= max; a += 1) {
      const cell = poissonPmf(h, lh) * poissonPmf(a, la) * tau(h, a, lh, la, p.rho);
      if (h > a) home += cell;
      else if (h === a) draw += cell;
      else away += cell;
    }
  }
  if (home + draw + away < 1e-9) {
    const raw = poisson1x2({ homeLambda: lh, awayLambda: la }, max);
    return normalizeProb3(raw.HOME, raw.DRAW, raw.AWAY);
  }
  return normalizeProb3(home, draw, away);
}

export function dataSupportsDixonColes(trainN: number): boolean {
  return trainN >= DIXON_COLES_MIN_TRAIN;
}

export function fitDixonColesRho(
  train: { lambda_home: number; lambda_away: number; label: "HOME" | "DRAW" | "AWAY" }[],
): DixonColesParams {
  if (!dataSupportsDixonColes(train.length)) return DEFAULT_DIXON_COLES;
  let best = DEFAULT_DIXON_COLES.rho;
  let bestLoss = Infinity;
  for (const rho of [-0.2, -0.13, -0.08, -0.03, 0, 0.05]) {
    let loss = 0;
    for (const row of train) {
      const p = predictDixonColes({
        lambda_home: row.lambda_home,
        lambda_away: row.lambda_away,
        params: { ...DEFAULT_DIXON_COLES, rho },
      });
      loss += -Math.log(Math.max(1e-12, p[row.label]));
    }
    loss /= train.length;
    if (loss < bestLoss) {
      bestLoss = loss;
      best = rho;
    }
  }
  return { ...DEFAULT_DIXON_COLES, rho: best };
}
