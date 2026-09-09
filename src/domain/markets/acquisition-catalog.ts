/**
 * Acquisition market catalog — catalogued ≠ observed.
 */

export type AcquisitionMarketEntry = {
  market_type: string;
  lines: number[] | null;
  selections: string[];
  status: "CATALOGUED" | "OBSERVED" | "VALIDATED" | "MODEL_READY";
  family:
    | "result"
    | "goals"
    | "handicap"
    | "ht"
    | "correct_score"
    | "team"
    | "corners"
    | "cards"
    | "player"
    | "derived";
};

export const FOOTBALL_ACQUISITION_MARKET_CATALOG: readonly AcquisitionMarketEntry[] =
  Object.freeze([
    {
      market_type: "result",
      lines: null,
      selections: ["HOME", "DRAW", "AWAY"],
      status: "CATALOGUED",
      family: "result",
    },
    {
      market_type: "double_chance",
      lines: null,
      selections: ["HOME_DRAW", "HOME_AWAY", "DRAW_AWAY"],
      status: "CATALOGUED",
      family: "result",
    },
    {
      market_type: "draw_no_bet",
      lines: null,
      selections: ["HOME", "AWAY"],
      status: "CATALOGUED",
      family: "result",
    },
    {
      market_type: "total_goals",
      lines: [0.5, 1.5, 2.5, 3.5, 4.5],
      selections: ["OVER", "UNDER"],
      status: "CATALOGUED",
      family: "goals",
    },
    {
      market_type: "team_total_goals",
      lines: [0.5, 1.5, 2.5],
      selections: ["HOME_OVER", "HOME_UNDER", "AWAY_OVER", "AWAY_UNDER"],
      status: "CATALOGUED",
      family: "team",
    },
    {
      market_type: "both_teams_to_score",
      lines: null,
      selections: ["YES", "NO"],
      status: "CATALOGUED",
      family: "goals",
    },
    {
      market_type: "asian_handicap",
      lines: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
      selections: ["HOME", "AWAY"],
      status: "CATALOGUED",
      family: "handicap",
    },
    {
      market_type: "european_handicap",
      lines: [-2, -1, 1, 2],
      selections: ["HOME", "DRAW", "AWAY"],
      status: "CATALOGUED",
      family: "handicap",
    },
    {
      market_type: "ht_result",
      lines: null,
      selections: ["HOME", "DRAW", "AWAY"],
      status: "CATALOGUED",
      family: "ht",
    },
    {
      market_type: "ht_total_goals",
      lines: [0.5, 1.5],
      selections: ["OVER", "UNDER"],
      status: "CATALOGUED",
      family: "ht",
    },
    {
      market_type: "ht_btts",
      lines: null,
      selections: ["YES", "NO"],
      status: "CATALOGUED",
      family: "ht",
    },
    {
      market_type: "correct_score",
      lines: null,
      selections: ["0-0", "1-0", "0-1", "1-1", "2-0", "0-2", "2-1", "1-2", "2-2", "OTHER"],
      status: "CATALOGUED",
      family: "correct_score",
    },
    {
      market_type: "team_clean_sheet",
      lines: null,
      selections: ["HOME_YES", "HOME_NO", "AWAY_YES", "AWAY_NO"],
      status: "CATALOGUED",
      family: "team",
    },
    {
      market_type: "corners",
      lines: [8.5, 9.5, 10.5],
      selections: ["OVER", "UNDER"],
      status: "CATALOGUED",
      family: "corners",
    },
    {
      market_type: "cards",
      lines: [3.5, 4.5],
      selections: ["OVER", "UNDER"],
      status: "CATALOGUED",
      family: "cards",
    },
    {
      market_type: "player_goals",
      lines: [0.5, 1.5],
      selections: ["OVER", "UNDER"],
      status: "CATALOGUED",
      family: "player",
    },
  ]);

export function markObserved(
  catalog: readonly AcquisitionMarketEntry[],
  observedTypes: ReadonlySet<string>,
): AcquisitionMarketEntry[] {
  return catalog.map((m) =>
    observedTypes.has(m.market_type)
      ? { ...m, status: "OBSERVED" as const }
      : m,
  );
}
