import { createHash } from "node:crypto";
import { join } from "node:path";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { secondsToKickoff, windowOf } from "@/domain/eval/prospective-036/windows";
import type { Quote039 } from "@/domain/eval/live-039/types";
import { appendJsonl044, type Store044 } from "@/domain/eval/permanent-044/store";
import type { MissingReason044, SnapshotStatus044, TimelineWindow044 } from "@/domain/eval/permanent-044/types";

export const TIMELINE_WINDOWS_044: TimelineWindow044[] = [
  "T-72h",
  "T-48h",
  "T-24h",
  "T-12h",
  "T-6h",
  "T-3h",
  "T-1h",
  "T-30m",
  "T-15m",
  "T-5m",
  "T-1m",
  "KICKOFF",
];

const WINDOW_MAP: Record<string, TimelineWindow044> = {
  "T-72h": "T-72h",
  "T-48h": "T-48h",
  "T-24h": "T-24h",
  "T-12h": "T-12h",
  "T-6h": "T-6h",
  "T-3h": "T-3h",
  "T-1h": "T-1h",
  "T-30m": "T-30m",
  "T-15m": "T-15m",
  "T-5m": "T-5m",
  "T-1m": "T-1m",
};

export type TimelineSnapshot044 = {
  event_id: string;
  window: TimelineWindow044;
  status: SnapshotStatus044;
  missing_reason: MissingReason044 | null;
  snapshot_time: string | null;
  available_at_utc: string | null;
  collected_at_utc: string | null;
  model_version: string;
  fingerprint: string;
};

const seenSnaps = new WeakMap<object, Set<string>>();

function snapKey(s: TimelineSnapshot044): string {
  return `${s.event_id}|${s.window}|${s.status}|${s.available_at_utc ?? s.missing_reason ?? ""}`;
}

export function buildTimelineSnapshots044(input: {
  store: Store044;
  eventId: string;
  kickoffUtc: string | null;
  quotes: readonly Quote039[];
  modelVersion: string;
}): { observed: number; missing: number } {
  let observed = 0;
  let missing = 0;
  const keys = seenSnaps.get(input.store) ?? new Set<string>();
  seenSnaps.set(input.store, keys);

  if (!input.kickoffUtc) {
    for (const window of TIMELINE_WINDOWS_044) {
      const snap: TimelineSnapshot044 = {
        event_id: input.eventId,
        window,
        status: "MISSING",
        missing_reason: "TIMESTAMP_INVALID",
        snapshot_time: null,
        available_at_utc: null,
        collected_at_utc: null,
        model_version: input.modelVersion,
        fingerprint: createHash("sha256").update(`${input.eventId}|${window}|invalid`).digest("hex").slice(0, 16),
      };
      const k = snapKey(snap);
      if (keys.has(k)) continue;
      keys.add(k);
      appendJsonl044(join(input.store.root, "snapshots.jsonl"), snap);
      missing += 1;
    }
    return { observed, missing };
  }

  const kick = parseExactUtcMs(input.kickoffUtc);
  if (kick == null) {
    return buildTimelineSnapshots044({ ...input, kickoffUtc: null });
  }

  const byWindow = new Map<TimelineWindow044, Quote039>();
  for (const q of input.quotes) {
    if (q.event_id !== input.eventId || !q.available_at) continue;
    const qMs = parseExactUtcMs(q.available_at);
    if (qMs == null || qMs >= kick) continue;
    const sec = secondsToKickoff(qMs, kick);
    const w = windowOf(sec);
    const mapped = w ? WINDOW_MAP[w] : null;
    if (!mapped) continue;
    const prev = byWindow.get(mapped);
    if (!prev || Date.parse(q.available_at) >= Date.parse(prev.available_at!)) byWindow.set(mapped, q);
  }

  for (const window of TIMELINE_WINDOWS_044) {
    if (window === "KICKOFF") {
      const snap: TimelineSnapshot044 = {
        event_id: input.eventId,
        window,
        status: "MISSING",
        missing_reason: "OUTSIDE_WINDOW",
        snapshot_time: input.kickoffUtc,
        available_at_utc: null,
        collected_at_utc: null,
        model_version: input.modelVersion,
        fingerprint: createHash("sha256").update(`${input.eventId}|KICKOFF`).digest("hex").slice(0, 16),
      };
      const k = snapKey(snap);
      if (!keys.has(k)) {
        keys.add(k);
        appendJsonl044(join(input.store.root, "snapshots.jsonl"), snap);
        missing += 1;
      }
      continue;
    }
    const q = byWindow.get(window);
    if (q) {
      const snap: TimelineSnapshot044 = {
        event_id: input.eventId,
        window,
        status: "OBSERVED",
        missing_reason: null,
        snapshot_time: q.available_at,
        available_at_utc: q.available_at,
        collected_at_utc: q.collected_at,
        model_version: input.modelVersion,
        fingerprint: createHash("sha256")
          .update(`${input.eventId}|${window}|${q.available_at}|${q.raw_payload_hash}`)
          .digest("hex")
          .slice(0, 16),
      };
      const k = snapKey(snap);
      if (!keys.has(k)) {
        keys.add(k);
        appendJsonl044(join(input.store.root, "snapshots.jsonl"), snap);
        observed += 1;
      }
    } else {
      const reason: MissingReason044 =
        input.quotes.length === 0 ? "NO_MARKET" : "NO_SOURCE";
      const snap: TimelineSnapshot044 = {
        event_id: input.eventId,
        window,
        status: "MISSING",
        missing_reason: reason,
        snapshot_time: null,
        available_at_utc: null,
        collected_at_utc: null,
        model_version: input.modelVersion,
        fingerprint: createHash("sha256").update(`${input.eventId}|${window}|${reason}`).digest("hex").slice(0, 16),
      };
      const k = snapKey(snap);
      if (!keys.has(k)) {
        keys.add(k);
        appendJsonl044(join(input.store.root, "snapshots.jsonl"), snap);
        missing += 1;
      }
    }
  }
  return { observed, missing };
}
