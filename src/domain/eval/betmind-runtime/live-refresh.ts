/**
 * Lab / scheduled ESPN live refresh for in-play board events.
 * Merge-publishes live (and FT settlement) without wiping remote dossiers.
 */
import { getStorage } from "@/domain/storage";
import { NEON_IN_USE } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import {
  GOLDEN_EVENT_ID,
  ingestLiveStates,
  type LiveIngestResult,
  type LiveMatchTarget,
} from "@/domain/eval/betmind-runtime/live-state";
import { lockedPredictionForEvent, settleFromLiveState } from "@/domain/eval/betmind-runtime/settle-learn";
import type { SettlementLearnResult } from "@/domain/eval/betmind-runtime/settle-learn";
import {
  buildRuntimePayloadFromLocal,
  publishRuntimeStatus,
} from "@/domain/eval/betmind-runtime/remote-status";
import type { RemotePushResult } from "@/domain/eval/betmind-runtime/remote-mirror";

export type LiveRefreshReport = {
  at: string;
  neon_in_use: false;
  targets: number;
  ingest: LiveIngestResult;
  settlements: SettlementLearnResult[];
  settle_deferred: boolean;
  published: { ok: boolean; dossiers?: number; remote?: RemotePushResult; error?: string };
};

function targetsFromLocal(root: string): LiveMatchTarget[] {
  const by = new Map<string, LiveMatchTarget>();
  try {
    for (const ev of loadStore044(root).events) {
      if (!ev.event_id || !ev.home_or_a || !ev.away_or_b) continue;
      by.set(ev.event_id, {
        event_id: ev.event_id,
        home: ev.home_or_a,
        away: ev.away_or_b,
        kickoff_utc: ev.kickoff_utc,
      });
    }
  } catch {
    /* store optional */
  }
  try {
    for (const row of getStorage(root).loadBoardEvents()) {
      const p =
        row.payload && typeof row.payload === "object"
          ? (row.payload as Record<string, unknown>)
          : {};
      const id = String(row.event_id || p.event_id || "");
      const home = String(p.home_or_a ?? p.home ?? "");
      const away = String(p.away_or_b ?? p.away ?? "");
      if (!id || !home || !away) continue;
      if (!by.has(id)) {
        by.set(id, {
          event_id: id,
          home,
          away,
          kickoff_utc: (p.kickoff_utc as string | null) ?? null,
        });
      }
    }
  } catch {
    /* board optional */
  }
  if (!by.has(GOLDEN_EVENT_ID)) {
    by.set(GOLDEN_EVENT_ID, {
      event_id: GOLDEN_EVENT_ID,
      home: "AFC Bournemouth",
      away: "Brentford",
      kickoff_utc: "2026-09-12T14:00:00.000Z",
    });
  }
  return [...by.values()];
}

export async function refreshInPlayFromEspn(opts?: {
  labBRoot?: string;
  nowIso?: string;
  jsonText?: string;
  eventId?: string;
}): Promise<LiveRefreshReport> {
  if (NEON_IN_USE) throw new Error("NEON_BANNED");
  const root = opts?.labBRoot ?? permanentRoot044();
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const targets = targetsFromLocal(root).filter((t) =>
    opts?.eventId ? t.event_id === opts.eventId : true,
  );
  const ingest = await ingestLiveStates({
    targets,
    labBRoot: root,
    nowIso,
    jsonText: opts?.jsonText,
  });

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

  const published = await publishRuntimeStatus(buildRuntimePayloadFromLocal(root));
  return {
    at: nowIso,
    neon_in_use: false,
    targets: targets.length,
    ingest,
    settlements,
    settle_deferred: ingest.states.some((s) => !s.finished) || settlements.every((s) => !s.settled),
    published: published.ok
      ? { ok: true, dossiers: published.dossiers, remote: published.remote }
      : { ok: false, error: published.error },
  };
}
