/**
 * TASK 024 temporal classifier.
 * STRICT needs quote_timestamp < kickoff_timestamp with verifiable clocks.
 * known_at = kickoff is CLOSING, not STRICT prematch.
 * Never invent timezone or a 1h offset the dataset did not prove.
 */

import type {
  KickoffPrecision024,
  TemporalClass024,
  TemporalRelation024,
  TimestampPrecision024,
} from "@/domain/eval/attack-024/types";

export function parseClockMs(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const ms = Date.parse(t.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(t) ? t : `${t}Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function isMidnightUtcNaive(raw: string): boolean {
  return /T00:00:00(\.0+)?(Z)?$/.test(raw.trim()) || / 00:00:00(\.0+)?$/.test(raw.trim());
}

export function classifyKickoffPrecision(input: {
  kickoffRaw: string | null;
  timezoneProven: boolean;
}): KickoffPrecision024 {
  if (input.kickoffRaw == null || input.kickoffRaw.trim() === "") return "UNKNOWN";
  const t = input.kickoffRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return "DATE_ONLY";
  if (!input.timezoneProven) return "UNKNOWN";
  if (isMidnightUtcNaive(t)) return "MIDNIGHT_PLACEHOLDER";
  if (parseClockMs(t) == null) return "UNKNOWN";
  return "EXACT";
}

export function classifyQuotePrecision(input: {
  quoteRaw: string | null;
  timezoneProven: boolean;
  isRelativeBin: boolean;
}): TimestampPrecision024 {
  if (input.isRelativeBin) return "RELATIVE";
  if (input.quoteRaw == null || input.quoteRaw.trim() === "") return "UNKNOWN";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.quoteRaw.trim())) return "DATE_ONLY";
  if (!input.timezoneProven) return "UNKNOWN";
  if (parseClockMs(input.quoteRaw) == null) return "UNKNOWN";
  return "EXACT";
}

export function classifyTemporalRelation(input: {
  quoteMs: number | null;
  kickoffMs: number | null;
}): TemporalRelation024 {
  if (input.quoteMs == null || input.kickoffMs == null) return "UNKNOWN";
  if (input.quoteMs < input.kickoffMs) return "QUOTE_BEFORE_KICKOFF";
  if (input.quoteMs === input.kickoffMs) return "QUOTE_EQUALS_KICKOFF";
  return "QUOTE_AFTER_KICKOFF";
}

export function temporalClassFromRelation(input: {
  relation: TemporalRelation024;
  kickoff: KickoffPrecision024;
  quote: TimestampPrecision024;
  dictionaryClosing?: boolean;
  postMatchOffsetSec?: number | null;
}): TemporalClass024 {
  if (input.postMatchOffsetSec != null && input.postMatchOffsetSec > 0) return "POST_MATCH";
  if (input.quote === "RELATIVE") return "RELATIVE_UNVERIFIED_TZ";
  if (input.kickoff === "DATE_ONLY" || input.quote === "DATE_ONLY") return "DATE_ONLY";
  if (input.kickoff === "UNKNOWN" || input.quote === "UNKNOWN") return "TEMPORALLY_UNKNOWN";
  if (input.kickoff === "MIDNIGHT_PLACEHOLDER") return "MIDNIGHT_PLACEHOLDER";
  if (input.relation === "QUOTE_EQUALS_KICKOFF" || input.dictionaryClosing) {
    return "CLOSING_AT_KICKOFF";
  }
  if (input.relation === "QUOTE_AFTER_KICKOFF") return "POST_KICKOFF";
  if (
    input.relation === "QUOTE_BEFORE_KICKOFF" &&
    input.kickoff === "EXACT" &&
    input.quote === "EXACT"
  ) {
    return "STRICT_PREMATCH";
  }
  return "TEMPORALLY_UNKNOWN";
}

export function strictUsable(input: {
  acquired: boolean;
  parsed: boolean;
  kickoff: KickoffPrecision024;
  quote: TimestampPrecision024;
  relation: TemporalRelation024;
}): boolean {
  return (
    input.acquired &&
    input.parsed &&
    input.kickoff === "EXACT" &&
    input.quote === "EXACT" &&
    input.relation === "QUOTE_BEFORE_KICKOFF"
  );
}

export function deltaSeconds(quoteMs: number | null, kickoffMs: number | null): number | null {
  if (quoteMs == null || kickoffMs == null) return null;
  return Math.round((quoteMs - kickoffMs) / 1000);
}
