import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Store044 } from "@/domain/eval/permanent-044/store";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { MODEL_V2_048 } from "@/domain/eval/factory-048/config";
import { buildFeatureSnapshot048 } from "@/domain/eval/factory-048/features";
import { decisionFromPrediction048, type DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import { detectQuoteChange048 } from "@/domain/eval/factory-048/change";
import { buildAutopsy048, backwardSearch048, type Autopsy048 } from "@/domain/eval/factory-048/autopsy";
import {
  learningCase048,
  counterfactual048,
  aggregateErrorPatterns048,
  writeErrorPatterns048,
  appendLearningCase048,
  loadLearningCases048,
  type Counterfactual048,
} from "@/domain/eval/factory-048/learning";
import { buildRankings048 } from "@/domain/eval/factory-048/ranking";
import { computeMetrics048, writeDecisionMetrics048 } from "@/domain/eval/factory-048/metrics";
import { saveModelState048, loadModelState048, PARENT_MODEL_048 } from "@/domain/eval/factory-048/config";
import { resolvePiFormHistoryForEvent } from "@/domain/eval/predictive-intelligence/snapshot-bridge";
import { PI_MODEL_INDEPENDENT_ID } from "@/domain/eval/predictive-intelligence/config";

function loadDecisionIds(root: string): Set<string> {
  const p = join(root, "decisions.jsonl");
  const ids = new Set<string>();
  if (!existsSync(p)) return ids;
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const j = JSON.parse(line) as { decision_id?: string };
      if (j.decision_id) ids.add(j.decision_id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

function loadAutopsyIds(root: string): Set<string> {
  const p = join(root, "autopsies-048.jsonl");
  const ids = new Set<string>();
  if (!existsSync(p)) return ids;
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const j = JSON.parse(line) as { autopsy_id?: string };
      if (j.autopsy_id) ids.add(j.autopsy_id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

function estimateDispersion(store: Store044, eventId: string): number | null {
  const qs = store.quotes.filter((q) => q.event_id === eventId && q.market === "1X2");
  if (qs.length < 2) return null;
  const bySel = new Map<string, number[]>();
  for (const q of qs) {
    const arr = bySel.get(q.selection) ?? [];
    arr.push(q.price);
    bySel.set(q.selection, arr);
  }
  let max = 0;
  for (const prices of bySel.values()) {
    if (prices.length < 2) continue;
    max = Math.max(max, Math.max(...prices) - Math.min(...prices));
  }
  return max || null;
}

export type EngineResult048 = {
  decisions_written: number;
  feature_snapshots: number;
  changes: number;
  autopsies: number;
  learning_cases: number;
  counterfactuals: number;
  metrics: ReturnType<typeof computeMetrics048>;
  rankings: ReturnType<typeof buildRankings048>;
};

/** Run decision engine over Lab B — append-only, no Lab A writes. */
export function runDecisionEngine048(input: {
  store: Store044;
  nowIso: string;
  /** When set, only these event ids are decided (vertical slice). */
  eventIds?: string[];
}): EngineResult048 {
  const root = input.store.root;
  const existingDec = loadDecisionIds(root);
  const existingAu = loadAutopsyIds(root);

  // Latest prediction per event
  const latestPred = new Map<string, (typeof input.store.predictions)[0]>();
  for (const p of input.store.predictions) {
    const prev = latestPred.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) latestPred.set(p.event_id, p);
  }

  let decisions_written = 0;
  let feature_snapshots = 0;
  const allDecisions: DecisionRecord048[] = [];

  // Reload existing decisions for metrics
  if (existsSync(join(root, "decisions.jsonl"))) {
    for (const line of readFileSync(join(root, "decisions.jsonl"), "utf8").split(/\n/).filter(Boolean)) {
      try {
        allDecisions.push(JSON.parse(line) as DecisionRecord048);
      } catch {
        /* skip */
      }
    }
  }

  const allow = input.eventIds?.length ? new Set(input.eventIds) : null;
  for (const ev of input.store.events) {
    if (allow && !allow.has(ev.event_id)) continue;
    const p = latestPred.get(ev.event_id);
    if (!p) continue;
    const dispersion = estimateDispersion(input.store, ev.event_id);
    const locked = input.store.lockEventIds.has(ev.event_id);
    const dec = decisionFromPrediction048(p, MODEL_V2_048, dispersion);

    if (!existingDec.has(dec.decision_id)) {
      appendJsonl044(join(root, "decisions.jsonl"), dec);
      existingDec.add(dec.decision_id);
      allDecisions.push(dec);
      decisions_written += 1;

      const pi =
        (ev.sport === "soccer" || ev.sport === "football") &&
        p.reason_codes.some((c) => c.includes("INDEPENDENT") || c === PI_MODEL_INDEPENDENT_ID)
          ? resolvePiFormHistoryForEvent({
              home: ev.home_or_a,
              away: ev.away_or_b,
              kickoff_utc: ev.kickoff_utc,
              competition: ev.competition,
              labBRoot: root,
            })
          : null;
      const snap = buildFeatureSnapshot048({
        event: ev,
        quotes: input.store.quotes.filter((q) => q.event_id === ev.event_id),
        prediction: p,
        observedAt: input.nowIso,
        decisionContext: locked ? "LOCK" : "PRE_LOCK",
        modelVersion: p.model_version?.includes("INDEPENDENT") ? p.model_version : MODEL_V2_048,
        dispersion,
        nBooks: new Set(
          input.store.quotes.filter((q) => q.event_id === ev.event_id).map((q) => q.bookmaker),
        ).size,
        piFormFeatures: pi?.form_features ?? null,
        piHistoryFeatures: pi?.history_features ?? null,
      });
      appendJsonl044(join(root, "feature-snapshots.jsonl"), snap);
      feature_snapshots += 1;
    }
  }

  // Change detection for locked events with post-lock quotes
  let changes = 0;
  for (const lock of input.store.locks) {
    const lockMs = Date.parse(lock.lock_timestamp);
    const qs = input.store.quotes.filter((q) => q.event_id === lock.event_id && q.available_at_utc);
    const byKey = new Map<string, typeof qs>();
    for (const q of qs) {
      const k = `${q.market}|${q.selection}|${q.bookmaker}`;
      const arr = byKey.get(k) ?? [];
      arr.push(q);
      byKey.set(k, arr);
    }
    for (const arr of byKey.values()) {
      const sorted = arr.sort((a, b) => Date.parse(a.available_at_utc!) - Date.parse(b.available_at_utc!));
      if (sorted.length < 2) continue;
      const pre = sorted.filter((q) => Date.parse(q.available_at_utc!) <= lockMs).at(-1);
      const post = sorted.filter((q) => Date.parse(q.available_at_utc!) > lockMs).at(-1);
      if (!pre || !post) continue;
      const ch = detectQuoteChange048({
        eventId: lock.event_id,
        pre,
        post,
        lockMs,
      });
      appendJsonl044(join(root, "updates.jsonl"), { kind: "CHANGE_048", ...ch, at: input.nowIso });
      changes += 1;
    }
  }

  // Autopsy + learning for settlements
  let autopsiesN = 0;
  let learningN = 0;
  let counterN = 0;
  const newAutopsies: Autopsy048[] = [];
  const counters: Counterfactual048[] = [];

  for (const sett of input.store.settlements) {
    if (sett.outcome === "UNSETTLED") continue;
    const pred = latestPred.get(sett.event_id);
    if (!pred) continue;
    const dec =
      allDecisions
        .filter((d) => d.event_id === sett.event_id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
    const au = buildAutopsy048({
      prediction: pred,
      settlement: sett,
      decision: dec,
      nowIso: input.nowIso,
    });
    if (existingAu.has(au.autopsy_id)) continue;
    appendJsonl044(join(root, "autopsies-048.jsonl"), au);
    existingAu.add(au.autopsy_id);
    newAutopsies.push(au);
    autopsiesN += 1;

    const lock = input.store.locks.find((l) => l.event_id === sett.event_id);
    const bw = backwardSearch048({
      store: input.store,
      prediction: pred,
      autopsy: au,
      lockTime: lock?.lock_timestamp ?? null,
    });
    appendJsonl044(join(root, "backward-search.jsonl"), { kind: "BACKWARD_048", ...bw });

    const lc = learningCase048({ autopsy: au, backward: bw, nowIso: input.nowIso });
    if (lc) {
      appendLearningCase048(root, lc);
      learningN += 1;
    }

    if (dec) {
      const cf = counterfactual048({ decision: dec, prediction: pred, settlement: sett });
      appendJsonl044(join(root, "counterfactuals.jsonl"), cf);
      counters.push(cf);
      counterN += 1;
    }
  }

  // Load all 048 autopsies for metrics
  const allAu: Autopsy048[] = [...newAutopsies];
  if (existsSync(join(root, "autopsies-048.jsonl"))) {
    for (const line of readFileSync(join(root, "autopsies-048.jsonl"), "utf8").split(/\n/).filter(Boolean)) {
      try {
        const j = JSON.parse(line) as Autopsy048;
        if (!allAu.some((a) => a.autopsy_id === j.autopsy_id)) allAu.push(j);
      } catch {
        /* skip */
      }
    }
  }

  const cases = loadLearningCases048(root);
  const patterns = aggregateErrorPatterns048(cases, input.nowIso);
  writeErrorPatterns048(root, patterns, input.nowIso);

  const metrics = computeMetrics048({
    store: input.store,
    decisions: allDecisions,
    autopsies: allAu,
  });
  writeDecisionMetrics048(root, metrics);

  const rankings = buildRankings048(input.store, allDecisions);
  appendJsonl044(join(root, "daily-rankings.jsonl"), {
    kind: "RANK_048",
    at: input.nowIso,
    TOP_CONFIDENCE: rankings.TOP_CONFIDENCE.map((r) => r.event_id),
    TOP_EDGE: rankings.TOP_EDGE.map((r) => r.event_id),
  });

  const state = loadModelState048(root);
  saveModelState048(root, {
    ...state,
    current: MODEL_V2_048,
    parent: PARENT_MODEL_048,
    candidates: state.candidates,
    auto_promotion: false,
  });

  appendJsonl044(join(root, "cycle-journal.jsonl"), {
    kind: "engine_048",
    at: input.nowIso,
    decisions_written,
    feature_snapshots,
    changes,
    autopsies: autopsiesN,
    learning_cases: learningN,
    counterfactuals: counterN,
    fingerprint: createHash("sha256")
      .update(`${decisions_written}|${autopsiesN}|${learningN}`)
      .digest("hex")
      .slice(0, 12),
  });

  return {
    decisions_written,
    feature_snapshots,
    changes,
    autopsies: autopsiesN,
    learning_cases: learningN,
    counterfactuals: counterN,
    metrics,
    rankings,
  };
}
