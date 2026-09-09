/**
 * Pure forensic classifiers for Club Football Match Data.
 * No DB writes. No model training. Offline-safe after fixtures exist.
 */

export type FeatureClass =
  | "RAW"
  | "DERIVED_SAFE"
  | "DERIVED_REQUIRES_RECONSTRUCTION"
  | "LEAKAGE_RISK"
  | "POST_MATCH"
  | "UNKNOWN";

export type OddsTemporalClass =
  | "OPEN"
  | "CLOSE"
  | "IN_MATCH"
  | "POST_MATCH"
  | "UNKNOWN";

export type BookmakerColumnKind = "BOOKMAKER" | "AGGREGATE" | "DERIVED" | "NOT_ODDS";

export type TemporalPrecision =
  | "exact"
  | "dataset_window"
  | "date_only"
  | "unknown";

export type UsageMode = "STRICT_AS_OF" | "RESEARCH_DATASET" | "BENCHMARK_ONLY";

export type QualityLabel =
  | "verified"
  | "partially_verified"
  | "unknown"
  | "suspect";

/** Columns present in Matches.csv per upstream README + header verification. */
export const MATCHES_COLUMNS = [
  "Division",
  "MatchDate",
  "MatchTime",
  "HomeTeam",
  "AwayTeam",
  "HomeElo",
  "AwayElo",
  "Form3Home",
  "Form5Home",
  "Form3Away",
  "Form5Away",
  "FTHome",
  "FTAway",
  "FTResult",
  "HTHome",
  "HTAway",
  "HTResult",
  "HomeShots",
  "AwayShots",
  "HomeTarget",
  "AwayTarget",
  "HomeFouls",
  "AwayFouls",
  "HomeCorners",
  "AwayCorners",
  "HomeYellow",
  "AwayYellow",
  "HomeRed",
  "AwayRed",
  "OddHome",
  "OddDraw",
  "OddAway",
  "MaxHome",
  "MaxDraw",
  "MaxAway",
  "Over25",
  "Under25",
  "MaxOver25",
  "MaxUnder25",
  "HandiSize",
  "HandiHome",
  "HandiAway",
  "C_LTH",
  "C_LTA",
  "C_VHD",
  "C_VAD",
  "C_HTB",
  "C_PHB",
] as const;

export type MatchesColumn = (typeof MATCHES_COLUMNS)[number];

export const ELO_COLUMNS = ["date", "club", "country", "elo"] as const;

/** Aggregate market columns — never bookmakers. */
export const AGGREGATE_ODDS_COLUMNS = new Set([
  "MaxHome",
  "MaxDraw",
  "MaxAway",
  "MaxOver25",
  "MaxUnder25",
]);

/** Declared Bet365 columns in README (open/close not documented). */
export const BET365_ODDS_COLUMNS = new Set([
  "OddHome",
  "OddDraw",
  "OddAway",
  "Over25",
  "Under25",
  "HandiSize",
  "HandiHome",
  "HandiAway",
]);

export const POST_MATCH_STAT_COLUMNS = new Set([
  "FTHome",
  "FTAway",
  "FTResult",
  "HTHome",
  "HTAway",
  "HTResult",
  "HomeShots",
  "AwayShots",
  "HomeTarget",
  "AwayTarget",
  "HomeFouls",
  "AwayFouls",
  "HomeCorners",
  "AwayCorners",
  "HomeYellow",
  "AwayYellow",
  "HomeRed",
  "AwayRed",
]);

export const CLUSTER_COLUMNS = new Set([
  "C_LTH",
  "C_LTA",
  "C_VHD",
  "C_VAD",
  "C_HTB",
  "C_PHB",
]);

export const FORM_COLUMNS = new Set([
  "Form3Home",
  "Form5Home",
  "Form3Away",
  "Form5Away",
]);

export const ELO_MATCH_COLUMNS = new Set(["HomeElo", "AwayElo"]);

/** ClubElo official snapshots end; repo continues with provisional Elo after this. */
export const CLUBELO_OFFICIAL_CUTOFF = "2025-06-01";
export const PROVISIONAL_ELO_START = "2025-06-15";

export function classifyBookmakerColumn(column: string): BookmakerColumnKind {
  if (AGGREGATE_ODDS_COLUMNS.has(column)) return "AGGREGATE";
  if (BET365_ODDS_COLUMNS.has(column)) return "BOOKMAKER";
  if (
    column.startsWith("Odd") ||
    column.startsWith("Max") ||
    column.startsWith("Handi")
  ) {
    return "DERIVED";
  }
  return "NOT_ODDS";
}

export function classifyOddsTemporal(column: string): OddsTemporalClass {
  if (
    BET365_ODDS_COLUMNS.has(column) ||
    AGGREGATE_ODDS_COLUMNS.has(column)
  ) {
    // Upstream documents Bet365 / Max values but never open vs close timestamps.
    return "UNKNOWN";
  }
  return "UNKNOWN";
}

