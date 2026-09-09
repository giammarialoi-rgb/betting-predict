import { join } from "node:path";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";

export type PostLockMovement047 = {
  event_id: string;
  market: string;
  selection: string;
  lock_price: number | null;
  post_lock_price: number | null;
  change: number | null;
  direction: "UP" | "DOWN" | "FLAT" | "UNKNOWN";
  magnitude: number | null;
  lock_available_at: string | null;
  post_lock_available_at: string | null;
  prediction_impact: "NONE_ON_LOCKED_PREDICTION";
  info_class: "INFORMATION_AVAILABLE_AFTER_LOCK";
};

/** Compare latest pre-lock vs post-lock quotes. Never mutates LOCK. */
export function scanPostLockMovements047(store: Store044, nowIso: string): PostLockMovement047[] {
  const out: PostLockMovement047[] = [];
  for (const lock of store.locks) {
    const lockMs = Date.parse(lock.lock_timestamp);
    if (!Number.isFinite(lockMs)) continue;
    const qs = store.quotes.filter((q) => q.event_id === lock.event_id && q.available_at_utc);
    const byKey = new Map<string, { pre: typeof qs; post: typeof qs }>();
    for (const q of qs) {
      const t = Date.parse(q.available_at_utc!);
      if (!Number.isFinite(t)) continue;
      const key = `${q.market}|${q.selection}|${q.bookmaker}`;
      const bucket = byKey.get(key) ?? { pre: [], post: [] };
      if (t <= lockMs) bucket.pre.push(q);
      else bucket.post.push(q);
      byKey.set(key, bucket);
    }
    for (const [key, bucket] of byKey) {
      if (!bucket.post.length) continue;
      const [market, selection] = key.split("|");
      const pre = bucket.pre.sort((a, b) => Date.parse(a.available_at_utc!) - Date.parse(b.available_at_utc!)).at(-1);
      const post = bucket.post.sort((a, b) => Date.parse(a.available_at_utc!) - Date.parse(b.available_at_utc!)).at(-1)!;
      const lockPrice = pre?.price ?? null;
      const change = lockPrice != null ? post.price - lockPrice : null;
      const direction =
        change == null ? "UNKNOWN" : change > 0.001 ? "UP" : change < -0.001 ? "DOWN" : "FLAT";
      const rec: PostLockMovement047 = {
        event_id: lock.event_id,
        market: market!,
        selection: selection!,
        lock_price: lockPrice,
        post_lock_price: post.price,
        change,
        direction,
        magnitude: change != null ? Math.abs(change) : null,
        lock_available_at: pre?.available_at_utc ?? null,
        post_lock_available_at: post.available_at_utc,
        prediction_impact: "NONE_ON_LOCKED_PREDICTION",
        info_class: "INFORMATION_AVAILABLE_AFTER_LOCK",
      };
      out.push(rec);
      appendJsonl044(join(store.root, "updates.jsonl"), {
        kind: "POST_LOCK_SNAPSHOT",
        ...rec,
        at: nowIso,
      });
    }
  }
  return out;
}
