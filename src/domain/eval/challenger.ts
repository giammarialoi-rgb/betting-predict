/**
 * Challenger / self-learning foundation — NO automatic champion promotion.
 */

export type ModelRole = "champion" | "challenger" | "retired";

export type ModelVersionRecord = {
  model_version: string;
  role: ModelRole;
  created_at: string;
};

export type ChallengerEvaluation = {
  challenger_version: string;
  champion_version: string;
  walk_forward_passed: boolean;
  holdout_passed: boolean;
  minimum_sample_met: boolean;
  statistical_significance: boolean;
  human_review: "pending" | "approved" | "rejected";
};

export function assertNoAutoChampionPromotion(action: string): void {
  if (
    action === "auto_promote" ||
    action === "automatic_champion_promotion"
  ) {
    throw new Error(
      "CHALLENGER_GUARD: automatic champion promotion forbidden — require walk-forward, holdout, sample, significance, human review",
    );
  }
}

export function canPromoteChallenger(eval_: ChallengerEvaluation): boolean {
  return (
    eval_.walk_forward_passed &&
    eval_.holdout_passed &&
    eval_.minimum_sample_met &&
    eval_.statistical_significance &&
    eval_.human_review === "approved"
  );
}
