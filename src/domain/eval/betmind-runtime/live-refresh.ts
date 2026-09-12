/**
 * Lab / scheduled ESPN live refresh for in-play board events.
 * Default publish is LIGHT: patch the existing remote artifact.
 * Full Lab B rebuild (`publishRuntimeStatus`) only with fullPublish / --full-publish.
 */
import { getStorage, NEON_IN_USE } from "@/domain/storage";
import type { LiveStateMirrorRow } from "@/domain/storage/types";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  GOLDEN_EVENT_ID,
  ingestLiveStates,
  ingestOpenLigaLiveStates,
  overlayLiveOnBoardRows,
  overlayLiveOnEvents,
  type LiveIngestResult,
  type LiveMatchTarget,
} from "@/domain/eval/betmind-runtime/live-state";
import { lockedPredictionForEvent, settleFromLiveState } from "@/domain/eval/betmind-runtime/settle-learn";
import type { SettlementLearnResult } from "@/domain/eval/betmind-runtime/settle-learn";
import {
  buildRuntimePayloadFromLocal,
  publishRuntimeStatus,
} from "@/domain/eval/betmind-runtime/remote-status";
import {
  pushRuntimeToRemoteIngest,
  readRemoteMirror,
  writeRemoteMirror,
  type RemoteKeyedSliceRow,
  type RemoteMirrorArtifact,
  type RemotePushResult,
  type RuntimeIngestPayload,
} from "@/domain/eval/betmind-runtime/remote-mirror";

export type LiveRefreshReport = {
  at: string;
  neon_in_use: false;
  targets: number;
  ingest: LiveIngestResult;
  settlements: SettlementLearnResult[];
  settle_deferred: boolean;
  publish_mode: "light" | "full";
  published: {
    ok: boolean;
    dossiers?: number;
    live_states?: number;
    remote?: RemotePushResult;
    error?: string;
  };
};

export const GOLDEN_LIVE_TARGET: LiveMatchTarget = {
  event_id: GOLDEN_EVENT_ID,
  home: "AFC Bournemouth",
  away: "Brentford",
  kickoff_utc: "2026-09-12T14:00:00.000Z",
};

function targetFromRecord(raw: unknown): LiveMatchTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const payload =
    rec.payload && typeof rec.payload === "object" ? (rec.payload as Record<string, unknown>) : rec;
  const event_id = String(rec.event_id ?? payload.event_id ?? "");
  const home = String(payload.home_or_a ?? payload.home ?? rec.home_or_a ?? rec.home ?? "");
  const away = String(payload.away_or_b ?? payload.away ?? rec.away_or_b ?? rec.away ?? "");
  if (!event_id || !home || !away) return null;
  return {
    event_id,
    home,
    away,
    kickoff_utc: (payload.kickoff_utc as string | null) ?? (rec.kickoff_utc as string | null) ?? null,
  };
}

const LIVE_STATUS_RE = /live|in_play|playing|\bht\b|halftime|first_half|second_half|in_progress/i;

function targetLooksInPlayOrRecent(
  raw: unknown,
  nowMs: number,
): boolean {
  if (!raw || typeof raw !== "object") return true;
  const rec = raw as Record<string, unknown>;
  const payload =
    rec.payload && typeof rec.payload === "object" ? (rec.payload as Record<string, unknown>) : rec;
  if (LIVE_STATUS_RE.test(String(payload.status ?? rec.status ?? ""))) return true;
  const ko = Date.parse(String(payload.kickoff_utc ?? rec.kickoff_utc ?? ""));
  if (!Number.isFinite(ko)) return true;
  const recent = 4 * 60 * 60 * 1000;
  const soon = 15 * 60 * 1000;
  return ko <= nowMs + soon && nowMs - ko <= recent;
}

/** Cheap targets — remote board events. Never scans events.jsonl. */
export function targetsFromRemoteAndBoard(
  remote: RemoteMirrorArtifact | null,
  root: string,
  eventId?: string,
  nowMs = Date.now(),
): LiveMatchTarget[] {
  const by = new Map<string, LiveMatchTarget>();
  const consider = (raw: unknown) => {
    if (!targetLooksInPlayOrRecent(raw, nowMs) && !eventId) return;
    const t = targetFromRecord(raw);
    if (t) by.set(t.event_id, t);
  };
  for (const raw of remote?.payload?.observatory?.next_events ?? []) consider(raw);
  for (const row of remote?.board_events ?? []) consider(row);
  try {
    for (const row of getStorage(root).loadBoardEvents()) consider(row);
  } catch {
    /* board optional */
  }
  if (eventId) {
    const hit = by.get(eventId);
    return hit ? [hit] : eventId === GOLDEN_EVENT_ID ? [GOLDEN_LIVE_TARGET] : [];
  }
  return [...by.values()];
}

