/**
 * TASK 019 types — historical market acquisition + blind replay.
 * TemporalPrecision019 includes `date` for Level C. STRICT still requires exact.
 */

export const PARSER_VERSION = "task-019-parser-v1";

export type TemporalPrecision019 = "exact" | "date" | "dataset_window" | "unknown";

export type OddsLevel = "A" | "B" | "C" | "D";

export type ObservationKind019 =
  | "dataset_open"
  | "dataset_close"
  | "snapshot"
  | "unknown";

export type MarketLifecycle =
  | "CATALOGUED"
  | "DISCOVERED"
  | "OBSERVED"
  | "TEMPORALLY_VALID"
  | "MODEL_READY";

export type FailureReason =
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "SCHEMA_ERROR"
  | "DUPLICATE"
  | "ENTITY_UNMATCHED"
  | "TEMPORAL_UNKNOWN"
  | "TEMPORAL_CONFLICT"
  | "POST_MATCH"
  | "LICENSE_BLOCKED"
  | "INSUFFICIENT_FIELDS"
  | "AGGREGATE_SKIPPED"
  | "CLOSE_NOT_PREMATCH";

export type SourceStage =
  | "ACQUIRED"
  | "PARSED"
  | "NORMALIZED"
  | "MATCHED"
  | "TEMPORALLY_VALID"
  | "MODEL_ELIGIBLE";

export type LicenseStatus = "public_redistribution" | "offline_pack" | "local_secondary" | "blocked" | "unknown";

export type Provenance = {
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  datasetVersion: string;
  sourceHash: string;
  originalFile: string;
  parserVersion: string;
  licenseStatus: LicenseStatus;
};

export type TemporalFields = {
  observedAt: string;
  /** Date-anchor only unless precision=exact. Never invented clock. */
  availableAt: string | null;
  temporalPrecision: TemporalPrecision019;
  temporalBasis: string;
  oddsLevel: OddsLevel;
};

export const TEMPORAL_BASIS_OPEN =
  "documented opening/pre-closing odds field (football-data.co.uk notes.txt); weekend collection Friday afternoon / midweek Tuesday afternoon; no per-row clock; calendar date only";

export const TEMPORAL_BASIS_CLOSE =
  "documented closing-odds field (C suffix or _close); closing is kickoff-adjacent and must not be treated as pre-match available_at";

export const TEMPORAL_BASIS_CLUB =
  "Club-Football Odd* has no documented available_at; TEMPORALLY_UNKNOWN; SECONDARY/RESEARCH_ONLY";

export const TEMPORAL_BASIS_DATE_ONLY = "calendar date only";

export type MarketObservation019 = {
  eventId: string;
  bookmakerId: string;
  marketType: string;
  line: number | null;
  selectionSide: string;
  odds: number;
  observationKind: ObservationKind019;
  sourceId: string;
  originalColumn: string;
} & TemporalFields;

export type NormalizedEvent = {
  canonicalEventId: string;
  sourceEventId: string;
  sourceId: string;
  competition: string;
  season: string;
  matchDate: string;
  year: number;
  homeRaw: string;
  awayRaw: string;
  homeSlug: string;
  awaySlug: string;
  /** Outcome held out of DecisionContext. */
  ftHome: number | null;
  ftAway: number | null;
  result: "HOME" | "DRAW" | "AWAY" | null;
  matchingConfidence: MatchingConfidence;
};

export type MatchingConfidence = "exact_alias" | "deterministic_slug" | "unmatched";

export type EventMatch = {
  leftEventId: string;
  rightEventId: string;
  canonicalEventId: string;
  confidence: MatchingConfidence;
};

export type MatrixRow = {
  source: string;
  competition: string;
  season: string;
  bookmaker: string;
  market: string;
  n: number;
  precision: TemporalPrecision019;
  status: "VALID_DATE" | "VALID_EXACT" | "BLOCKED" | "RESEARCH_ONLY";
  oddsLevel: OddsLevel;
};

export type FailureBudget = Record<FailureReason, number> & {
  acquired_files: number;
  parsed_rows: number;
  normalized_events: number;
  matched_events: number;
  observations_raw: number;
  observations_book: number;
  observations_strict: number;
  observations_date: number;
};

export type NoBetReason019 =
  | "NO_BET_TEMPORAL"
  | "NO_BET_DATA"
  | "NO_BET_MODEL"
  | "NO_BET_RISK"
  | "BET";

export type AnnualRow019 = {
  year: number;
  data_status: "OK" | "INSUFFICIENT_DATA" | "INCOMPLETE";
  events: number;
  events_with_book_odds: number;
  valid_quotes_strict: number;
  valid_quotes_date: number;
  markets: number;
  decisions: number;
  no_bet_temporal: number;
  no_bet_data: number;
  no_bet_model: number;
  no_bet_risk: number;
  bets: number;
  start: number;
  final: number | null;
  pnl: number | null;
  max_dd: number | null;
  wins: number;
  losses: number;
  pushes: number;
  turnover: number;
  largest_loss: number | null;
  largest_exposure: number | null;
  correlated_positions: number;
  note: string;
};

export type MarketCoverageRow019 = {
  market: string;
  events: number;
  valid_observations_date: number;
  valid_observations_strict: number;
  books: number;
  years: string;
  discovered: boolean;
  observed: boolean;
  temporally_valid_date: boolean;
  temporally_valid_strict: boolean;
  model_ready: boolean;
  lifecycle: MarketLifecycle;
};

export type SourceCoverageRow019 = {
  sourceId: string;
  role: string;
  http_status: number | null;
  acquired: boolean;
  parsed: boolean;
  events: number;
  observations: number;
  books: number;
  markets: string[];
  precision: string;
  licenseStatus: LicenseStatus;
  blocker: string | null;
};

export type Exp019Config = {
  experiment_id: string;
  initial_bankroll: number;
  as_of_policy: string;
  declared_edge: false;
  retroactive_optimization: false;
  auto_promote: false;
  winner: null;
  real_money: false;
  holdout_years: number[];
  solar_years: number[];
  parser_version: string;
  sizing: {
    flat_unit: number;
    kelly_fractional_factor: number;
    max_stake_fraction_event: number;
    min_train_events_for_model: number;
  };
};
