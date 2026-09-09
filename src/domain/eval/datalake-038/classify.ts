import { hasUtcOffset, isDateOnly, isNaiveDateTime, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { MatchGrade038, TemporalClass038 } from "@/domain/eval/datalake-038/types";

export function classifyTemporal038(input: {
  quoteTimestampUtc: string | null;
  kickoffUtc: string | null;
  temporalBasis: string;
  clientRetrievedAt: string | null;
  match: MatchGrade038;
  market: string | null;
  provenance: string | null;
}): TemporalClass038 {
  if (input.temporalBasis === "DATE_ONLY" || input.temporalBasis === "OPEN_CLOSE" || input.temporalBasis === "CLOSING") {
    return "DATE_ONLY";
  }
  if (input.temporalBasis === "CLIENT_RETRIEVED" || (input.clientRetrievedAt && input.quoteTimestampUtc === input.clientRetrievedAt)) {
    return "AMBIGUOUS";
  }
  if (!input.kickoffUtc) return "INVALID";
  if (isDateOnly(input.kickoffUtc) && !hasUtcOffset(input.kickoffUtc)) return "DATE_ONLY";
  if (isNaiveDateTime(input.kickoffUtc) || !hasUtcOffset(input.kickoffUtc)) return "AMBIGUOUS";
  if (!input.quoteTimestampUtc) return "INVALID";
  if (isDateOnly(input.quoteTimestampUtc)) return "DATE_ONLY";
  if (isNaiveDateTime(input.quoteTimestampUtc) || !hasUtcOffset(input.quoteTimestampUtc)) return "AMBIGUOUS";
  const qMs = parseExactUtcMs(input.quoteTimestampUtc);
  const kMs = parseExactUtcMs(input.kickoffUtc);
  if (qMs == null || kMs == null) return "AMBIGUOUS";
  if (qMs >= kMs) return "POSTMATCH";
  if (input.temporalBasis === "COLLECTOR_TIMESTAMP") return "AMBIGUOUS";
  if (!input.market || !input.provenance) return "INVALID";
  if (input.match !== "MATCH_EXACT") return "RESEARCH_TEMPORAL";
  if (input.temporalBasis === "SOURCE_TIMESTAMP" || input.temporalBasis === "BOOKMAKER_PUBLISH" || input.temporalBasis === "EXCHANGE_PUBLISH") {
    return "LEVEL_A_STRICT";
  }
  return "LEVEL_B_STRICT";
}

export function isCapitalClass038(cls: TemporalClass038): boolean {
  return cls === "LEVEL_A_STRICT" || cls === "LEVEL_B_STRICT";
}

export function canEnterStrict038(input: {
  quoteTimestampUtc: string | null;
  kickoffUtc: string | null;
  temporalBasis: string;
  clientRetrievedAt: string | null;
  match: MatchGrade038;
  market: string | null;
  provenance: string | null;
}): boolean {
  const cls = classifyTemporal038(input);
  if (!isCapitalClass038(cls)) return false;
  if (input.match !== "MATCH_EXACT") return false;
  if (!input.quoteTimestampUtc || !input.kickoffUtc) return false;
  if (!hasUtcOffset(input.quoteTimestampUtc) || !hasUtcOffset(input.kickoffUtc)) return false;
  const qMs = parseExactUtcMs(input.quoteTimestampUtc);
  const kMs = parseExactUtcMs(input.kickoffUtc);
  if (qMs == null || kMs == null) return false;
  if (qMs >= kMs) return false;
  return true;
}

export function quoteBeforeKickoff038(quoteUtc: string, kickoffUtc: string): boolean {
  const q = parseExactUtcMs(quoteUtc);
  const k = parseExactUtcMs(kickoffUtc);
  if (q == null || k == null) return false;
  return q < k;
}
