/**
 * Temporal precision + origin. Never promote DATE_ONLY / assumed / file mtime to STRICT.
 */

import type { ClassifiedClock026, TimestampOrigin026 } from "@/domain/eval/bottleneck-026/types";

const COMPACT_UTC = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

export function parseCompactUtcTimestamp(raw: string): string | null {
  const m = raw.trim().match(COMPACT_UTC);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const iso = new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  return iso;
}

export function classifyClock(input: {
  raw: string | null | undefined;
  origin: TimestampOrigin026;
  derivedProof?: boolean;
  kickoffIso?: string | null;
  licenseCapitalOk?: boolean;
}): ClassifiedClock026 {
  const raw = input.raw?.trim() ?? "";
  if (input.origin === "ASSUMED_TIMESTAMP") {
    return {
      precision: raw ? "UNKNOWN" : "UNKNOWN",
      origin: "ASSUMED_TIMESTAMP",
      iso: null,
      capitalEligible: false,
      reason: "ASSUMED_TIMESTAMP is never STRICT",
    };
  }
  if (!raw) {
    return {
      precision: "UNKNOWN",
      origin: input.origin,
      iso: null,
      capitalEligible: false,
      reason: "empty timestamp",
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{2}\/\d{2}\/\d{2,4}$/.test(raw)) {
    return {
      precision: "DATE_ONLY",
      origin: input.origin,
      iso: null,
      capitalEligible: false,
      reason: "DATE_ONLY cannot become EXACT_TIMESTAMP",
    };
  }
  if (/^OPEN(?:ING)?$|^CLOSE(?:ING)?$/i.test(raw)) {
    return {
      precision: "DATE_ONLY",
      origin: input.origin,
      iso: null,
      capitalEligible: false,
      reason: "OPEN/CLOSE label without a clock is not a timestamp",
    };
  }
  const compact = parseCompactUtcTimestamp(raw);
  const isoCandidate = compact ?? parseIsoClock(raw);
  if (isoCandidate == null) {
    return {
      precision: "UNKNOWN",
      origin: input.origin,
      iso: null,
      capitalEligible: false,
      reason: "unparseable clock",
    };
  }
  if (input.origin === "DERIVED_TIMESTAMP" && input.derivedProof !== true) {
    return {
      precision: "EXACT_TIMESTAMP",
      origin: "DERIVED_TIMESTAMP",
      iso: isoCandidate,
      capitalEligible: false,
      reason: "DERIVED_TIMESTAMP without mathematical proof — not STRICT",
    };
  }
  const kickoff = input.kickoffIso ? Date.parse(input.kickoffIso) : NaN;
  const quote = Date.parse(isoCandidate);
  if (Number.isFinite(kickoff) && quote >= kickoff) {
    return {
      precision: "EXACT_TIMESTAMP",
      origin: input.origin,
      iso: isoCandidate,
      capitalEligible: false,
      reason: "quote clock not < kickoff",
    };
  }
  const temporallyVerified = Number.isFinite(kickoff) && quote < kickoff;
  const capital =
    temporallyVerified &&
    input.licenseCapitalOk === true &&
    (input.origin === "SOURCE_TIMESTAMP" || input.derivedProof === true);
  return {
    precision: "EXACT_TIMESTAMP",
    origin: input.origin,
    iso: isoCandidate,
    capitalEligible: capital,
    reason: capital
      ? "SOURCE/proven DERIVED clock and quote < kickoff"
      : temporallyVerified
        ? "temporally verified but not licensed for capital"
        : "EXACT quote clock; kickoff missing or not proven — not CAPITAL_STRICT",
  };
}

function parseIsoClock(raw: string): string | null {
  if (!/[T ]\d{2}:\d{2}/.test(raw) && !/Z$|[+-]\d{2}:\d{2}$/.test(raw)) return null;
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withZ = /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withZ);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function successBand(exactTimestampEvents: number): "SUCCESS_A" | "SUCCESS_B" | "SUCCESS_C" | "FAILURE" {
  if (exactTimestampEvents >= 100) return "SUCCESS_A";
  if (exactTimestampEvents >= 50) return "SUCCESS_B";
  if (exactTimestampEvents >= 10) return "SUCCESS_C";
  return "FAILURE";
}

export function isQualified(input: {
  temporal_exact: boolean;
  fixture_exact: boolean;
  market_valid: boolean;
  model_calibrated: boolean;
  sample_sufficient: boolean;
  walk_forward_pass: boolean;
  holdout_pass: boolean;
  statistical_gate_pass: boolean;
  evidence_available: boolean;
}): boolean {
  return (
    input.temporal_exact &&
    input.fixture_exact &&
    input.market_valid &&
    input.model_calibrated &&
    input.sample_sufficient &&
    input.walk_forward_pass &&
    input.holdout_pass &&
    input.statistical_gate_pass &&
    input.evidence_available
  );
}
