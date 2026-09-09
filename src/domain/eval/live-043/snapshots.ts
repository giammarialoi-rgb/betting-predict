import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { secondsToKickoff, windowOf } from "@/domain/eval/prospective-036/windows";
import type { Event039, Quote039 } from "@/domain/eval/live-039/types";
import { SNAPSHOT_WINDOWS_043, type Snapshot043, type SnapshotWindow043 } from "@/domain/eval/live-043/types";
import { appendSnapshot043, type Store043 } from "@/domain/eval/live-043/store";

const MAP: Record<string, SnapshotWindow043> = {
  "T-72h": "T-72H",
  "T-24h": "T-24H",
  "T-6h": "T-6H",
  "T-3h": "T-3H",
  "T-1h": "T-1H",
  "T-30m": "T-30M",
  "T-15m": "T-15M",
  "T-5m": "T-5M",
  "T-1m": "T-1M",
};

export function snapshotWindowFromOffset043(sec: number): SnapshotWindow043 | null {
  const w = windowOf(sec);
  if (!w) return null;
  return MAP[w] ?? null;
}

/** Build append-only snapshots from real quote timestamps (no interpolation). */
export function buildSnapshotsForEvent043(input: {
  store043: Store043;
  event: Event039;
  quotes: readonly Quote039[];
  modelVersion: string;
  marketSnapshot: Record<string, unknown>;
  modelSnapshot: Record<string, unknown>;
  featuresSnapshot: Record<string, unknown>;
}): { written: number; dup: number } {
  let written = 0;
  let dup = 0;
  if (!input.event.commence_time) return { written, dup };
  const kick = parseExactUtcMs(input.event.commence_time);
  if (kick == null) return { written, dup };

  const byWindow = new Map<SnapshotWindow043, Quote039>();
  for (const q of input.quotes) {
    if (q.event_id !== input.event.event_id || !q.available_at || q.temporal_class !== "STRICT") continue;
    const qMs = parseExactUtcMs(q.available_at);
    if (qMs == null || qMs >= kick) continue;
    const sec = secondsToKickoff(qMs, kick);
    const win = snapshotWindowFromOffset043(sec);
    if (!win || !(SNAPSHOT_WINDOWS_043 as readonly string[]).includes(win)) continue;
    const prev = byWindow.get(win);
    if (!prev || Date.parse(q.available_at) >= Date.parse(prev.available_at!)) byWindow.set(win, q);
  }

  for (const [window, q] of byWindow) {
    const qMs = parseExactUtcMs(q.available_at!)!;
    const snap: Snapshot043 = {
      event_id: input.event.event_id,
      window,
      snapshot_time: q.available_at!,
      seconds_to_kickoff: secondsToKickoff(qMs, kick),
      source_available_at: q.available_at!,
      collected_at: q.collected_at,
      market_snapshot: input.marketSnapshot,
      model_snapshot: input.modelSnapshot,
      features_snapshot: input.featuresSnapshot,
      model_version: input.modelVersion,
    };
    const r = appendSnapshot043(input.store043, snap);
    if (r === "ok") written += 1;
    else dup += 1;
  }
  return { written, dup };
}
