/**
 * Poisson baseline for goal markets — simple independent Poisson.
 */

export type PoissonGoalRates = {
  homeLambda: number;
  awayLambda: number;
};

function factorial(n: number): number {
  let x = 1;
  for (let i = 2; i <= n; i++) x *= i;
  return x;
}

export function poissonPmf(k: number, lambda: number): number {
  if (k < 0 || lambda < 0) return 0;
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

/** P(total goals > line) under independent Poisson. */
export function poissonOverProbability(
  rates: PoissonGoalRates,
  line: number,
  maxGoals = 10,
): number {
  let pOver = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p =
        poissonPmf(h, rates.homeLambda) * poissonPmf(a, rates.awayLambda);
      if (h + a > line) pOver += p;
    }
  }
  return pOver;
}

export function poissonUnderProbability(
  rates: PoissonGoalRates,
  line: number,
  maxGoals = 10,
): number {
  return 1 - poissonOverProbability(rates, line, maxGoals);
}

/** Crude 1X2 from Poisson score matrix. */
export function poisson1x2(rates: PoissonGoalRates, maxGoals = 10): {
  HOME: number;
  DRAW: number;
  AWAY: number;
} {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p =
        poissonPmf(h, rates.homeLambda) * poissonPmf(a, rates.awayLambda);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const s = home + draw + away;
  return { HOME: home / s, DRAW: draw / s, AWAY: away / s };
}

export type FutureGoalModel = "dixon_coles" | "bivariate_poisson" | "negbin";

export function futureGoalModelStatus(
  model: FutureGoalModel,
): "PREPARED_NOT_IMPLEMENTED" {
  void model;
  return "PREPARED_NOT_IMPLEMENTED";
}
