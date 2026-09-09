import { hasUtcOffset, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { LakeClass037, Level037, MatchGrade037, Quote037 } from "@/domain/eval/harvest-037/types";

export function canonicalEventKey037(input: {
  competition: string | null;
  season: string | null;
  kickoff_utc: string | null;
  home: string;
  away: string;
}): string {
  return [
    (input.competition ?? "").trim().toLowerCase(),
    (input.season ?? "").trim().toLowerCase(),
    input.kickoff_utc ?? "",
    input.home.trim().toLowerCase(),
    input.away.trim().toLowerCase(),
  ].join("|");
}

export function matchGrade037(q: Quote037): MatchGrade037 {
  if (q.home && q.away && q.kickoff_utc && q.kickoff_has_offset && q.ft_home != null && q.ft_away != null) {
    return "MATCH_EXACT";
  }
  if (q.home && q.away && q.ft_home != null && q.ft_away != null) return "MATCH_PROBABLE";
  if (q.home && q.away && q.kickoff_utc) return "MATCH_AMBIGUOUS";
  return "MATCH_FAILED";
}

export function classifyQuote037(q: Quote037): { lake: LakeClass037; level: Level037 } {
  if (q.temporal_basis === "CLIENT_RETRIEVED" || q.client_retrieved_at) {
    if (!q.quote_timestamp_utc || q.quote_timestamp_utc === q.client_retrieved_at) {
      return { lake: "RESEARCH_TEMPORAL", level: "NONE" };
    }
  }
  if (q.temporal_basis === "DATE_ONLY" || q.temporal_basis === "OPEN_CLOSE" || q.temporal_basis === "CLOSING") {
    return { lake: "DATE_ONLY", level: "NONE" };
  }
  if (q.temporal_basis === "NAIVE_DATETIME" || (q.quote_timestamp_utc && !q.quote_has_offset)) {
    return { lake: "NAIVE_DATETIME", level: "NONE" };
  }
  const qMs = parseExactUtcMs(q.quote_timestamp_utc);
  const kMs = parseExactUtcMs(q.kickoff_utc);
  if (qMs != null && kMs != null && qMs >= kMs) return { lake: "POSTMATCH", level: "NONE" };
  if (q.temporal_basis === "EXCHANGE_PUBLISH" && q.quote_has_offset && q.kickoff_has_offset) {
    return { lake: "RESEARCH_TEMPORAL", level: "LEVEL_A" };
  }
  if (q.temporal_basis === "BOOKMAKER_PUBLISH" && q.quote_has_offset && q.kickoff_has_offset) {
    return { lake: "RESEARCH_TEMPORAL", level: "LEVEL_A" };
  }
  if (qMs != null && kMs != null) return { lake: "RESEARCH_TEMPORAL", level: "LEVEL_B" };
  return { lake: "UNKNOWN", level: "NONE" };
}

export function canEnterStrict037(q: Quote037, match: MatchGrade037): boolean {
  if (match !== "MATCH_EXACT") return false;
  const { lake, level } = classifyQuote037(q);
  if (lake === "DATE_ONLY" || lake === "NAIVE_DATETIME" || lake === "POSTMATCH" || lake === "UNKNOWN") return false;
  if (level !== "LEVEL_A" && level !== "LEVEL_B") return false;
  if (!q.quote_timestamp_utc || !q.kickoff_utc) return false;
  if (!hasUtcOffset(q.quote_timestamp_utc) || !hasUtcOffset(q.kickoff_utc)) return false;
  if (q.client_retrieved_at && q.quote_timestamp_utc === q.client_retrieved_at) return false;
  const qMs = parseExactUtcMs(q.quote_timestamp_utc);
  const kMs = parseExactUtcMs(q.kickoff_utc);
  if (qMs == null || kMs == null) return false;
  if (qMs >= kMs) return false;
  if (qMs > kMs - 3600_000) return false;
  if (q.ft_home == null || q.ft_away == null) return false;
  return true;
}

export function lastObservationAtOrBeforeT1h(
  quotes: readonly { quoteMs: number; kickMs: number }[],
): { quoteMs: number; kickMs: number } | null {
  const eligible = quotes.filter((q) => q.quoteMs <= q.kickMs - 3600_000 && q.quoteMs < q.kickMs);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (a.quoteMs >= b.quoteMs ? a : b));
}
