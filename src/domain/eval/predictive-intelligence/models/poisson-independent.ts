import { poisson1x2 } from "@/domain/eval/poisson-baseline";
import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import { applyTemperature } from "@/domain/eval/predictive-intelligence/models/temperature";
import type { PiFeatureVector, PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";
import { priorMatchesAsOf, featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";

export type PoissonParamsPi = {
  rho: number;
  league_home_attack: number;
  league_away_attack: number;
  default_lambda: number;
  /** Softmax temperature — fitted on VALIDATION only. */
  temperature: number;
};

export const DEFAULT_POISSON_PARAMS: PoissonParamsPi = {
  rho: -0.05,
  league_home_attack: 1.4,
  league_away_attack: 1.15,
  default_lambda: 1.2,
  temperature: 1,
};

/** Soft Dixon–Coles adjustment on 0-0,1-0,0-1,1-1 cells then renormalize via poisson1x2 proxy. */
function dixonColesAdjust(p: PiProb3, rho: number): PiProb3 {
  // Approximate: shrink draw slightly when rho negative toward home/away balance
  const draw = p.DRAW * (1 + rho * 0.5);
  return normalizeProb3(p.HOME * (1 - rho * 0.15), draw, p.AWAY * (1 - rho * 0.15));
}

export type PoissonIndependentDetail = {
  probability: PiProb3;
  lambda_home: number;
  lambda_away: number;
  attack_home: number | null;
  defense_home: number | null;
  attack_away: number | null;
  defense_away: number | null;
  league_avg_gf: number;
};

export function predictPoissonIndependentDetailed(input: {
  features: PiFeatureVector;
  params?: PoissonParamsPi;
}): PoissonIndependentDetail {
  const p = input.params ?? DEFAULT_POISSON_PARAMS;
  const ha = input.features.values.home_attack_home ?? input.features.values.home_attack_all ?? input.features.values.home_gf_l5 ?? input.features.values.home_xg_l5;
  const hd = input.features.values.home_defense_home ?? input.features.values.home_ga_l5 ?? input.features.values.home_xga_l5;
  const aa = input.features.values.away_attack_away ?? input.features.values.away_attack_all ?? input.features.values.away_gf_l5 ?? input.features.values.away_xg_l5;
  const ad = input.features.values.away_defense_away ?? input.features.values.away_ga_l5 ?? input.features.values.away_xga_l5;
  const league = input.features.values.league_avg_gf ?? p.default_lambda;

  let homeLambda = Math.max(
    0.2,
    ((ha ?? league) * (ad ?? league)) / Math.max(0.4, league),
  );
  let awayLambda = Math.max(
    0.2,
    ((aa ?? league * 0.85) * (hd ?? league)) / Math.max(0.4, league),
  );

  // Mild DI adjustments — only when ELIGIBLE values present in bag (never odds).
  const injH = input.features.values.home_injuries_n;
  const injA = input.features.values.away_injuries_n;
  if (injH != null && Number.isFinite(injH)) {
    homeLambda *= Math.max(0.7, 1 - 0.04 * Math.min(8, injH));
  }
  if (injA != null && Number.isFinite(injA)) {
    awayLambda *= Math.max(0.7, 1 - 0.04 * Math.min(8, injA));
  }
  const eloDiff = input.features.values.elo_diff;
  if (eloDiff != null && Number.isFinite(eloDiff)) {
    const scale = Math.max(-0.25, Math.min(0.25, eloDiff / 400));
    homeLambda *= 1 + scale;
    awayLambda *= 1 - scale;
  }

  const raw = poisson1x2({ homeLambda, awayLambda }, 8);
  const base = dixonColesAdjust(normalizeProb3(raw.HOME, raw.DRAW, raw.AWAY), p.rho);
  const probability = applyTemperature(base, p.temperature ?? 1);
  return {
    probability,
    lambda_home: homeLambda,
    lambda_away: awayLambda,
    attack_home: ha ?? null,
    defense_home: hd ?? null,
    attack_away: aa ?? null,
    defense_away: ad ?? null,
    league_avg_gf: league,
  };
}

export function predictPoissonIndependent(input: {
  features: PiFeatureVector;
  params?: PoissonParamsPi;
}): PiProb3 {
  return predictPoissonIndependentDetailed(input).probability;
}

/** Fit rho on TRAIN only by minimizing mean log-loss (coarse grid). */
export function fitPoissonRho(
  train: { features: PiFeatureVector; label: "HOME" | "DRAW" | "AWAY" }[],
  seed = 42,
): PoissonParamsPi {
  void seed;
  let best = DEFAULT_POISSON_PARAMS.rho;
  let bestLoss = Infinity;
  for (const rho of [-0.15, -0.1, -0.05, 0, 0.05]) {
    let loss = 0;
    for (const row of train) {
      const p = predictPoissonIndependent({ features: row.features, params: { ...DEFAULT_POISSON_PARAMS, rho } });
      loss += -Math.log(Math.max(1e-12, p[row.label]));
    }
    loss /= Math.max(1, train.length);
    if (loss < bestLoss) {
      bestLoss = loss;
      best = rho;
    }
  }
  return { ...DEFAULT_POISSON_PARAMS, rho: best };
}

export function teamLambdasFromHistory(
  target: PiMatchRow,
  universe: readonly PiMatchRow[],
): { homeLambda: number; awayLambda: number } {
  const cut = featureCutoffForMatch(target);
  const priors = priorMatchesAsOf(universe, cut).filter((m) => m.league === target.league);
  const season = priors.filter((m) => m.season === target.season);
  const base = season.length >= 20 ? season : priors;
  let hg = 0;
  let hn = 0;
  let ag = 0;
  let an = 0;
  for (const m of base) {
    if (m.home_team_id === target.home_team_id) {
      hg += m.fthg;
      hn += 1;
    }
    if (m.away_team_id === target.away_team_id) {
      ag += m.ftag;
      an += 1;
    }
  }
  return {
    homeLambda: hn ? hg / hn : 1.35,
    awayLambda: an ? ag / an : 1.1,
  };
}
