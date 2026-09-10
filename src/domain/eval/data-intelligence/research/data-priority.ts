/**
 * Source preference per feature family. First listed is preferred when data exists.
 * Never pick a source only because it responded first.
 */

export type FeatureFamilyId =
  | "xg"
  | "form_results"
  | "shots"
  | "corners"
  | "cards"
  | "clean_sheets"
  | "lineups"
  | "injuries"
  | "elo"
  | "h2h"
  | "weather"
  | "market"
  | "ppda"
  | "possession"
  | "coach"
  | "tactics";

export const FEATURE_SOURCE_PRIORITY: Record<FeatureFamilyId, string[]> = {
  xg: ["understat", "the-analyst", "opta", "fbref"],
  form_results: ["football-data-co-uk", "club-football-match-data", "api-sports"],
  shots: ["football-data-co-uk", "fbref", "api-sports"],
  corners: ["football-data-co-uk", "api-sports"],
  cards: ["football-data-co-uk", "api-sports"],
  clean_sheets: ["football-data-co-uk", "api-sports"],
  lineups: ["api-sports", "sofascore"],
  injuries: ["api-sports", "sofascore"],
  elo: ["clubelo"],
  h2h: ["football-data-co-uk", "club-football-match-data"],
  weather: ["open-meteo"],
  market: ["the-odds-api"],
  ppda: ["fbref", "whoscored"],
  possession: ["fbref", "sofascore", "api-sports"],
  coach: ["api-sports", "sofascore"],
  tactics: ["whoscored", "fbref"],
};

export function preferredSources(family: FeatureFamilyId): string[] {
  return FEATURE_SOURCE_PRIORITY[family] ?? [];
}
