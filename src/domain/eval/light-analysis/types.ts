/**
 * Analisi light — lean independent frequencies from real historical rows.
 * Never invents percentages. Odds stay MARKET / compare-only.
 */

/** Light-only sample floor. Strong coverage / missing_keys gates stay untouched. */
export const LIGHT_MIN_N = 4;
export const LIGHT_MIN_N_SOFT = 3;
/** Internal status label — consumer UI must show an em-dash, not this sentence. */
export const LIGHT_INSUFFICIENT_IT = "dato insufficiente";
export const LIGHT_MISSING_UI = "—";
export const LIGHT_MODE = "light" as const;
export const STRONG_MODE = "strong" as const;

export type LightMode = typeof LIGHT_MODE;
export type StrongMode = typeof STRONG_MODE;

export type LightEstimateStatus = "OK" | "INSUFFICIENT";

export type HistoricalMatchRow = {
  home: string;
  away: string;
  date: string;
  home_goals: number | null;
  away_goals: number | null;
  home_corners: number | null;
  away_corners: number | null;
  league: string | null;
  source_id: string;
};

export type LightMarketEstimate = {
  market: string;
  line: number | null;
  selection: string;
  label_it: string;
  probability: number | null;
  n: number;
  status: LightEstimateStatus;
  insufficient_it: typeof LIGHT_INSUFFICIENT_IT | null;
  source_ids: string[];
  method: "empirical_frequency";
  enters_strong_model: false;
};

export type LightAttachHit = {
  source_id: string;
  ok: boolean;
  fetched: boolean;
  fields: string[];
  reason: string;
  parser_status: "SUCCESS" | "NO_EVENT" | "NO_DATA";
  url: string | null;
};

export type LightHistoryCounts = {
  home_home: number;
  away_away: number;
  team_any: number;
  corners: number;
};

export type LightAnalysis = {
  event_id: string;
  home: string;
  away: string;
  competition: string | null;
  kickoff_utc: string | null;
  sport: string;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
  analyzed_at: string;
  mode: LightMode;
  mode_label_it: "Light";
  sources_used: string[];
  attach: LightAttachHit[];
  markets: LightMarketEstimate[];
  favorite_1x2: "home" | "draw" | "away" | null;
  prose: string[];
  history_n: LightHistoryCounts;
  identity_fail_closed: true;
  odds_entered_model: false;
  strong_available: boolean;
  strong_unavailable_it: string | null;
  light_match: "alias";
};

export type AnalyzedListRow = {
  event_id: string;
  home: string;
  away: string;
  competition: string | null;
  kickoff_utc: string | null;
  sport: string;
  status: string | null;
  minute: string | null;
  score_home: number | null;
  score_away: number | null;
  analyzed_at: string | null;
  light: boolean;
  strong: boolean;
  light_label_it: "Light" | null;
  strong_label_it: "Forte" | null;
  strong_unavailable_it: string | null;
  favorite_1x2: "home" | "draw" | "away" | null;
  markets: LightMarketEstimate[];
  prose: string[];
  sources_used: string[];
};

export type RefreshEventsReport = {
  ok: boolean;
  at: string;
  date: string;
  progress_it: string;
  events_seen: number;
  light_ok: number;
  light_insufficient: number;
  attach_hits: number;
  acquisition: {
    attempted: boolean;
    timed_out: boolean;
    sources_ok: string[];
    sources_failed: string[];
    note_it: string;
  };
  history: {
    rows: number;
    cache: string;
    from_cache: boolean;
    note_it: string;
  };
  brain_ran: false;
  snapshot_invalidated: boolean;
  errors: string[];
  event_ids: string[];
};
