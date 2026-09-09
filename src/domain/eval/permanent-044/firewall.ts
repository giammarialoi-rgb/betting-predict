/** Scientific firewall: PRE_EVENT vs POST_EVENT information classes. */

export type InfoClass044 =
  | "INFORMATION_AVAILABLE_BEFORE_LOCK"
  | "INFORMATION_AVAILABLE_AFTER_LOCK"
  | "RESULT_INFORMATION"
  | "POST_EVENT_ANALYSIS";

export type Provenance044 = {
  observed_at: string;
  available_at: string | null;
  source: string;
  event_id: string;
  market: string | null;
  value: unknown;
  confidence: number | null;
  provenance: string;
  info_class: InfoClass044;
};

export function classifyVsLock044(input: {
  available_at: string | null;
  lock_time: string | null;
  is_result?: boolean;
  is_post_analysis?: boolean;
}): InfoClass044 {
  if (input.is_post_analysis) return "POST_EVENT_ANALYSIS";
  if (input.is_result) return "RESULT_INFORMATION";
  if (!input.available_at || !input.lock_time) return "INFORMATION_AVAILABLE_BEFORE_LOCK";
  const a = Date.parse(input.available_at);
  const l = Date.parse(input.lock_time);
  if (!Number.isFinite(a) || !Number.isFinite(l)) return "INFORMATION_AVAILABLE_BEFORE_LOCK";
  return a <= l ? "INFORMATION_AVAILABLE_BEFORE_LOCK" : "INFORMATION_AVAILABLE_AFTER_LOCK";
}

/** Reject any attempt to patch a locked prediction with post-lock data. */
export function assertNoPostLockMutation044(lockTime: string, patchAvailableAt: string | null): void {
  if (!patchAvailableAt) return;
  const a = Date.parse(patchAvailableAt);
  const l = Date.parse(lockTime);
  if (Number.isFinite(a) && Number.isFinite(l) && a > l) {
    throw new Error("LEAKAGE_REJECTED:post_lock_mutation");
  }
}
