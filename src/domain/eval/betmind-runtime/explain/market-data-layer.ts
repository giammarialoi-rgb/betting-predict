/**
 * Data-layer families for future market models.
 * Does not create models. Odds never become independent MODEL features.
 */
export const MARKET_DATA_FAMILIES = [
  { id: "1X2", needed: ["home_gf_l5", "away_gf_l5", "home_ga_l5", "away_ga_l5"] },
  { id: "DOUBLE_CHANCE", needed: ["home_gf_l5", "away_gf_l5"] },
  { id: "OVER_UNDER_0_5", needed: ["league_avg_gf", "home_gf_l5", "away_gf_l5"] },
  { id: "OVER_UNDER_1_5", needed: ["league_avg_gf", "home_gf_l5", "away_gf_l5"] },
  { id: "OVER_UNDER_2_5", needed: ["league_avg_gf", "home_gf_l5", "away_gf_l5"] },
  { id: "OVER_UNDER_3_5", needed: ["league_avg_gf", "home_gf_l5", "away_gf_l5"] },
  { id: "BTTS", needed: ["home_score_cons_l5", "away_score_cons_l5", "home_cs_l5", "away_cs_l5"] },
  { id: "DRAW_NO_BET", needed: ["home_pts_l5", "away_pts_l5"] },
  { id: "TEAM_GOALS", needed: ["home_gf_l5", "away_gf_l5"] },
  { id: "MULTIGOL", needed: ["home_gf_l5", "away_gf_l5", "league_avg_gf"] },
  { id: "CORNERS", needed: ["home_corners_l5", "away_corners_l5"] },
  { id: "CARDS", needed: ["home_cards_l5", "away_cards_l5"] },
] as const;

export type MarketDataFamilyId = (typeof MARKET_DATA_FAMILIES)[number]["id"];
