/**
 * Live → settle → learning for one known event. No invented FT.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorage, NEON_IN_USE, storageBanner } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import {
  GOLDEN_EVENT_ID,
  ingestLiveStates,
  type LiveMatchTarget,
} from "@/domain/eval/betmind-runtime/live-state";
import { lockedPredictionForEvent, settleFromLiveState } from "@/domain/eval/betmind-runtime/settle-learn";
import {
  blobCredentialsPresent,
  createMemoryRemoteMirrorStore,
  getRemoteMirrorStore,
  setRemoteMirrorStoreOverride,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import { publishRuntimeStatus, buildRuntimePayloadFromLocal } from "@/domain/eval/betmind-runtime/remote-status";
import type { ChecklistStep } from "@/domain/eval/betmind-runtime/golden-e2e/types";

export type LiveE2EReport = {
  at: string;
  neon_in_use: false;
  neon_status_it: "NEON NON UTILIZZATO";
  blob_credentials: "KEY_PRESENT" | "KEY_MISSING";
  remote_backend: "vercel_blob" | "memory" | "none";
  event_id: string;
  source: "espn";
  live: {
    available: boolean;
    status: string | null;
    home_goals: number | null;
    away_goals: number | null;
    minute: string | null;
    reason: string;
  };
  settlement: { available: boolean; result: string | null; reason: string };
  learning: { written: boolean; reason: string };
  settle_deferred: boolean;
  settle_command: string;
  mirror: { pushed: boolean; reason?: string };
  checklist: ChecklistStep[];
  errors: Array<{ error: string; cause: string; evidence: string; remediation: string }>;
};

function step(name: string, ok: boolean, evidence: string, count?: number | null): ChecklistStep {
  return { step: name, ok, evidence, count: count ?? null };
}

export async function runGoldenLiveE2E(opts?: {
  eventId?: string;
  labBRoot?: string;
  nowIso?: string;
  jsonText?: string;
  useMemoryMirrorIfNoBlob?: boolean;
}): Promise<LiveE2EReport> {
  const root = opts?.labBRoot ?? permanentRoot044();
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const eventId = opts?.eventId ?? GOLDEN_EVENT_ID;
  const errors: LiveE2EReport["errors"] = [];
  const checklist: ChecklistStep[] = [];

  if (NEON_IN_USE) throw new Error("NEON_BANNED");
  checklist.push(step("neon_excluded", true, storageBanner().neon_status_it));

  const blobKey = blobCredentialsPresent() ? "KEY_PRESENT" : "KEY_MISSING";
  if (blobKey === "KEY_MISSING" && opts?.useMemoryMirrorIfNoBlob !== false) {
    setRemoteMirrorStoreOverride(createMemoryRemoteMirrorStore());
  }
  const backend = getRemoteMirrorStore().kind;

  const store = loadStore044(root);
  const ev = store.events.find((e) => e.event_id === eventId);
  const board = getStorage(root)
    .loadBoardEvents()
    .find((r) => r.event_id === eventId);
  const payload =
    board && typeof board.payload === "object" && board.payload
      ? (board.payload as Record<string, unknown>)
      : {};
  const target: LiveMatchTarget = {
    event_id: eventId,
    home: String(ev?.home_or_a ?? payload.home_or_a ?? "AFC Bournemouth"),
    away: String(ev?.away_or_b ?? payload.away_or_b ?? "Brentford"),
    kickoff_utc: (ev?.kickoff_utc as string | null) ?? (payload.kickoff_utc as string | null) ?? "2026-09-12T14:00:00.000Z",
  };
  checklist.push(
    step("identity", Boolean(target.home && target.away), `${target.home} vs ${target.away} · ${eventId}`),
  );

  const ingest = await ingestLiveStates({
    targets: [target],
    labBRoot: root,
    nowIso,
    jsonText: opts?.jsonText,
  });
  const liveRow = ingest.states.find((s) => s.event_id === eventId) ?? ingest.states[0] ?? null;
  checklist.push(
    step(
      "live",
      ingest.parsed > 0,
      `${ingest.reason} http=${ingest.http_status} parsed=${ingest.parsed} matched=${ingest.matched}`,
      ingest.written,
    ),
  );
  if (ingest.parsed === 0) {
    errors.push({
      error: "live_unavailable",
      cause: ingest.http_status === 403 ? "espn_blocked" : "espn_empty",
      evidence: `http=${ingest.http_status} parsed=${ingest.parsed}`,
      remediation: "Retry ESPN scoreboard later. Do not invent a live score.",
    });
  } else if (!liveRow) {
    errors.push({
      error: "live_unmatched",
      cause: "ESPN events did not match the Golden Event identity",
      evidence: ingest.reason,
      remediation: "Check team names; do not force a match on a different fixture.",
    });
  }

  let settlement: LiveE2EReport["settlement"] = {
    available: false,
    result: null,
    reason: liveRow?.finished ? "ft_score_unavailable" : "event_not_finished",
  };
  let learning: LiveE2EReport["learning"] = { written: false, reason: "not_settled" };
  if (liveRow?.finished && liveRow.home_goals != null && liveRow.away_goals != null) {
    const pred = lockedPredictionForEvent(eventId, root);
    const settled = settleFromLiveState({ live: liveRow, prediction: pred, labBRoot: root, nowIso });
    settlement = { available: settled.settled, result: settled.result, reason: settled.reason };
    learning = { written: settled.learning_written, reason: settled.reason };
  }
  checklist.push(
    step("settlement", settlement.available || !liveRow?.finished, settlement.reason, settlement.available ? 1 : 0),
  );
  checklist.push(
    step("learning", learning.written || !settlement.available, learning.reason, learning.written ? 1 : 0),
  );

  const payloadLocal = buildRuntimePayloadFromLocal(root);
  const published = await publishRuntimeStatus(payloadLocal);
  checklist.push(
    step(
      "publish_merge",
      published.ok,
      published.ok
        ? `board=${published.board} dossiers=${published.dossiers} remote=${published.remote.pushed}`
        : published.error,
    ),
  );

  const settleDeferred = !settlement.available;
  return {
    at: nowIso,
    neon_in_use: false,
    neon_status_it: "NEON NON UTILIZZATO",
    blob_credentials: blobKey,
    remote_backend: backend,
    event_id: eventId,
    source: "espn",
    live: {
      available: Boolean(liveRow),
      status: liveRow?.status ?? null,
      home_goals: liveRow?.home_goals ?? null,
      away_goals: liveRow?.away_goals ?? null,
      minute: liveRow?.minute ?? null,
      reason: ingest.reason,
    },
    settlement,
    learning,
    settle_deferred: settleDeferred,
    settle_command: `pnpm betmind:e2e:live -- --event ${eventId}`,
    mirror: {
      pushed: published.ok && "remote" in published ? published.remote.pushed : false,
      reason: published.ok && "remote" in published ? published.remote.reason : published.ok ? undefined : published.error,
    },
    checklist,
    errors,
  };
}

export function writeLiveE2EArtifacts(report: LiveE2EReport): string {
  const dir = join(process.cwd(), "artifacts", "golden-e2e");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "e2e-live-report.json");
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}
