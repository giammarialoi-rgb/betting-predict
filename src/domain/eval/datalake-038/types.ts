import type { Window036 } from "@/domain/eval/prospective-036/types";
import { FROZEN_031_SHA256_037 } from "@/domain/eval/harvest-037/types";

export const FROZEN_031_SHA256_038 = FROZEN_031_SHA256_037;

export const WINDOWS_038 = [
  "T-72h",
  "T-48h",
  "T-24h",
  "T-12h",
  "T-6h",
  "T-3h",
  "T-1h",
  "T-30m",
  "T-15m",
  "T-5m",
  "T-1m",
] as const;

export type Window038 = (typeof WINDOWS_038)[number];

export type TemporalClass038 =
  | "LEVEL_A_STRICT"
  | "LEVEL_B_STRICT"
  | "RESEARCH_TEMPORAL"
  | "DATE_ONLY"
  | "POSTMATCH"
  | "AMBIGUOUS"
  | "INVALID";

export type CollectionStatus038 =
  | "NOT_CONFIGURED"
  | "SOURCE_UNAVAILABLE"
  | "READY"
  | "COLLECTING"
  | "DEGRADED"
  | "ERROR";

export type LabVerdict038 =
  | "LIVE_NOT_CONFIGURED"
  | "LIVE_COLLECTION_ACTIVE"
  | "STRICT_PILOT_READY"
  | "STRICT_DATA_SUFFICIENT"
  | "MODEL_READY_NO_EDGE"
  | "EDGE_UNCONFIRMED"
  | "DEMONSTRATED_EDGE";

export type MatchGrade038 = "MATCH_EXACT" | "MATCH_PROBABLE" | "MATCH_AMBIGUOUS" | "MATCH_FAILED";

export type Partition038 = "RESEARCH_ONLY" | "CAPITAL_STRICT" | "QUARANTINE" | "REFERENCE";

export type Exp038Config = {
  experiment_id: string;
  dataset_version: string;
  model_version: string;
  baseline: string;
  baseline_devig: "proportional";
  pilot_target: number;
  t1h_coverage_min: number;
  t24_coverage_min: number;
  min_bookmakers_when_available: number;
  test_locked: true;
  holdout_locked: true;
  capital_gate: false;
  winner: null;
  auto_promotion: false;
  auto_promote: false;
  real_money: false;
  invent_timestamps: false;
  invent_timezone: false;
  invent_quotes: false;
  synthetic_data: false;
  client_retrieved_as_quote: false;
  date_only_promoted_to_strict: false;
  close_in_decision: false;
  modify_frozen_031: false;
  count_legacy_031_as_new_strict: false;
  historical_hunt: false;
  open_task_039: false;
  poll_interval_ms: number;
  clock_drift_max_ms: number;
  legacy_dataset_sha256: string;
};

export type SourceManifest038 = {
  sourceId: string;
  sourceCluster: string;
  repository: string | null;
  originalUrl: string | null;
  acquisitionDate: string;
  fileName: string | null;
  sha256: string | null;
  byteSize: number;
  rowCount: number | null;
  eventCount: number | null;
  competitionCount: number | null;
  marketCount: number;
  bookmakerCount: number;
  license: string;
  licenseEvidence: string;
  temporalBasis: string;
  timestampField: string | null;
  timestampTimezone: string | null;
  kickoffField: string | null;
  kickoffTimezone: string | null;
  resultFields: string[];
  provenance: string;
  redistributionAllowed: false | true;
  strictEligible: boolean;
  researchEligible: boolean;
  rejectionReason: string | null;
  parserStatus: string;
  matchability: MatchGrade038 | "NONE";
  temporalClass: TemporalClass038;
  partition: Partition038;
  commit: string | null;
};

export type QuoteObs038 = {
  eventId: string;
  source: string;
  bookmaker: string;
  market: string;
  selection: string;
  price: number;
  observedAt: string;
  kickoffAt: string;
  temporalBasis: "SOURCE_TIMESTAMP" | "COLLECTOR_TIMESTAMP";
  temporalClass: TemporalClass038;
  rawArtifactHash: string | null;
  matchStatus: MatchGrade038;
  collectorTimestampUtc: string;
  sourceTimestampUtc: string | null;
};

export type Coverage038 = Record<Window038, 0 | 1>;

export type Health038 = {
  configured: boolean;
  source: string;
  lastSuccessfulPoll: string | null;
  eventsDiscovered: number;
  quotesObserved: number;
  strictEligible: number;
  errors: string[];
  collectionStatus: CollectionStatus038;
  liveAdapter: "READY" | "NOT_READY";
  apiKey: "configured" | "missing";
};

export type Window036Alias = Window036;
