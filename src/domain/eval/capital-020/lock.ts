import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";

/**
 * Blind lock: OutcomeContext is inaccessible until LOCK.
 */
export function assertLockedBeforeReveal(locked: boolean): void {
  if (!locked) {
    throw new BlindLeakageError("Outcome revealed before LOCK");
  }
}

export function assertOutcomeAbsentFromDecision(
  payload: Record<string, unknown>,
): void {
  if ("outcome" in payload && payload.outcome != null) {
    throw new BlindLeakageError("OUTCOME_LEAK: OutcomeContext in DecisionContext");
  }
}
