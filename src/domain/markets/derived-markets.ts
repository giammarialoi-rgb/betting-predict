/**
 * Derived market probabilities from a goal distribution — not MODEL_READY by themselves.
 */

import {
  poisson1x2,
  poissonOverProbability,
  poissonPmf,
  type PoissonGoalRates,
} from "@/domain/eval/poisson-baseline";

export type DerivedMarketProbability = {
  market: string;
  line: number | null;
  selection: string;
  probability: number;
  derived_from: "poisson_independent";
  /** Mathematical derivation ≠ observed market validation. */
  model_ready: false;
};

export function deriveMarketsFromPoisson(
  rates: PoissonGoalRates,
  maxGoals = 8,
): DerivedMarketProbability[] {
  const out: DerivedMarketProbability[] = [];
  const push = (
    market: string,
    line: number | null,
    selection: string,
    probability: number,
  ) => {
    out.push({
      market,
      line,
      selection,
      probability,
      derived_from: "poisson_independent",
      model_ready: false,
    });
  };

  const r1x2 = poisson1x2(rates, maxGoals);
  push("result", null, "HOME", r1x2.HOME);
  push("result", null, "DRAW", r1x2.DRAW);
  push("result", null, "AWAY", r1x2.AWAY);

  for (const line of [0.5, 1.5, 2.5, 3.5]) {
    const over = poissonOverProbability(rates, line, maxGoals);
    push("total_goals", line, "OVER", over);
    push("total_goals", line, "UNDER", 1 - over);
  }

  // BTTS
  let bttsYes = 0;
  for (let h = 1; h <= maxGoals; h++) {
    for (let a = 1; a <= maxGoals; a++) {
      bttsYes +=
        poissonPmf(h, rates.homeLambda) * poissonPmf(a, rates.awayLambda);
    }
  }
  push("both_teams_to_score", null, "YES", bttsYes);
  push("both_teams_to_score", null, "NO", 1 - bttsYes);

  // Team goals over 0.5 / 1.5
  for (const line of [0.5, 1.5]) {
    let homeOver = 0;
    let awayOver = 0;
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p =
          poissonPmf(h, rates.homeLambda) * poissonPmf(a, rates.awayLambda);
        if (h > line) homeOver += p;
        if (a > line) awayOver += p;
      }
    }
    push("team_total_goals", line, "HOME_OVER", homeOver);
    push("team_total_goals", line, "AWAY_OVER", awayOver);
  }

  // Correct score top cells (distribution, not MODEL_READY)
  for (let h = 0; h <= 3; h++) {
    for (let a = 0; a <= 3; a++) {
      push(
        "correct_score",
        null,
        `${h}-${a}`,
        poissonPmf(h, rates.homeLambda) * poissonPmf(a, rates.awayLambda),
      );
    }
  }

  return out;
}
