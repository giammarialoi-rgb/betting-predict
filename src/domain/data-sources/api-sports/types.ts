/**
 * API-Sports / API-Football data foundation types (TASK 057).
 * Never store API keys in these structures.
 */

export const API_SPORTS_SOURCE = "API_SPORTS" as const;

export type ApiSportsCapabilityStatus057 =
  | "AVAILABLE"
  | "PLAN_LIMITED"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "ERROR"
  | "SKIPPED_BUDGET"
  | "NOT_TESTED";

export type ApiSportsEndpointId057 =
  | "status"
  | "leagues"
  | "fixtures"
  | "teams"
  | "standings"
  | "teams_statistics"
  | "headtohead"
  | "players_statistics"
  | "injuries"
  | "odds"
  | "fixtures_events";

export type ApiSportsCapabilityRow057 = {
  endpoint: ApiSportsEndpointId057;
  path: string;
  sport: "football";
  status: ApiSportsCapabilityStatus057;
  tested_at: string | null;
  http_status: number | null;
  requests_used: number;
  error: string | null;
  fields_available: string[];
  sample_ids?: Record<string, string | number | null>;
};

export type ApiSportsNormalizedEvent057 = {
  source: typeof API_SPORTS_SOURCE;
  provider_event_id: string;
  sport: "football";
  league: string | null;
  league_id: number | null;
  season: number | null;
  home_team: string;
  away_team: string;
  home_team_id: number | null;
  away_team_id: number | null;
  event_time: string | null;
  status_short: string | null;
  score_home: number | null;
  score_away: number | null;
  raw_reference: string;
  observed_at: string;
  schema_version: "057";
};

/** Future independent-model contract — types only, no engine. */
export type IndependentModelContract057 = {
  model_probability: number | null;
  market_probability: number | null;
  edge: number | null;
  ev: number | null;
  decision: "BET_CANDIDATE" | "STRONG_CANDIDATE" | "NO_BET" | "INSUFFICIENT_DATA" | null;
  why: {
    primary_reason: string | null;
    supporting_signals: string[];
    negative_signals: string[];
    missing_information: string[];
  };
  note: "CONTRACT_ONLY_NO_MODEL_v3";
};

export type ApiSportsBudgetState057 = {
  at: string;
  day_utc: string;
  limit_day: number;
  limit_minute: number;
  used_day: number;
  remaining_day: number;
  used_minute: number;
  last_request_at: string | null;
  plan: string | null;
  source: typeof API_SPORTS_SOURCE;
  real_money: false;
  open_task_058: false;
};

export type ApiSportsHealth057 = {
  source: typeof API_SPORTS_SOURCE;
  status: "AVAILABLE" | "PLAN_LIMITED" | "RATE_LIMITED" | "UNAVAILABLE" | "ERROR" | "NOT_CONFIGURED";
  requests_today: number;
  remaining: number | null;
  sports: string[];
  data_types: string[];
  last_success: string | null;
  last_error: string | null;
  plan: string | null;
  key_configured: boolean;
  /** Always false — never expose key material */
  key_exposed: false;
};
