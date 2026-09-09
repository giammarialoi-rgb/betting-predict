import type { IntegrityCode036 } from "@/domain/eval/prospective-036/types";

export const FROZEN_031_SHA256_037 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export type LakeClass037 =
  | "STRICT"
  | "RESEARCH_TEMPORAL"
  | "DATE_ONLY"
  | "POSTMATCH"
  | "REFERENCE"
  | "UNKNOWN"
  | "NAIVE_DATETIME"
  | "DATASET_NOT_PRESENT"
  | "PARSER_NO_DATA"
  | "BLOCKED_LOGIN"
  | "NOT_FOUND";

export type Level037 = "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "NONE";

export type Role037 = "RAW" | "REPOSITORY" | "MIRROR" | "DERIVATIVE" | "PARSER";

export type MatchGrade037 = "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED";

export type LabVerdict037 =
  | "SUCCESS_A"
  | "SUCCESS_B"
  | "SUCCESS_C"
  | "MODEL_EDGE_DETECTED"
  | "NO_DEMONSTRATED_EDGE"
  | "FINAL_BLOCKER";

export type Exp037Config = {
  experiment_id: string;
  dataset_version: string;
  baseline: string;
  baseline_devig: "proportional";
  min_strict_events: number;
  min_strict_success_a: number;
  test_locked: true;
  holdout_locked: true;
  winner: null;
  auto_promotion: false;
  auto_promote: false;
  real_money: false;
  invent_timestamps: false;
  invent_timezone: false;
  invent_quotes: false;
  invent_events: false;
  invent_kickoff: false;
  synthetic_data: false;
  use_user_credentials: false;
  bypass_auth: false;
  mirror_as_independent: false;
  modify_frozen_031: false;
  open_task_038: false;
  count_legacy_031_as_new_strict: false;
  client_retrieved_as_quote: false;
  date_only_promoted_to_strict: false;
  close_in_decision: false;
  capital_gate: false;
  legacy_dataset_sha256: string;
};

export type RepoSpec037 = {
  id: string;
  repository: string;
  cluster: string;
  role: Role037;
  mandatory: boolean;
};

export type FileManifest037 = {
  path: string;
  sha256: string | null;
  bytes: number;
  records: number | null;
  peeked_header: string | null;
};

export type RepoHarvest037 = {
  id: string;
  repository: string;
  cluster: string;
  role: Role037;
  exists: boolean;
  commit: string | null;
  clone_path: string | null;
  file_count: number;
  bytes: number;
  classification: LakeClass037;
  level: Level037;
  kickoff_semantics: string;
  timestamp_semantics: string;
  markets: string[];
  bookmakers: string[];
  events_est: number;
  records_est: number;
  date_min: string | null;
  date_max: string | null;
  license: string | null;
  why: string;
  files: FileManifest037[];
};

export type Quote037 = {
  event_id: string;
  competition: string | null;
  season: string | null;
  home: string;
  away: string;
  kickoff_utc: string | null;
  quote_timestamp_utc: string | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  source: string;
  bookmaker: string | null;
  temporal_basis: string;
  quote_has_offset: boolean;
  kickoff_has_offset: boolean;
  client_retrieved_at: string | null;
  ft_home: number | null;
  ft_away: number | null;
};

export type IntegrityCode037 = IntegrityCode036 | "CLIENT_TIMESTAMP_AS_QUOTE" | "MIRROR_AS_INDEPENDENT";
