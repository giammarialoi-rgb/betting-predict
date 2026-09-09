import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { hasUtcOffset, isDateOnly, isNaiveDateTime, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { IntegrityCode036 } from "@/domain/eval/prospective-036/types";

export class ProspectiveIntegrityError extends Error {
  readonly code: IntegrityCode036;
  constructor(code: IntegrityCode036, message?: string) {
    super(message ?? code);
    this.name = "ProspectiveIntegrityError";
    this.code = code;
  }
}

export function assertNoSynthetic(flag: boolean): void {
  if (flag) throw new ProspectiveIntegrityError("SYNTHETIC_TIMESTAMP");
}

export function assertQuoteBeforeKickoff(quoteUtc: string, kickoffUtc: string): void {
  const q = parseExactUtcMs(quoteUtc);
  const k = parseExactUtcMs(kickoffUtc);
  if (q == null) throw new ProspectiveIntegrityError("MISSING_QUOTE_TIME");
  if (k == null) throw new ProspectiveIntegrityError("MISSING_KICKOFF");
  if (q >= k) throw new ProspectiveIntegrityError("QUOTE_AFTER_KICKOFF");
}

export function assertNotFutureVsCollector(sourceUtc: string, collectorUtc: string, driftMaxMs: number): void {
  const s = parseExactUtcMs(sourceUtc);
  const c = parseExactUtcMs(collectorUtc);
  if (s == null || c == null) throw new ProspectiveIntegrityError("AMBIGUOUS_TIMEZONE");
  if (s > c + driftMaxMs) throw new ProspectiveIntegrityError("CLOCK_DRIFT");
}

export function assertMonotonicSource(prevUtc: string | null, nextUtc: string): void {
  if (!prevUtc) return;
  const a = parseExactUtcMs(prevUtc);
  const b = parseExactUtcMs(nextUtc);
  if (a == null || b == null) throw new ProspectiveIntegrityError("AMBIGUOUS_TIMEZONE");
  if (b < a) throw new ProspectiveIntegrityError("SOURCE_TIME_NON_MONOTONIC");
}

export function assertNoFutureData(availableAtUtc: string, asOfUtc: string): void {
  const a = parseExactUtcMs(availableAtUtc);
  const b = parseExactUtcMs(asOfUtc);
  if (a == null || b == null) throw new BlindLeakageError("FUTURE_DATA");
  if (a > b) throw new BlindLeakageError("FUTURE_DATA");
}

export function assertExactClock(raw: string, kind: "quote" | "kickoff"): void {
  if (isDateOnly(raw)) throw new ProspectiveIntegrityError("DATE_ONLY_PROMOTION");
  if (isNaiveDateTime(raw) || !hasUtcOffset(raw)) {
    throw new ProspectiveIntegrityError(kind === "quote" ? "NAIVE_TIMESTAMP" : "AMBIGUOUS_TIMEZONE");
  }
}

export function assertLockedImmutable(state: string, mutating: boolean): void {
  if (mutating && (state === "LOCKED" || state === "KICKOFF" || state === "SETTLED" || state === "EVALUATED")) {
    throw new ProspectiveIntegrityError("POST_LOCK_MUTATION");
  }
}

export function assertOutcomeAfterLock(state: string): void {
  if (state !== "LOCKED" && state !== "KICKOFF" && state !== "SETTLED" && state !== "EVALUATED") {
    throw new ProspectiveIntegrityError("OUTCOME_BEFORE_LOCK");
  }
}

export function assertNotCloseAsDecision(usedClose: boolean): void {
  if (usedClose) throw new ProspectiveIntegrityError("CLOSE_USED_AS_DECISION");
}

export function assertNo037(open: boolean): void {
  if (open) throw new ExperimentIntegrityError("TASK 037 historical hunt must not be opened");
}
