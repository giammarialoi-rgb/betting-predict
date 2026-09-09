/**
 * Structural market correlation registry — no invented numeric correlations.
 */

export type StructuralRelation = {
  id: string;
  markets: string[];
  kind:
    | "same_event"
    | "same_market_family"
    | "same_underlying_variable"
    | "cross_market";
  estimatedCorrelation: null;
  notes: string;
};

export const MARKET_CORRELATION_REGISTRY: readonly StructuralRelation[] =
  Object.freeze([
    {
      id: "result_goals_btts",
      markets: ["result", "total_goals", "both_teams_to_score", "team_total_goals"],
      kind: "same_underlying_variable",
      estimatedCorrelation: null,
      notes: "Scoring intensity family — measure later, do not invent ρ",
    },
    {
      id: "result_handicap",
      markets: ["result", "asian_handicap", "handicap", "double_chance"],
      kind: "same_market_family",
      estimatedCorrelation: null,
      notes: "Ordering / result family",
    },
    {
      id: "halves_family",
      markets: ["ht_result", "ht_total_goals", "ht_btts", "ht_ft"],
      kind: "cross_market",
      estimatedCorrelation: null,
      notes: "Half-time markets share match dynamics",
    },
    {
      id: "corners_cards",
      markets: ["corners", "corner_total", "cards", "card_total"],
      kind: "cross_market",
      estimatedCorrelation: null,
      notes: "Set-piece / discipline family",
    },
    {
      id: "player_props",
      markets: [
        "player_goals",
        "player_shots",
        "player_shots_on_target",
        "player_cards",
      ],
      kind: "same_event",
      estimatedCorrelation: null,
      notes: "Player props correlate with team attack — structure only",
    },
  ]);

export function relatedMarkets(marketId: string): string[] {
  const out = new Set<string>();
  for (const rel of MARKET_CORRELATION_REGISTRY) {
    if (rel.markets.includes(marketId)) {
      for (const m of rel.markets) if (m !== marketId) out.add(m);
    }
  }
  return [...out];
}

export function assertNoInventedCorrelation(value: number | null): void {
  if (value !== null) {
    throw new Error(
      "CORRELATION_GUARD: numeric correlation not allowed without measured data",
    );
  }
}
