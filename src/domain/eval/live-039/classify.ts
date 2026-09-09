import { hasUtcOffset, isDateOnly, isNaiveDateTime, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { MatchGrade039, TemporalClass039 } from "@/domain/eval/live-039/types";

export function matchGrade039(input: {
  home: string;
  away: string;
  commenceTime: string | null;
  sourceEventId?: string | null;
  sportKey?: string | null;
}): MatchGrade039 {
  if (!input.home || !input.away) return "MATCH_FAILED";
  if (!input.commenceTime || !hasUtcOffset(input.commenceTime) || parseExactUtcMs(input.commenceTime) == null) {
    return input.commenceTime ? "MATCH_AMBIGUOUS" : "MATCH_FAILED";
  }
  if (input.sourceEventId) return "MATCH_EXACT";
  if (input.sportKey) return "MATCH_EXACT";
  return "MATCH_PROBABLE";
}

export function classifyQuote039(input: {
  sourceQuoteTimestamp: string | null;
  commenceTime: string | null;
  collectedAt: string;
  market: string | null;
  match: MatchGrade039;
}): TemporalClass039 {
  if (!input.commenceTime) return "INVALID";
  if (isDateOnly(input.commenceTime) && !hasUtcOffset(input.commenceTime)) return "DATE_ONLY";
  if (isNaiveDateTime(input.commenceTime) || !hasUtcOffset(input.commenceTime)) return "AMBIGUOUS";
  if (!input.sourceQuoteTimestamp) return "INVALID";
  if (isDateOnly(input.sourceQuoteTimestamp)) return "DATE_ONLY";
  if (isNaiveDateTime(input.sourceQuoteTimestamp) || !hasUtcOffset(input.sourceQuoteTimestamp)) return "AMBIGUOUS";
  if (input.sourceQuoteTimestamp === input.collectedAt) return "AMBIGUOUS";
  const q = parseExactUtcMs(input.sourceQuoteTimestamp);
  const k = parseExactUtcMs(input.commenceTime);
  if (q == null || k == null) return "AMBIGUOUS";
  if (q >= k) return "POSTMATCH";
  if (!input.market) return "INVALID";
  if (input.match !== "MATCH_EXACT") return "RESEARCH_TEMPORAL";
  return "STRICT";
}

export function availableAt039(sourceQuoteTimestamp: string | null): string | null {
  if (!sourceQuoteTimestamp || !hasUtcOffset(sourceQuoteTimestamp)) return null;
  if (parseExactUtcMs(sourceQuoteTimestamp) == null) return null;
  return sourceQuoteTimestamp;
}

export function isStrict039(cls: TemporalClass039, match: MatchGrade039): boolean {
  return cls === "STRICT" && match === "MATCH_EXACT";
}
