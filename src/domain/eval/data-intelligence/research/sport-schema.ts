/**
 * Sport-agnostic research categories. Football is implemented; tennis is typed only.
 */
export const FOOTBALL_RESEARCH_CATEGORIES = [
  "forma",
  "attacco",
  "difesa",
  "set_pieces",
  "home_away_splits",
  "h2h",
  "xg",
  "infortunii",
  "squalifiche",
  "formazioni",
  "arbitro",
  "meteo",
  "riposo",
  "competizione",
  "tattico",
] as const;

export const TENNIS_RESEARCH_CATEGORIES = [
  "ranking",
  "surface",
  "recent_form",
  "service_points",
  "return_points",
  "hold_pct",
  "break_pct",
  "aces",
  "double_faults",
  "first_serve_pct",
  "first_serve_points_won",
  "second_serve_points_won",
  "opponent_quality",
  "h2h",
  "fatigue",
  "recent_matches",
] as const;

export type FootballResearchCategory = (typeof FOOTBALL_RESEARCH_CATEGORIES)[number];
export type TennisResearchCategory = (typeof TENNIS_RESEARCH_CATEGORIES)[number];
