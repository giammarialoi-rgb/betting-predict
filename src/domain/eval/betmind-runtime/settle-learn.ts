/**
 * Honest settlement + learning from a real FT score.
 * Works for PREDICTION and NO_PREDICTION. Never invents a final score.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getStorage } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import {
  appendLearning044,
  appendJsonl044,
  appendSettlement044,
  loadStore044,
} from "@/domain/eval/permanent-044/store";
import type { PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import type { LiveStateMirrorRow } from "@/domain/storage/types";

export type LockedPredictionView = {
  event_id: string;
  prediction_id?: string | null;
  model_version?: string | null;
  selection?: string | null;
  probability_model?: Record<string, number> | null;
  kind?: "PREDICTION" | "NO_PREDICTION";
};

export type SettlementLearnResult = {
  settled: boolean;
  learning_written: boolean;
  settlement: PermanentSettlement044 | null;
  learning_case: Record<string, unknown> | null;
  result: string | null;
  reason: string;
};

function actual1x2(home: number, away: number): "HOME" | "DRAW" | "AWAY" {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

export function lockedPredictionForEvent(
  eventId: string,
  root = permanentRoot044(),
): LockedPredictionView {
  const store = loadStore044(root);
  const pred = [...store.predictions].reverse().find((p) => p.event_id === eventId);
  if (!pred) {
    return { event_id: eventId, kind: "NO_PREDICTION", selection: null, model_version: "NO_PREDICTION" };
  }
  const noPred =
    pred.model_version === "NO_PREDICTION" ||
    pred.probability_model == null ||
    pred.selection == null;
  return {
    event_id: eventId,
    prediction_id: pred.prediction_id,
    model_version: pred.model_version,
    selection: pred.selection,
    probability_model: pred.probability_model,
    kind: noPred ? "NO_PREDICTION" : "PREDICTION",
  };
}

export function settleFromLiveState(opts: {
  live: LiveStateMirrorRow;
  prediction?: LockedPredictionView;
  labBRoot?: string;
  nowIso?: string;
}): SettlementLearnResult {
  const root = opts.labBRoot ?? permanentRoot044();
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const live = opts.live;
  if (!live.finished || live.home_goals == null || live.away_goals == null) {
    return {
      settled: false,
      learning_written: false,
      settlement: null,
      learning_case: null,
      result: null,
      reason: live.finished ? "ft_score_unavailable" : "event_not_finished",
    };
  }

  const store = loadStore044(root);
  if (store.settlementEventIds.has(live.event_id)) {
    const existing = store.settlements.find((s) => s.event_id === live.event_id) ?? null;
    return {
      settled: true,
      learning_written: false,
      settlement: existing,
      learning_case: null,
      result: existing?.result ?? `${live.home_goals}-${live.away_goals}`,
      reason: "already_settled",
    };
  }

  const pred = opts.prediction ?? lockedPredictionForEvent(live.event_id, root);
  const result = `${live.home_goals}-${live.away_goals}`;
  const actual = actual1x2(live.home_goals, live.away_goals);
  let outcome: PermanentSettlement044["outcome"] = "UNSETTLED";
  if (pred.kind === "PREDICTION" && pred.selection) {
    const sel = pred.selection.toUpperCase();
    outcome = sel === actual ? "won" : "lost";
  }

  const settlement = {
    event_id: live.event_id,
    result,
    market: "1X2",
    selection: pred.selection ?? null,
    outcome,
    settled_at: nowIso,
    source: live.source,
    source_confidence: 0.8,
    home: live.home,
    away: live.away,
    home_or_a: live.home,
    away_or_b: live.away,
    home_goals: live.home_goals,
    away_goals: live.away_goals,
    fthg: live.home_goals,
    ftag: live.away_goals,
    label: live.home && live.away ? `${live.home} vs ${live.away}` : live.event_id,
    prediction_kind: pred.kind ?? "NO_PREDICTION",
  } as PermanentSettlement044 & Record<string, unknown>;
  appendSettlement044(store, settlement);

  const learningId = createHash("sha256")
    .update(`learn|${live.event_id}|${nowIso}`)
    .digest("hex")
    .slice(0, 20);
  appendLearning044(store, {
    candidate_id: learningId,
    autopsy_id: `settle-${live.event_id.slice(0, 12)}`,
    hypothesis: "single-match learning_record only — no weight update",
    feature: null,
    observed_pattern: `result=${result} prediction=${pred.kind ?? "NO_PREDICTION"} actual=${actual}`,
    evidence_count: 1,
    confidence: 0,
    proposed_change: "none — no single-match weight hack",
    status: "OBSERVED",
  });
  const learningCase = {
    learning_record_id: learningId,
    event_id: live.event_id,
    prediction_id: pred.prediction_id ?? null,
    original_prediction: pred.probability_model ?? null,
    prediction_kind: pred.kind ?? "NO_PREDICTION",
    model_version: pred.model_version ?? null,
    live_update: {
      status: live.status,
      home_goals: live.home_goals,
      away_goals: live.away_goals,
      source: live.source,
    },
    result,
    home: live.home,
    away: live.away,
    settled_at: nowIso,
    single_match_weight_hack: false,
    status: "OBSERVED",
  };
  appendJsonl044(join(piRoot(root), "learning", "cases.jsonl"), learningCase);
  appendJsonl044(join(root, "learning-cases.jsonl"), learningCase);

  return {
    settled: true,
    learning_written: true,
    settlement,
    learning_case: learningCase,
    result,
    reason: `real finished score from ${live.source}`,
  };
}

export function collectLocalSettlementsForRemote(
  root = permanentRoot044(),
  limit = 40,
): Array<{ event_id: string; published_at: string; payload: Record<string, unknown> }> {
  try {
    const rows = getStorage(root).readJsonl<Record<string, unknown>>("settlements.jsonl");
    const by = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const id = String(row.event_id ?? "");
      if (!id) continue;
      by.set(id, row);
    }
    return [...by.values()].slice(-limit).map((s) => ({
      event_id: String(s.event_id),
      published_at: String(s.settled_at ?? s.published_at ?? ""),
      payload: s,
    }));
  } catch {
    return [];
  }
}

export function collectLocalLearningForRemote(
  root = permanentRoot044(),
  limit = 40,
): Array<{ event_id: string; published_at: string; payload: Record<string, unknown> }> {
  try {
    const store = getStorage(root);
    const fromPi = store.readJsonl<Record<string, unknown>>(
      join("predictive-intelligence", "learning", "cases.jsonl"),
    );
    const fromRoot = store.readJsonl<Record<string, unknown>>("learning-cases.jsonl");
    const rows = fromPi.length ? fromPi : fromRoot;
    const by = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const id = String(row.event_id ?? row.learning_record_id ?? "");
      if (!id) continue;
      by.set(id, row);
    }
    return [...by.values()].slice(-limit).map((c) => ({
      event_id: String(c.event_id ?? c.learning_record_id),
      published_at: String(c.settled_at ?? c.published_at ?? ""),
      payload: c,
    }));
  } catch {
    return [];
  }
}