export function classifyFeature(column: string): FeatureClass {
  if (POST_MATCH_STAT_COLUMNS.has(column)) return "POST_MATCH";
  if (CLUSTER_COLUMNS.has(column)) return "LEAKAGE_RISK";
  if (FORM_COLUMNS.has(column)) return "DERIVED_REQUIRES_RECONSTRUCTION";
  if (ELO_MATCH_COLUMNS.has(column)) return "DERIVED_REQUIRES_RECONSTRUCTION";
  if (BET365_ODDS_COLUMNS.has(column) || AGGREGATE_ODDS_COLUMNS.has(column)) {
    return "LEAKAGE_RISK"; // unknown open/close → cannot prove prematch availability
  }
  if (
    column === "Division" ||
    column === "MatchDate" ||
    column === "MatchTime" ||
    column === "HomeTeam" ||
    column === "AwayTeam"
  ) {
    return "RAW";
  }
  return "UNKNOWN";
}

export function forbiddenPrematchFeatures(): Array<{
  field: string;
  reason: string;
  leakageMechanism: string;
  safeReconstructionMethod: string;
}> {
  const post = [...POST_MATCH_STAT_COLUMNS].map((field) => ({
    field,
    reason: "Full-time / half-time result or match statistic realized during/after the match",
    leakageMechanism: "Uses information unavailable at pre-match decision_time",
    safeReconstructionMethod:
      "Store only as post-match outcomes/stats with observed_at after final whistle; never feed STRICT_AS_OF prematch models",
  }));

  const clusters = [...CLUSTER_COLUMNS].map((field) => ({
    field,
    reason:
      "Cluster likelihoods derived from match-style features; blank on newest rows pending model review",
    leakageMechanism:
      "Likely fit using post-match shot/foul/corner patterns; formula and training window undocumented",
    safeReconstructionMethod:
      "Rebuild clusters only from lagged pre-match features with explicit as-of cutoff; otherwise BENCHMARK_ONLY",
  }));

  const odds = [...BET365_ODDS_COLUMNS, ...AGGREGATE_ODDS_COLUMNS].map((field) => ({
    field,
    reason: "Odds columns lack documented observation/availability timestamps (open vs close unknown)",
    leakageMechanism:
      "If values are closing (or post-kickoff), using them as prematch features leaks market information after decision_time",
    safeReconstructionMethod:
      "Re-ingest from football-data.co.uk with observation_kind dataset_open|dataset_close and temporal_precision=unknown; never invent clocks",
  }));

  return [...post, ...clusters, ...odds];
}

export function usageModeForColumn(column: string): UsageMode {
  const cls = classifyFeature(column);
  if (cls === "POST_MATCH" || cls === "LEAKAGE_RISK") return "BENCHMARK_ONLY";
  if (cls === "DERIVED_REQUIRES_RECONSTRUCTION") return "RESEARCH_DATASET";
  if (cls === "RAW") return "STRICT_AS_OF";
  return "RESEARCH_DATASET";
}

export function parseMatchDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseMatchTime(value: string): { hh: number; mm: number; ss: number } | null {
  if (!value || !value.trim()) return null;
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { hh: Number(m[1]), mm: Number(m[2]), ss: Number(m[3]) };
}

/**
 * MatchDate/MatchTime describe scheduled event timing claims only.
 * They are NOT availability timestamps for odds, Elo, or stats.
 */
export function temporalMatrixRow(field: string): {
  field: string;
  eventTime: string;
  observationTime: string;
  availabilityTime: string;
  precision: TemporalPrecision;
} {
  if (field === "MatchDate" || field === "MatchTime") {
    return {
      field,
      eventTime: "claimed scheduled kickoff components (timezone claim: CET-1 — unverified)",
      observationTime: "unknown",
      availabilityTime: "unknown — must not treat as quote/feature availability",
      precision: field === "MatchDate" ? "date_only" : "unknown",
    };
  }
  if (POST_MATCH_STAT_COLUMNS.has(field)) {
    return {
      field,
      eventTime: "match window / final whistle",
      observationTime: "unknown (post-match publication time not in dataset)",
      availabilityTime: "unknown; semantically after kickoff",
      precision: "unknown",
    };
  }
  if (FORM_COLUMNS.has(field)) {
    return {
      field,
      eventTime: "prior matches' results",
      observationTime: "unknown (formula claimed pre-match; not independently verified)",
      availabilityTime: "unknown until reconstructed with shift",
      precision: "unknown",
    };
  }
  if (ELO_MATCH_COLUMNS.has(field)) {
    return {
      field,
      eventTime: "n/a (rating state)",
      observationTime:
        "claimed 'most recent Elo'; ClubElo bi-monthly snapshots + provisional continuation after 2025-06-01",
      availabilityTime: "unknown exact; at best snapshot date ≤ match date if join is correct",
      precision: "dataset_window",
    };
  }
  if (BET365_ODDS_COLUMNS.has(field) || AGGREGATE_ODDS_COLUMNS.has(field)) {
    return {
      field,
      eventTime: "match scheduled start (not quote time)",
      observationTime: "unknown (open/close not labeled)",
      availabilityTime: "unknown",
      precision: "unknown",
    };
  }
  if (CLUSTER_COLUMNS.has(field)) {
    return {
      field,
      eventTime: "match",
      observationTime: "model-derived; timing unknown",
      availabilityTime: "not demonstrably pre-match",
      precision: "unknown",
    };
  }
  return {
    field,
    eventTime: "match identity fields",
    observationTime: "unknown",
    availabilityTime: "unknown",
    precision: "unknown",
  };
}

