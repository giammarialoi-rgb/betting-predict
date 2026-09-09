/** Market taxonomy: sport → market_group → market_type. Never invent missing markets. */

export type MarketTaxonomyEntry044 = {
  sport: string;
  market_group: string;
  market_type: string;
};

export const SOCCER_MARKET_TYPES_044 = [
  "1X2",
  "DOUBLE_CHANCE",
  "DRAW_NO_BET",
  "ASIAN_HANDICAP",
  "OVER_UNDER",
  "BTTS",
  "CORRECT_SCORE",
  "HALF_TIME",
  "HALF_TIME_RESULT",
  "TEAM_TOTAL",
  "CORNERS",
  "CORNER_HANDICAP",
  "CORNER_OVER_UNDER",
  "CARDS",
  "CARD_HANDICAP",
  "CARD_OVER_UNDER",
  "PLAYER_MARKETS",
  "COMBO_MARKETS",
  "OTHER",
] as const;

export const TENNIS_MARKET_TYPES_044 = [
  "MATCH_WINNER",
  "SET_WINNER",
  "GAME_HANDICAP",
  "SET_HANDICAP",
  "GAME_TOTAL",
  "SET_TOTAL",
  "PLAYER_TOTAL",
  "CORRECT_SCORE",
  "OTHER",
] as const;

export function normalizeMarketType044(rawMarket: string, sportKind: string): MarketTaxonomyEntry044 {
  const m = rawMarket.toUpperCase().replace(/\s+/g, "_");
  if (sportKind === "tennis") {
    if (m.includes("H2H") || m === "1X2" || m.includes("WINNER") || m === "MATCH") {
      return { sport: "tennis", market_group: "MATCH", market_type: "MATCH_WINNER" };
    }
    if (m.includes("SET") && (m.includes("HANDICAP") || m.includes("SPREAD"))) {
      return { sport: "tennis", market_group: "SETS", market_type: "SET_HANDICAP" };
    }
    if (m.includes("SET") && (m.includes("TOTAL") || m.includes("OVER"))) {
      return { sport: "tennis", market_group: "SETS", market_type: "SET_TOTAL" };
    }
    if (m.includes("SET")) return { sport: "tennis", market_group: "SETS", market_type: "SET_WINNER" };
    if (m.includes("GAME") && (m.includes("HANDICAP") || m.includes("SPREAD"))) {
      return { sport: "tennis", market_group: "GAMES", market_type: "GAME_HANDICAP" };
    }
    if (m.includes("GAME") && (m.includes("TOTAL") || m.includes("OVER"))) {
      return { sport: "tennis", market_group: "GAMES", market_type: "GAME_TOTAL" };
    }
    if (m.includes("CORRECT")) return { sport: "tennis", market_group: "SCORE", market_type: "CORRECT_SCORE" };
    return { sport: "tennis", market_group: "OTHER", market_type: "OTHER" };
  }

  if (m === "1X2" || m === "H2H" || m === "MATCH_ODDS") {
    return { sport: "soccer", market_group: "MATCH_RESULT", market_type: "1X2" };
  }
  if (m.includes("DOUBLE") || m === "DC") {
    return { sport: "soccer", market_group: "MATCH_RESULT", market_type: "DOUBLE_CHANCE" };
  }
  if (m.includes("DNB") || m.includes("DRAW_NO_BET")) {
    return { sport: "soccer", market_group: "MATCH_RESULT", market_type: "DRAW_NO_BET" };
  }
  if (m.includes("ASIAN") || m.includes("AH") || (m.includes("HANDICAP") && !m.includes("CORNER") && !m.includes("CARD"))) {
    return { sport: "soccer", market_group: "HANDICAP", market_type: "ASIAN_HANDICAP" };
  }
  if (m.includes("BTTS") || m.includes("BOTH_TEAMS")) {
    return { sport: "soccer", market_group: "GOALS", market_type: "BTTS" };
  }
  if (m.includes("CORRECT") || m === "CS") {
    return { sport: "soccer", market_group: "SCORE", market_type: "CORRECT_SCORE" };
  }
  if (m.includes("HALF") || m.includes("HT") || m.includes("1ST_HALF")) {
    return { sport: "soccer", market_group: "PERIOD", market_type: "HALF_TIME_RESULT" };
  }
  if (m.includes("CORNER") && m.includes("HANDICAP")) {
    return { sport: "soccer", market_group: "CORNERS", market_type: "CORNER_HANDICAP" };
  }
  if (m.includes("CORNER") && (m.includes("OVER") || m.includes("TOTAL"))) {
    return { sport: "soccer", market_group: "CORNERS", market_type: "CORNER_OVER_UNDER" };
  }
  if (m.includes("CORNER")) return { sport: "soccer", market_group: "CORNERS", market_type: "CORNERS" };
  if (m.includes("CARD") && m.includes("HANDICAP")) {
    return { sport: "soccer", market_group: "CARDS", market_type: "CARD_HANDICAP" };
  }
  if (m.includes("CARD") && (m.includes("OVER") || m.includes("TOTAL"))) {
    return { sport: "soccer", market_group: "CARDS", market_type: "CARD_OVER_UNDER" };
  }
  if (m.includes("CARD") || m.includes("BOOKING")) {
    return { sport: "soccer", market_group: "CARDS", market_type: "CARDS" };
  }
  if (m.includes("PLAYER")) return { sport: "soccer", market_group: "PLAYER", market_type: "PLAYER_MARKETS" };
  if (m.includes("TEAM") && (m.includes("TOTAL") || m.includes("OVER"))) {
    return { sport: "soccer", market_group: "GOALS", market_type: "TEAM_TOTAL" };
  }
  if (m.includes("OU") || m.includes("TOTAL") || m.includes("OVER") || m.includes("UNDER")) {
    return { sport: "soccer", market_group: "GOALS", market_type: "OVER_UNDER" };
  }
  if (m.includes("COMBO") || m.includes("BET_BUILDER")) {
    return { sport: "soccer", market_group: "COMBO", market_type: "COMBO_MARKETS" };
  }
  return { sport: sportKind === "soccer" ? "soccer" : sportKind, market_group: "OTHER", market_type: "OTHER" };
}
