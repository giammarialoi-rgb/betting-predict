import type { TemporalPrecision } from "@/domain/odds/temporal";

export type FeatureTemporalClass =
  | "STRICT"
  | "RECONSTRUCTED_STRICT"
  | "DATASET_WINDOW"
  | "UNKNOWN"
  | "POST_EVENT"
  | "FORBIDDEN";

export type FeatureSourceRole =
  | "PRIMARY"
  | "SECONDARY"
  | "BENCHMARK"
  | "DERIVED";

export type FeatureStatus =
  | "READY"
  | "PARTIAL"
  | "BLOCKED"
  | "FORBIDDEN";

export type FeatureDefinition = {
  id: string;
  name: string;
  sport: string | "*";
  source: string;
  sourceRole: FeatureSourceRole;
  temporalClass: FeatureTemporalClass;
  description: string;
  requiredInputs: readonly string[];
  reconstructionMethod: string;
  leakageRisk: "none" | "low" | "medium" | "high" | "certain";
  status: FeatureStatus;
};

export type FeatureCellStatus =
  | "STRICT"
  | "RECONSTRUCTED_STRICT"
  | "DATASET_WINDOW"
  | "UNKNOWN"
  | "MISSING"
  | "BLOCKED"
  | "REJECTED_LEAKAGE";

/**
 * A single feature observation at a decision time.
 * Missing is explicit — never coerce to 0.
 */
export type FeatureCell<T = number | string | boolean | object | null> = {
  featureId: string;
  value: T | null;
  source: string;
  availableAt: Date | null;
  temporalPrecision: TemporalPrecision | "unknown";
  status: FeatureCellStatus;
  notes?: string;
};

export type HistoricalMatchResult = "H" | "D" | "A";

/** Completed match usable for lagged reconstruction. */
export type HistoricalMatch = {
  matchId: string;
  competitionId: string;
  seasonId?: string;
  kickoffAt: Date;
  /** When the final result became knowable. Must be <= asOf to use. */
  resultAvailableAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  ftHome: number;
  ftAway: number;
  ftResult: HistoricalMatchResult;
  homeShots?: number | null;
  awayShots?: number | null;
  homeTarget?: number | null;
  awayTarget?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeYellow?: number | null;
  awayYellow?: number | null;
  homeRed?: number | null;
  awayRed?: number | null;
};

export type EloSnapshot = {
  clubKey: string;
  elo: number;
  snapshotDate: Date;
  /** official ClubElo vs author provisional continuation */
  provenance: "official_clubelo" | "provisional_blocked" | "unknown";
  availableAt: Date;
};

export type FeatureEventContext = {
  eventId: string;
  sportId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledStartAt: Date;
};
