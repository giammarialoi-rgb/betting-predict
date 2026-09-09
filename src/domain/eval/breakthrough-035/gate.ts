import { hasUtcOffset, parseIsoMs } from "@/domain/eval/breakthrough-035/csv";
import type { MatchGrade035, NormalizedQuote035, TemporalClass035 } from "@/domain/eval/breakthrough-035/types";

export function classifyQuote035(q: NormalizedQuote035): TemporalClass035 {
  if (q.inplay_or_post) return "POSTMATCH";
  const quoteMs = parseIsoMs(q.quote_timestamp);
  const kickMs = parseIsoMs(q.kickoff_timestamp);
  if (!q.quote_timestamp && !q.kickoff_timestamp) {
    return q.temporal_basis === "DATE_ONLY" || q.temporal_basis === "CLOSING" || q.temporal_basis === "OPEN_CLOSE"
      ? "DATE_ONLY"
      : "UNKNOWN";
  }
  if (q.temporal_basis === "DATE_ONLY" || q.temporal_basis === "OPEN_CLOSE" || q.temporal_basis === "CLOSING") {
    return "DATE_ONLY";
  }
  if (quoteMs != null && kickMs != null && quoteMs >= kickMs) return "POSTMATCH";
  if (q.quote_timestamp && !q.quote_has_offset) return "AMBIGUOUS";
  if (q.kickoff_timestamp && !q.kickoff_has_offset) return "AMBIGUOUS";
  if (quoteMs == null || kickMs == null) return "RESEARCH_TEMPORAL";
  if (!q.quote_has_offset || !q.kickoff_has_offset) return "AMBIGUOUS";
  if (q.timezone !== "UTC" && q.timezone !== "Z") return "AMBIGUOUS";
  if (q.ft_home == null || q.ft_away == null) return "RESEARCH_TEMPORAL";
  if (q.temporal_basis === "EXCHANGE_PUBLISH") return "STRICT_A";
  if (q.temporal_basis === "BOOKMAKER_PUBLISH") return "STRICT_A";
  return "RESEARCH_TEMPORAL";
}

export function canEnterStrict035(input: {
  temporal_class: TemporalClass035;
  match_grade: MatchGrade035;
  quote: NormalizedQuote035;
}): boolean {
  if (input.match_grade !== "MATCH_EXACT") return false;
  if (input.temporal_class !== "STRICT_A" && input.temporal_class !== "STRICT_B") return false;
  const q = input.quote;
  if (!q.quote_timestamp || !q.kickoff_timestamp) return false;
  if (!hasUtcOffset(q.quote_timestamp) || !hasUtcOffset(q.kickoff_timestamp)) return false;
  const quoteMs = parseIsoMs(q.quote_timestamp);
  const kickMs = parseIsoMs(q.kickoff_timestamp);
  if (quoteMs == null || kickMs == null) return false;
  if (quoteMs >= kickMs) return false;
  if (q.inplay_or_post) return false;
  if (q.ft_home == null || q.ft_away == null) return false;
  return true;
}

export function legacyStrictBAllowed(source: string): boolean {
  return source === "TASK_031_BASE";
}
