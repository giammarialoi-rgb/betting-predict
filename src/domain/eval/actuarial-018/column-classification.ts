/**
 * TASK 018 column classification — maps forensic classifiers to usability tiers.
 */

import {
  MATCHES_COLUMNS,
  classifyFeature,
  classifyBookmakerColumn,
  classifyOddsTemporal,
  usageModeForColumn,
  type MatchesColumn,
} from "@/audit/club-football-match-data/classifiers";

export type Task018ColumnUsability =
  | "SAFE_PREMATCH"
  | "SAFE_AFTER_RECONSTRUCTION"
  | "RESEARCH_ONLY"
  | "POST_MATCH"
  | "TEMPORALLY_UNKNOWN"
  | "FORBIDDEN";

export type ColumnClassificationRow = {
  column: string;
  source: "Matches.csv";
  semantics: string;
  temporality: string;
  usability: Task018ColumnUsability;
  usable_strict: boolean;
  reason: string;
  bookmaker_kind: string;
  odds_temporal: string;
  legacy_feature_class: string;
  usage_mode: string;
};

function semanticsFor(col: string): string {
  if (col === "HomeTeam" || col === "AwayTeam") return "event_identity";
  if (col === "Division" || col === "MatchDate" || col === "MatchTime")
    return "event_schedule";
  if (col.startsWith("FT") || col.startsWith("HT")) return "result_outcome";
  if (
    col.includes("Shots") ||
    col.includes("Fouls") ||
    col.includes("Corners") ||
    col.includes("Yellow") ||
    col.includes("Red") ||
    col.includes("Target")
  )
    return "post_match_stats";
  if (col.startsWith("Form")) return "derived_form";
  if (col.includes("Elo")) return "rating_snapshot";
  if (col.startsWith("C_")) return "cluster_derived";
  if (col.startsWith("Max") || col.startsWith("Avg")) return "aggregate_odds";
  if (
    col.startsWith("Odd") ||
    col.startsWith("Over") ||
    col.startsWith("Under") ||
    col.startsWith("Handi")
  )
    return "odds";
  return "other";
}

export function classifyTask018Column(column: string): ColumnClassificationRow {
  const feat = classifyFeature(column);
  const book = classifyBookmakerColumn(column);
  const oddsT = classifyOddsTemporal(column);
  const mode = usageModeForColumn(column);

  let usability: Task018ColumnUsability;
  let reason: string;

  if (feat === "POST_MATCH") {
    usability = "POST_MATCH";
    reason = "Outcome/stat realized during or after the match — leakage if used prematch";
  } else if (column.startsWith("C_") || feat === "LEAKAGE_RISK") {
    if (book === "AGGREGATE") {
      usability = "FORBIDDEN";
      reason = "Aggregate Max/Avg is not a bookmaker; odds clocks undocumented";
    } else if (book === "BOOKMAKER" || column.startsWith("Odd") || column.startsWith("Over") || column.startsWith("Under") || column.startsWith("Handi")) {
      usability = "TEMPORALLY_UNKNOWN";
      reason = "Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF";
    } else {
      usability = "FORBIDDEN";
      reason = "Cluster/derived field with undocumented formula — leakage risk";
    }
  } else if (feat === "DERIVED_REQUIRES_RECONSTRUCTION") {
    if (column.startsWith("Form")) {
      usability = "SAFE_AFTER_RECONSTRUCTION";
      reason = "Do not use repo Form*; reconstruct from lagged FT results only";
    } else if (column.includes("Elo")) {
      usability = "RESEARCH_ONLY";
      reason = "Match-row Elo conditional; STRICT prefers official ClubElo with rating_date < kickoff";
    } else {
      usability = "SAFE_AFTER_RECONSTRUCTION";
      reason = "Requires lagged reconstruction before STRICT use";
    }
  } else if (feat === "RAW") {
    usability = "SAFE_PREMATCH";
    reason = "Identity/schedule fields — not availability timestamps for odds";
  } else {
    usability = "RESEARCH_ONLY";
    reason = "Unclassified — do not invent safety";
  }

  const usable_strict =
    usability === "SAFE_PREMATCH" ||
    (usability === "SAFE_AFTER_RECONSTRUCTION" && column.startsWith("Form"));

  return {
    column,
    source: "Matches.csv",
    semantics: semanticsFor(column),
    temporality:
      usability === "POST_MATCH"
        ? "post"
        : usability === "TEMPORALLY_UNKNOWN"
          ? "unknown"
          : usability === "SAFE_PREMATCH"
            ? "event_identity_or_schedule"
            : "conditional",
    usability,
    usable_strict: usable_strict && !column.startsWith("Form"), // Form column itself not usable; reconstruction is
    reason,
    bookmaker_kind: book,
    odds_temporal: oddsT,
    legacy_feature_class: feat,
    usage_mode: mode,
  };
}

export function classifyAllMatchesColumns(): ColumnClassificationRow[] {
  return (MATCHES_COLUMNS as readonly MatchesColumn[]).map((c) =>
    classifyTask018Column(c),
  );
}