export function isProvisionalEloDate(isoDate: string): boolean {
  return isoDate >= PROVISIONAL_ELO_START;
}

export function pointsFromFtResult(
  side: "home" | "away",
  ftResult: string,
): number | null {
  if (ftResult === "H") return side === "home" ? 3 : 0;
  if (ftResult === "A") return side === "away" ? 3 : 0;
  if (ftResult === "D") return 1;
  return null;
}

/**
 * Reconstruct FormN as points from the previous N completed matches
 * for the same team (home or away), excluding the current row.
 */
export function reconstructFormPoints(
  priorResults: string[],
  side: "home" | "away",
  window: number,
): number {
  const slice = priorResults.slice(-window);
  let points = 0;
  for (const r of slice) {
    const p = pointsFromFtResult(side, r);
    if (p === null) continue;
    // priorResults must already be from that team's perspective as H/A/D relative to them
    points += p;
  }
  return points;
}

/**
 * Convert a team's FTResult from match perspective to team perspective.
 */
export function teamPerspectiveResult(
  playedHome: boolean,
  ftResult: string,
): string | null {
  if (ftResult === "D") return "D";
  if (ftResult === "H") return playedHome ? "H" : "A";
  if (ftResult === "A") return playedHome ? "A" : "H";
  return null;
}

export function eventIdentityKey(parts: {
  division: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
}): string {
  return [
    parts.division.trim().toLowerCase(),
    parts.matchDate.trim(),
    parts.homeTeam.trim().toLowerCase(),
    parts.awayTeam.trim().toLowerCase(),
  ].join("|");
}

export function validateDecimalOdds(value: number): boolean {
  return Number.isFinite(value) && value > 1;
}

export function provenanceForColumn(column: string): {
  repositoryField: string;
  originalSource: string;
  sourceType: "aggregator" | "bookmaker_feed" | "rating_provider" | "derived" | "unknown";
  licenseStatus: string;
  confidence: QualityLabel;
  notes: string;
} {
  if (
    column === "Division" ||
    column === "MatchDate" ||
    column === "MatchTime" ||
    column === "HomeTeam" ||
    column === "AwayTeam" ||
    POST_MATCH_STAT_COLUMNS.has(column)
  ) {
    return {
      repositoryField: column,
      originalSource: "football-data.co.uk (declared)",
      sourceType: "aggregator",
      licenseStatus: "upstream football-data.co.uk terms + repo MIT on packaging; redistribution caution",
      confidence: "partially_verified",
      notes: "README attribution; sample cross-check required against CSV columns",
    };
  }
  if (ELO_MATCH_COLUMNS.has(column) || column === "elo") {
    return {
      repositoryField: column,
      originalSource: "clubelo.com through 2025-06-01; provisional repo continuation thereafter",
      sourceType: "rating_provider",
      licenseStatus: "ClubElo terms unknown in this audit; provisional Elo is author-generated",
      confidence: column === "elo" ? "partially_verified" : "suspect",
      notes:
        "HomeElo/AwayElo join method undocumented; post-2025-06-01 values are not ClubElo primary",
    };
  }
  if (FORM_COLUMNS.has(column)) {
    return {
      repositoryField: column,
      originalSource: "derived in repository from match results",
      sourceType: "derived",
      licenseStatus: "derived from football-data.co.uk results",
      confidence: "unknown",
      notes: "Must reconstruct with explicit lag before APPROVED prematch use",
    };
  }
  if (BET365_ODDS_COLUMNS.has(column)) {
    return {
      repositoryField: column,
      originalSource: "Bet365 via football-data.co.uk (declared)",
      sourceType: "bookmaker_feed",
      licenseStatus: "via football-data.co.uk packaging",
      confidence: "partially_verified",
      notes: "Open vs close not labeled in this repository",
    };
  }
  if (AGGREGATE_ODDS_COLUMNS.has(column)) {
    return {
      repositoryField: column,
      originalSource: "Max across ~17 European bookmakers via football-data.co.uk (declared)",
      sourceType: "aggregator",
      licenseStatus: "via football-data.co.uk packaging",
      confidence: "partially_verified",
      notes: "NOT a bookmaker; Max ≠ Pinnacle/WH/etc.",
    };
  }
  if (CLUSTER_COLUMNS.has(column)) {
    return {
      repositoryField: column,
      originalSource: "repository clustering model (author-derived)",
      sourceType: "derived",
      licenseStatus: "repo MIT on derived artifact",
      confidence: "suspect",
      notes: "Undocumented training features; blank on newest ~8301 rows per README",
    };
  }
  return {
    repositoryField: column,
    originalSource: "unknown",
    sourceType: "unknown",
    licenseStatus: "unknown",
    confidence: "unknown",
    notes: "",
  };
}