export async function publishLiveSliceLight(opts: {
  existing?: RemoteMirrorArtifact | null;
  live: LiveStateMirrorRow[];
  settlements?: RemoteKeyedSliceRow[];
  learning_cases?: RemoteKeyedSliceRow[];
  nowIso: string;
}): Promise<{
  ok: boolean;
  dossiers?: number;
  live_states?: number;
  remote?: RemotePushResult;
  error?: string;
  mode: "light";
}> {
  const existing = opts.existing === undefined ? await readRemoteMirror() : opts.existing;
  if (!existing?.payload) {
    return {
      ok: false,
      error: "light_publish_requires_existing_mirror",
      mode: "light",
    };
  }
  const next = overlayLiveOnEvents(
    (existing.payload.observatory?.next_events as unknown[] | undefined) ?? [],
    opts.live,
  );
  const board = overlayLiveOnBoardRows(existing.board_events, opts.live, opts.nowIso);
  const payload: RuntimeIngestPayload = {
    ...existing.payload,
    published_at: opts.nowIso,
    observatory: existing.payload.observatory
      ? { ...existing.payload.observatory, next_events: next }
      : { next_events: next },
    live_snapshots: opts.live,
  };
  if (opts.settlements?.length) {
    payload.recent_settlements = [
      ...((Array.isArray(existing.payload.recent_settlements)
        ? existing.payload.recent_settlements
        : []) as unknown[]),
      ...opts.settlements.map((s) => s.payload),
    ];
  }
  if (opts.learning_cases?.length) {
    payload.learning_cases = [
      ...((Array.isArray(existing.payload.learning_cases)
        ? existing.payload.learning_cases
        : []) as unknown[]),
      ...opts.learning_cases.map((c) => c.payload),
    ];
  }
  const written = await writeRemoteMirror(payload, board, existing.dossiers ?? [], {
    live_states: opts.live,
    settlements: opts.settlements,
    learning_cases: opts.learning_cases,
  });
  if (!written.ok) {
    return { ok: false, error: written.error, mode: "light" };
  }
  const remote = await pushRuntimeToRemoteIngest(payload, board, {
    dossiers: existing.dossiers ?? [],
    live_states: opts.live,
    settlements: opts.settlements ?? [],
    learning_cases: opts.learning_cases ?? [],
  });
  return {
    ok: true,
    dossiers: written.dossiers,
    live_states: written.live_states,
    remote,
    mode: "light",
  };
}

export async function refreshInPlayFromEspn(opts?: {
  labBRoot?: string;
  nowIso?: string;
  jsonText?: string;
  eventId?: string;
  fullPublish?: boolean;
}): Promise<LiveRefreshReport> {
  if (NEON_IN_USE) throw new Error("NEON_BANNED");
  const root = opts?.labBRoot ?? permanentRoot044();
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const existing = await readRemoteMirror();
  const targets = targetsFromRemoteAndBoard(existing, root, opts?.eventId);
  const espn = await ingestLiveStates({
    targets,
    labBRoot: root,
    nowIso,
    jsonText: opts?.jsonText,
  });
  const matchedIds = new Set(espn.states.map((s) => s.event_id));
  const leftover = targets.filter((t) => !matchedIds.has(t.event_id));
  const openliga =
    leftover.length && opts?.jsonText == null
      ? await ingestOpenLigaLiveStates({
          targets: leftover,
          labBRoot: root,
          nowIso,
        })
      : {
          ok: false,
          source: "openligadb" as const,
          http_status: null,
          parsed: 0,
          matched: 0,
          written: 0,
          states: [],
          reason: leftover.length ? "espn_fixture_skip_openliga" : "espn_covered",
        };
  const states = [...espn.states, ...openliga.states];
  const ingest: LiveIngestResult = {
    ok: espn.ok || openliga.ok,
    source: openliga.states.length && espn.states.length ? "espn+openligadb" : openliga.states.length ? "openligadb" : "espn",
    http_status: espn.http_status ?? openliga.http_status,
    parsed: espn.parsed + openliga.parsed,
    matched: states.length,
    written: states.length,
    states,
    reason: [espn.reason, openliga.reason].filter(Boolean).join(" | "),
  };

  const settlements: SettlementLearnResult[] = [];
  for (const live of ingest.states) {
    if (!live.finished || live.home_goals == null || live.away_goals == null) continue;
    settlements.push(
      settleFromLiveState({
        live,
        prediction: lockedPredictionForEvent(live.event_id, root),
        labBRoot: root,
        nowIso,
      }),
    );
  }

  const settlementSlices: RemoteKeyedSliceRow[] = settlements
    .filter((s) => s.settlement)
    .map((s) => ({
      event_id: String(s.settlement!.event_id),
      published_at: String(s.settlement!.settled_at),
      payload: s.settlement as unknown as Record<string, unknown>,
    }));
  const learningSlices: RemoteKeyedSliceRow[] = settlements
    .filter((s) => s.learning_case && s.settlement)
    .map((s) => ({
      event_id: String(s.settlement!.event_id),
      published_at: String(s.settlement!.settled_at),
      payload: s.learning_case!,
    }));

  if (opts?.fullPublish) {
    const published = await publishRuntimeStatus(buildRuntimePayloadFromLocal(root));
    return {
      at: nowIso,
      neon_in_use: false,
      targets: targets.length,
      ingest,
      settlements,
      settle_deferred: ingest.states.some((s) => !s.finished) || settlements.every((s) => !s.settled),
      publish_mode: "full",
      published: published.ok
        ? { ok: true, dossiers: published.dossiers, remote: published.remote }
        : { ok: false, error: published.error },
    };
  }

  const published = await publishLiveSliceLight({
    existing,
    live: ingest.states,
    settlements: settlementSlices,
    learning_cases: learningSlices,
    nowIso,
  });
  return {
    at: nowIso,
    neon_in_use: false,
    targets: targets.length,
    ingest,
    settlements,
    settle_deferred: ingest.states.some((s) => !s.finished) || settlements.every((s) => !s.settled),
    publish_mode: "light",
    published: {
      ok: published.ok,
      dossiers: published.dossiers,
      live_states: published.live_states,
      remote: published.remote,
      error: published.error,
    },
  };
}
