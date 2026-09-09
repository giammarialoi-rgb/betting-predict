/**
 * Candidate feature ids per market — candidates, not auto-approved.
 */

export const MARKET_CANDIDATE_FEATURES: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  result: Object.freeze([
    "elo_difference",
    "form_5_overall",
    "form_5_home",
    "form_5_away",
    "home_advantage_flag",
    "goals_for_5",
    "goals_against_5",
    "shots_for_5",
    "market_implied_probability",
    "bookmaker_disagreement",
    "market_overround",
  ]),
  total_goals: Object.freeze([
    "goals_for_5",
    "goals_against_5",
    "shots_for_5",
    "form_5_overall",
    "market_implied_probability",
    "bookmaker_disagreement",
  ]),
  both_teams_to_score: Object.freeze([
    "goals_for_5",
    "goals_against_5",
    "form_5_overall",
    "market_implied_probability",
  ]),
  asian_handicap: Object.freeze([
    "elo_difference",
    "form_5_overall",
    "market_implied_probability",
    "bookmaker_disagreement",
  ]),
  corner_total: Object.freeze([
    "shots_for_5",
    "form_5_overall",
    "market_implied_probability",
  ]),
  card_total: Object.freeze([
    "form_5_overall",
    "market_implied_probability",
  ]),
  player_shots_on_target: Object.freeze([
    "market_implied_probability",
  ]),
});

export function candidateFeaturesForMarket(marketId: string): readonly string[] {
  return MARKET_CANDIDATE_FEATURES[marketId] ?? [];
}
