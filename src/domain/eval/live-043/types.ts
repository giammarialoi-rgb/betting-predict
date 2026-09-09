export const SNAPSHOT_WINDOWS_043 = [
  "T-72H",
  "T-24H",
  "T-6H",
  "T-3H",
  "T-1H",
  "T-30M",
  "T-15M",
  "T-5M",
  "T-1M",
] as const;

export type SnapshotWindow043 = (typeof SNAPSHOT_WINDOWS_043)[number];

export type PredictionStatus043 =
  | "ANALYZED"
  | "PARTIAL_DATA"
  | "NO_EDGE"
  | "CANDIDATE"
  | "LOCKED"
  | "SETTLED"
  | "AUTOPSY_PENDING"
  | "AUTOPSY_DONE";

export type CandidateClass043 = "NO_SIGNAL" | "WATCH" | "CANDIDATE" | "STRONG_CANDIDATE";

export type MarketFamily043 =
  | "MARKET_1X2"
  | "AH"
  | "OU"
  | "BTTS"
  | "DNB"
  | "DC"
  | "CS"
  | "CORNERS"
  | "CARDS"
  | "PLAYER"
  | "TENNIS_WINNER"
  | "TENNIS_SET"
  | "TENNIS_GAMES"
  | "OTHER"
  | "INSUFFICIENT_N";

export type AutopsyClass043 =
  | "MODEL_OVERCONFIDENCE"
  | "MODEL_UNDERCONFIDENCE"
  | "MISSED_FEATURE"
  | "DATA_QUALITY"
  | "MARKET_MOVEMENT"
  | "REGIME_CHANGE"
  | "BAD_CALIBRATION"
  | "BAD_MODEL_SPECIFICATION"
  | "RANDOM_VARIANCE"
  | "INSUFFICIENT_INFORMATION";

export type LabVerdict043 =
  | "LIVE_BUILD_READY"
  | "LIVE_COLLECTING"
  | "INSUFFICIENT_DATA"
  | "NO_DEMONSTRATED_EDGE"
  | "EDGE_DETECTED_PENDING_HOLDOUT"
  | "EDGE_DEMONSTRATED";

export type CatalogEvent043 = {
  event_id: string;
  sport: "soccer" | "tennis" | "other";
  competition: string;
  country: string | null;
  season: string | null;
  home_or_a: string;
  away_or_b: string;
  commence_time: string | null;
  status: string;
  source: string;
  discovered_at: string;
  event_source_id: string;
  stable_key: string;
};

export type Triangulation043 = {
  event_id: string;
  market: string;
  market_family: MarketFamily043;
  as_of: string;
  n_books: number;
  best_price: Record<string, number | null>;
  worst_price: Record<string, number | null>;
  median_price: Record<string, number | null>;
  mean_price: Record<string, number | null>;
  consensus_devig: Record<string, number | null>;
  dispersion: number | null;
  spread: number | null;
  movement: number | null;
  movement_velocity: number | null;
  disagreement: number | null;
  status: "OK" | "INSUFFICIENT_N";
};

export type Snapshot043 = {
  event_id: string;
  window: SnapshotWindow043;
  snapshot_time: string;
  seconds_to_kickoff: number | null;
  source_available_at: string;
  collected_at: string;
  market_snapshot: Record<string, unknown>;
  model_snapshot: Record<string, unknown>;
  features_snapshot: Record<string, unknown>;
  model_version: string;
};

export type PredictionRecord043 = {
  event_id: string;
  sport: string;
  status: PredictionStatus043;
  candidate_class: CandidateClass043;
  model_version: string;
  model_probability: Record<string, number> | null;
  market_probability: Record<string, number> | null;
  delta_probability: Record<string, number> | null;
  edge_candidate: boolean;
  data_quality: number;
  model_confidence: number;
  uncertainty: number;
  as_of: string | null;
  locked: boolean;
  formal_scientific: boolean;
  created_at: string;
  updated_at: string;
};

export type AutopsyRecord043 = {
  event_id: string;
  model_version: string;
  classes: AutopsyClass043[];
  prediction_error: number | null;
  brier: number | null;
  notes: string;
  learning_candidate: boolean;
  created_at: string;
};

export type ModelRegistry043 = {
  current_version: string;
  versions: {
    version: string;
    training_cutoff: string | null;
    training_events: number;
    validation_events: number;
    features_used: string[];
    hyperparameters: Record<string, unknown>;
    creation_timestamp: string;
    dataset_fingerprint: string;
    production: boolean;
  }[];
};
