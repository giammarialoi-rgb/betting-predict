export const FROZEN_031_SHA256_044 = "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export type SemanticLevel044 = "STRICT" | "RESEARCH" | "PARTIAL" | "AMBIGUOUS" | "INVALID";

export type LabVerdict044 =
  | "PROSPECTIVE_LAB_FOUNDATION"
  | "INFRASTRUCTURE_READY"
  | "LIVE_DATA_ACCUMULATION"
  | "PARTIAL"
  | "BLOCKED"
  | "FAILED"
  | "LIVE_COLLECTING"
  | "INSUFFICIENT_DATA"
  | "NO_DEMONSTRATED_EDGE"
  | "EDGE_DETECTED_PENDING_HOLDOUT"
  | "EDGE_DEMONSTRATED";

export type RankingBucket044 =
  | "TOP_MODEL_MATCHES"
  | "TOP_MARKET_DISLOCATIONS"
  | "TOP_CONFIDENCE"
  | "TOP_VALUE_CANDIDATES"
  | "HIGH_UNCERTAINTY"
  | "NO_BET";

export type TimelineWindow044 =
  | "T-72h"
  | "T-48h"
  | "T-24h"
  | "T-12h"
  | "T-6h"
  | "T-3h"
  | "T-1h"
  | "T-30m"
  | "T-15m"
  | "T-5m"
  | "T-1m"
  | "KICKOFF";

export type SnapshotStatus044 = "OBSERVED" | "MISSING";

export type MissingReason044 =
  | "NO_SOURCE"
  | "NO_MARKET"
  | "OUTSIDE_WINDOW"
  | "TIMESTAMP_INVALID"
  | "EVENT_NOT_DISCOVERED"
  | "API_LIMIT"
  | "OTHER";

export type LearningStatus044 = "OBSERVED" | "REVIEW" | "EXPERIMENT" | "VALIDATED" | "REJECTED" | "PROMOTABLE";

export type PermanentEvent044 = {
  event_id: string;
  canonical_event_id: string;
  source: string;
  source_event_id: string;
  source_event_ids?: string[];
  sport: string;
  competition: string;
  country: string | null;
  home_or_a: string;
  away_or_b: string;
  kickoff_utc: string | null;
  collected_at_utc: string;
  available_at_utc: string | null;
  semantic_level: SemanticLevel044;
  data_quality: number;
  fingerprint: string;
  status: string;
  /** LAB_A_SEED = inherited 114 corpus; DISCOVERED_LIVE = factory-045+ growth */
  origin?: "LAB_A_SEED" | "DISCOVERED_LIVE";
  first_seen_at?: string;
  last_seen_at?: string;
  canonicalization_status?: "MATCH_EXACT" | "AMBIGUOUS_MATCH" | "PARTIAL";
  /** Real API-Football fixture id when observed (TheSportsDB idAPIfootball). Never invented. */
  api_football_fixture_id?: string | null;
  thesportsdb_event_id?: string | null;
  fixture_id?: number | null;
};

export type PermanentQuote044 = {
  event_id: string;
  bookmaker: string;
  market: string;
  market_group: string;
  market_type: string;
  selection: string;
  line: number | null;
  price: number;
  available_at_utc: string | null;
  collected_at_utc: string;
  source: string;
  market_available: true;
  fingerprint: string;
};

export type PermanentPrediction044 = {
  prediction_id: string;
  event_id: string;
  timestamp: string;
  model_version: string;
  feature_version: string;
  market: string;
  selection: string | null;
  line: number | null;
  probability_model: Record<string, number> | null;
  probability_market: Record<string, number> | null;
  edge_absolute: number | null;
  edge_relative: number | null;
  confidence_score: number;
  data_quality_score: number;
  recommended: false;
  reason_codes: string[];
  risk_flags: string[];
  human_readable_reason: string;
  ranking_bucket: RankingBucket044;
  prediction_seq: number;
  immutable: true;
  /** Phase 3E.1 — producer stamp; optional for historical rows. */
  analysis_runtime_version?: string;
  worker_pid?: number | null;
  cycle_number?: number | null;
};

export type PermanentLock044 = {
  event_id: string;
  lock_timestamp: string;
  decision_context_hash: string;
  model_version: string;
  feature_version: string;
  market_snapshot_hash: string;
  prediction_hash: string;
  lab: "PERMANENT_LIVE";
  /** Reference only — never writes Lab A */
  lab_a_decision_id: string | null;
};

export type PermanentSettlement044 = {
  event_id: string;
  result: string;
  market: string;
  selection: string | null;
  outcome: "won" | "lost" | "push" | "void" | "UNSETTLED";
  settled_at: string;
  source: string;
  source_confidence: number;
};

export type PermanentAutopsy044 = {
  autopsy_id: string;
  event_id: string;
  prediction_id: string;
  result_class: "CORRECT" | "INCORRECT" | "NEUTRAL" | "UNRESOLVED";
  error_type: string | null;
  cause_hypotheses: { hypothesis: string; confidence: number }[];
  evidence: string[];
  learning_candidate: boolean;
  created_at: string;
};

export type LearningCandidate044 = {
  candidate_id: string;
  autopsy_id: string;
  hypothesis: string;
  feature: string | null;
  observed_pattern: string;
  evidence_count: number;
  confidence: number;
  proposed_change: string;
  status: LearningStatus044;
};
