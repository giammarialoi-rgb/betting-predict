/**
 * LEVEL B overlay: soccer-dataset UTC kickoff (SOURCE) + PHP hours-before bin (DERIVED).
 * Never treat BeatTheBookie naive match_datetime as UTC.
 * Never invent Europe/Rome or Europe/London.
 */

import { classifyClock } from "@/domain/eval/bottleneck-026/classify";
import type { CapitalLevel027, CorpusClass027, MatchGrade027 } from "@/domain/eval/breakthrough-027/types";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";

export function parseSoccerKickoffUtc(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const iso = t.includes("T") ? t : t.replace(" ", "T");
  if (!/T\d{2}:\d{2}/.test(iso)) return null;
  const withZ = /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withZ);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return null;
  }
  return d.toISOString();
}

export function derivedQuoteFromKickoff(kickoffIso: string, hoursBefore: number): string | null {
  if (!Number.isInteger(hoursBefore) || hoursBefore < 1) return null;
  const ms = Date.parse(kickoffIso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms - hoursBefore * 3_600_000).toISOString();
}

export function refuseBtbDatetimeAsUtc(btbDatetime: string): CorpusClass027 {
  void btbDatetime;
  return "TEMPORALLY_UNKNOWN";
}

export function classifyLevelB(input: {
  soccerKickoffRaw: string;
  hoursBefore: number;
  matchGrade: MatchGrade027;
  licenseCapitalOk: boolean;
}): {
  level: CapitalLevel027 | null;
  class: CorpusClass027;
  kickoff: string | null;
  quote: string | null;
  capitalEligible: boolean;
  reason: string;
} {
  if (input.matchGrade === "MATCH_AMBIGUOUS") {
    return {
      level: null,
      class: "MATCH_AMBIGUOUS",
      kickoff: null,
      quote: null,
      capitalEligible: false,
      reason: "ambiguous identity",
    };
  }
  if (input.matchGrade !== "MATCH_EXACT") {
    return {
      level: null,
      class: "RESEARCH_ONLY",
      kickoff: null,
      quote: null,
      capitalEligible: false,
      reason: "MATCH_EXACT required for LEVEL B",
    };
  }
  if (input.hoursBefore < 1) {
    return {
      level: null,
      class: "POST_MATCH",
      kickoff: parseSoccerKickoffUtc(input.soccerKickoffRaw),
      quote: null,
      capitalEligible: false,
      reason: "hours_before < 1 is kickoff/post-match bin",
    };
  }
  const kickoff = parseSoccerKickoffUtc(input.soccerKickoffRaw);
  if (!kickoff) {
    return {
      level: "LEVEL_C",
      class: "TEMPORALLY_UNKNOWN",
      kickoff: null,
      quote: null,
      capitalEligible: false,
      reason: "soccer kickoff missing, midnight placeholder, or not a clock",
    };
  }
  const quote = derivedQuoteFromKickoff(kickoff, input.hoursBefore);
  if (!quote) {
    return {
      level: null,
      class: "TEMPORALLY_UNKNOWN",
      kickoff,
      quote: null,
      capitalEligible: false,
      reason: "cannot derive quote from PHP hours-before",
    };
  }
  const clock = classifyClock({
    raw: quote,
    origin: "DERIVED_TIMESTAMP",
    derivedProof: true,
    kickoffIso: kickoff,
    licenseCapitalOk: input.licenseCapitalOk,
  });
  if (!clock.capitalEligible) {
    return {
      level: "LEVEL_B",
      class: "RESEARCH_ONLY",
      kickoff,
      quote: clock.iso,
      capitalEligible: false,
      reason: clock.reason,
    };
  }
  return {
    level: "LEVEL_B",
    class: "VALID",
    kickoff,
    quote: clock.iso,
    capitalEligible: true,
    reason: "LEVEL_B: soccer UTC kickoff SOURCE + PHP hourly bin DERIVED; quote < kickoff",
  };
}

export function assertNotAssumedTimezone(tz: string | null): void {
  if (tz && /europe\/(rome|london)|invented/i.test(tz)) {
    throw new ExperimentIntegrityError("invented timezone");
  }
}
