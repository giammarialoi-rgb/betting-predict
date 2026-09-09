import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runCollectorCycle042 } from "@/domain/eval/collector-042/cycle";
import { isLockHeldByAliveProcess042 } from "@/domain/eval/collector-042/lock";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { settledVerified039 } from "@/domain/eval/live-039/health";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { triangulateMarket043 } from "@/domain/eval/live-043/triangulation";
import { marketProbFromTri043, modelProbFromMarket043 } from "@/domain/eval/live-043/predict";
import { buildFeatureSnapshot043, dataQualityScore043 } from "@/domain/eval/live-043/features";
import {
  ensurePermanentDirs044,
  labAStore044,
  loadExp044Config,
  permanentRoot044,
  sportKind044,
} from "@/domain/eval/permanent-044/config";
import { event039ToPermanent044, quote039ToPermanent044 } from "@/domain/eval/permanent-044/normalize";
import {
  buildPredictionReasons044,
  confidenceScore044,
  edgeFromProbs044,
} from "@/domain/eval/permanent-044/predict";
import { buildDailyRankings044 } from "@/domain/eval/permanent-044/ranking";
import { buildTimelineSnapshots044 } from "@/domain/eval/permanent-044/timeline";
import { learningFromAutopsy044 } from "@/domain/eval/permanent-044/autopsy";
import {
  appendLearningCase044,
  expandedAutopsy044,
  learningCaseFromExpanded044,
} from "@/domain/eval/permanent-044/learning-expanded";
import { mineErrorPatterns044 } from "@/domain/eval/permanent-044/error-patterns";
import { whyThisPrediction044 } from "@/domain/eval/permanent-044/why-prediction";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";
import { classifyVsLock044 } from "@/domain/eval/permanent-044/firewall";
import { loadBudget044, saveBudget044, shouldSpend044 } from "@/domain/eval/permanent-044/budget";
import {
  appendAutopsy044,
  appendEvent044,
  appendJournal044,
  appendLearning044,
  appendLock044,
  appendPrediction044,
  appendQuote044,
  appendSettlement044,
  appendJsonl044,
  loadModelRegistry044,
  loadStore044,
  writeCheckpoint044,
} from "@/domain/eval/permanent-044/store";
import type { PermanentLock044, PermanentPrediction044, PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import { normalizeMarketType044 } from "@/domain/eval/permanent-044/taxonomy";

export type CycleResult044 = {
  eventsInserted: number;
  quotesInserted: number;
  predictionsWritten: number;
  locksWritten: number;
  settlementsWritten: number;
  autopsies: number;
  learningCandidates: number;
  snapshotsObserved: number;
  rankings: number;
  soccerEvents: number;
  tennisEvents: number;
  marketObservations: number;
  creditsRemaining: number | null;
  modelVersion: string;
  labALocked: number;
  labASettled: number;
  collector042: Awaited<ReturnType<typeof runCollectorCycle042>> | null;
  ranCollector042: boolean;
};

function predictionHash(p: PermanentPrediction044): string {
  return createHash("sha256").update(JSON.stringify(p)).digest("hex");
}

function nextPredictionSeq(storePreds: PermanentPrediction044[], eventId: string): number {
  let max = 0;
  for (const p of storePreds) {
    if (p.event_id === eventId && p.prediction_seq > max) max = p.prediction_seq;
  }
  return max + 1;
}

function materialChange(
  prev: PermanentPrediction044 | undefined,
  next: Omit<PermanentPrediction044, "prediction_id" | "prediction_seq" | "immutable" | "timestamp"> & {
    timestamp: string;
  },
): boolean {
  if (!prev) return true;
  return (
    JSON.stringify(prev.probability_model) !== JSON.stringify(next.probability_model) ||
    JSON.stringify(prev.probability_market) !== JSON.stringify(next.probability_market) ||
    prev.edge_absolute !== next.edge_absolute ||
    prev.confidence_score !== next.confidence_score ||
    prev.selection !== next.selection
  );
}

export async function runPermanent044Cycle(input: {
  labARoot?: string;
  permanentRoot?: string;
  runCollector042?: boolean;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
}): Promise<CycleResult044> {
  loadExp044Config();
  const labARoot = labAStore044(input.labARoot);
  const root = input.permanentRoot ?? permanentRoot044();
  ensurePermanentDirs044(root);
  const nowIso = input.nowIso ?? new Date().toISOString();

  let collector042: CycleResult044["collector042"] = null;
  let ranCollector042 = false;
  const budget = loadBudget044(root, labARoot);
  const catalogAgeHours = (() => {
    try {
      const cp = join(root, "checkpoints", "latest.json");
      if (!existsSync(cp)) return 99;
      const j = JSON.parse(readFileSync(cp, "utf8")) as { written_at?: string };
      if (!j.written_at) return 99;
      return (Date.now() - Date.parse(j.written_at)) / 3_600_000;
    } catch {
      return 99;
    }
  })();

  const wantCollector = Boolean(input.runCollector042);
  const spend = shouldSpend044({
    priority: "SETTLEMENT_LOCKED",
    remaining: budget.remaining,
    safeFloor: 50,
    catalogFreshHours: catalogAgeHours,
  });

  if (wantCollector && spend.allow) {
    const alive = isLockHeldByAliveProcess042(labARoot);
    if (!alive) {
      collector042 = await runCollectorCycle042({
        storeRoot: labARoot,
        forceDiscovery: input.forceDiscovery,
        fetchImpl: input.fetchImpl,
      });
      ranCollector042 = true;
      budget.last_request = "collector_042_cycle";
      budget.remaining = remainingCredits042(loadCreditState042(labARoot));
      saveBudget044(root, budget);
    } else {
      appendJournal044(root, { kind: "skip_collector", reason: "lab_a_collector_alive" });
    }
  } else if (wantCollector && !spend.allow) {
    appendJournal044(root, { kind: "skip_collector", reason: spend.reason });
  }

  const store039 = loadStore039(labARoot);
  const store = loadStore044(root);
  const reg = loadModelRegistry044(root);
  const modelVersion = reg.current_version;
  const featureVersion = "features_v1_market_dispersion";

  let eventsInserted = 0;
  let quotesInserted = 0;
  let predictionsWritten = 0;
  let locksWritten = 0;
  let settlementsWritten = 0;
  let autopsies = 0;
  let learningCandidates = 0;
  let snapshotsObserved = 0;

  const sportByEvent = new Map(store039.events.map((e) => [e.event_id, e.sport_key]));

  for (const ev of store039.events) {
    const pev = event039ToPermanent044(ev, nowIso);
    const inserted = appendEvent044(store, pev) === "ok";
    if (inserted) {
      eventsInserted += 1;
      const tax = normalizeMarketType044("1X2", sportKind044(ev.sport_key));
      appendJsonl044(join(root, "markets.jsonl"), {
        event_id: pev.event_id,
        sport: pev.sport,
        market_group: tax.market_group,
        market_type: tax.market_type,
        market_available: true,
        market_stage: "MARKET_DISCOVERED",
        source: pev.source,
        collected_at_utc: nowIso,
        note: "Observed via Lab A quotes when present; absence ≠ invented.",
      });
      appendJsonl044(join(root, "event_catalog", "catalog.jsonl"), {
        ...pev,
        scheduled_start_utc: pev.kickoff_utc,
        discovered_at: pev.collected_at_utc,
        last_seen_at: nowIso,
        match_confidence: pev.semantic_level === "STRICT" ? 0.9 : 0.5,
        data_completeness: pev.data_quality,
        event_fingerprint: pev.fingerprint,
      });
    }
  }

  const quotesByEvent = new Map<string, typeof store039.quotes>();
  for (const q of store039.quotes) {
    const sportKey = sportByEvent.get(q.event_id) ?? "soccer_unknown";
    const pq = quote039ToPermanent044(q, sportKey);
    if (appendQuote044(store, pq) === "ok") quotesInserted += 1;
    const arr = quotesByEvent.get(q.event_id) ?? [];
    arr.push(q);
    quotesByEvent.set(q.event_id, arr);
  }

  for (const ev of store039.events) {
    const qs = quotesByEvent.get(ev.event_id) ?? [];
    const decision = store039.decisions.find((d) => d.event_id === ev.event_id) ?? null;
    const settlement039 = store039.settlements.find((s) => s.event_id === ev.event_id) ?? null;

    const cutoffMs = ev.commence_time ? t1hCutoffMs039(ev.commence_time) : null;
    const asOf =
      decision?.decision_timestamp_utc ??
      (cutoffMs != null
        ? new Date(cutoffMs).toISOString()
        : qs.map((q) => q.available_at).filter(Boolean).sort().at(-1) ?? null);

    let tri = null;
    if (asOf) {
      const markets = [...new Set(qs.map((q) => q.market))];
      for (const market of markets) {
        tri = triangulateMarket043({
          eventId: ev.event_id,
          market,
          sportKey: ev.sport_key,
          quotes: qs,
          asOf,
        });
      }
    }

    const marketP = decision
      ? { HOME: decision.home_devig, DRAW: decision.draw_devig, AWAY: decision.away_devig }
      : marketProbFromTri043(tri);
    const modelP = modelProbFromMarket043(tri, decision);
    const edge = edgeFromProbs044(modelP, marketP);
    const features = buildFeatureSnapshot043({
      asOf: asOf ?? nowIso,
      marketDispersion: tri?.dispersion ?? null,
      nBooks: tri?.n_books ?? 0,
      sport: sportKind044(ev.sport_key) === "tennis" ? "tennis" : "soccer",
    });
    const dq = dataQualityScore043(features);
    const conf = confidenceScore044({
      hasMarket: Boolean(marketP),
      nBooks: tri?.n_books ?? 0,
      dispersion: tri?.dispersion ?? null,
      dataQuality: dq,
    });
    const reasons = buildPredictionReasons044({
      marketOnly: true,
      edgeAbsolute: edge.edge_absolute,
      confidence: conf,
      hasMarket: Boolean(marketP),
      nBooks: tri?.n_books ?? 0,
    });

    const seq = nextPredictionSeq(store.predictions, ev.event_id);
    const predBody = {
      event_id: ev.event_id,
      timestamp: nowIso,
      model_version: modelVersion,
      feature_version: featureVersion,
      market: "1X2",
      selection: edge.selection,
      line: null as number | null,
      probability_model: modelP,
      probability_market: marketP,
      edge_absolute: edge.edge_absolute,
      edge_relative: edge.edge_relative,
      confidence_score: conf,
      data_quality_score: dq,
      recommended: false as const,
      reason_codes: reasons.reason_codes,
      risk_flags: ["RESEARCH_ONLY", "NO_REAL_MONEY", "LAB_B_PERMANENT"],
      human_readable_reason: reasons.human,
      ranking_bucket: reasons.bucket,
    };

    const prevLatest = [...store.predictions].filter((p) => p.event_id === ev.event_id).sort((a, b) => b.prediction_seq - a.prediction_seq)[0];

    if (materialChange(prevLatest, predBody)) {
      const pred: PermanentPrediction044 = {
        ...predBody,
        prediction_id: createHash("sha256")
          .update(`pred|${ev.event_id}|${seq}|${nowIso}`)
          .digest("hex")
          .slice(0, 24),
        prediction_seq: seq,
        immutable: true,
      };
      if (appendPrediction044(store, pred) === "ok") {
        predictionsWritten += 1;
        appendJsonl044(join(root, "updates.jsonl"), {
          kind: "WHY_THIS_PREDICTION",
          ...whyThisPrediction044(pred),
          info_class: "INFORMATION_AVAILABLE_BEFORE_LOCK",
        });
        if (prevLatest) {
          appendJsonl044(join(root, "updates.jsonl"), {
            event_id: ev.event_id,
            from_prediction_id: prevLatest.prediction_id,
            to_prediction_id: pred.prediction_id,
            what_changed: ["probability", "edge", "confidence"],
            why_changed: "new_observation_or_material_delta",
            market_change: JSON.stringify(prevLatest.probability_market) !== JSON.stringify(pred.probability_market),
            model_change: JSON.stringify(prevLatest.probability_model) !== JSON.stringify(pred.probability_model),
            feature_change: prevLatest.feature_version !== pred.feature_version,
            confidence_change: pred.confidence_score - prevLatest.confidence_score,
            edge_change: (pred.edge_absolute ?? 0) - (prevLatest.edge_absolute ?? 0),
            locked_prediction_immutable: store.lockEventIds.has(ev.event_id),
            view: store.lockEventIds.has(ev.event_id) ? "PRE_KICKOFF_UPDATED_VIEW" : "OPEN",
            at: nowIso,
          });
        }
      }
    }

    const snaps = buildTimelineSnapshots044({
      store,
      eventId: ev.event_id,
      kickoffUtc: ev.commence_time,
      quotes: qs,
      modelVersion,
    });
    snapshotsObserved += snaps.observed;

    // Permanent Lab B lock — never writes Lab A decisions.jsonl
    if (decision && !store.lockEventIds.has(ev.event_id)) {
      const latestPred =
        [...store.predictions].filter((p) => p.event_id === ev.event_id).sort((a, b) => b.prediction_seq - a.prediction_seq)[0] ??
        null;
      const lock: PermanentLock044 = {
        event_id: ev.event_id,
        lock_timestamp: decision.decision_timestamp_utc,
        decision_context_hash: decision.decision_context_hash,
        model_version: modelVersion,
        feature_version: featureVersion,
        market_snapshot_hash: createHash("sha256")
          .update(JSON.stringify(marketP))
          .digest("hex")
          .slice(0, 24),
        prediction_hash: latestPred ? predictionHash(latestPred) : "none",
        lab: "PERMANENT_LIVE",
        lab_a_decision_id: decision.decision_id,
      };
      if (appendLock044(store, lock) === "ok") locksWritten += 1;
    }

    if (settlement039 && !store.settlementEventIds.has(ev.event_id)) {
      const sett: PermanentSettlement044 = {
        event_id: ev.event_id,
        result:
          settlement039.home_score != null && settlement039.away_score != null
            ? `${settlement039.home_score}-${settlement039.away_score}`
            : String(settlement039.outcome),
        market: "1X2",
        selection: null,
            outcome:
          settlement039.outcome === "UNSETTLED"
            ? "UNSETTLED"
            : "won",
        settled_at: settlement039.settled_at,
        source: settlement039.result_source,
        source_confidence: settlement039.outcome === "UNSETTLED" ? 0 : 0.9,
      };

      if (appendSettlement044(store, sett) === "ok") {
        settlementsWritten += 1;
        const latestPred = [...store.predictions]
          .filter((p) => p.event_id === ev.event_id)
          .sort((a, b) => b.prediction_seq - a.prediction_seq)[0];
        if (latestPred) {
          const lock = store.locks.find((l) => l.event_id === ev.event_id) ?? null;
          const expanded = expandedAutopsy044({
            prediction: latestPred,
            settlement: settlement039,
            lockTime: lock?.lock_timestamp ?? null,
          });
          if (appendAutopsy044(store, expanded as import("@/domain/eval/permanent-044/types").PermanentAutopsy044) === "ok") {
            autopsies += 1;
            const learn = learningFromAutopsy044(expanded);
            if (learn && appendLearning044(store, learn) === "ok") learningCandidates += 1;
            appendLearningCase044(root, learningCaseFromExpanded044(expanded, modelVersion));
          }
        }
      }
    }
  }

  const rankings = buildDailyRankings044({
    store,
    date: nowIso.slice(0, 10),
    modelVersion,
  });
  mineErrorPatterns044(store, nowIso);
  const top20 = top20Next3Days044(store, nowIso);
  appendJsonl044(join(root, "daily-rankings.jsonl"), {
    kind: "TOP_20_NEXT_3_DAYS",
    date: nowIso.slice(0, 10),
    rows: top20,
  });

  // Post-lock quote movement observation (never mutates lock) — one summary per event/cycle
  for (const lock of store.locks) {
    const qs = quotesByEvent.get(lock.event_id) ?? [];
    let after = 0;
    for (const q of qs) {
      if (!q.available_at) continue;
      const cls = classifyVsLock044({
        available_at: q.available_at,
        lock_time: lock.lock_timestamp,
      });
      if (cls === "INFORMATION_AVAILABLE_AFTER_LOCK") after += 1;
    }
    if (after > 0) {
      appendJsonl044(join(root, "updates.jsonl"), {
        kind: "POST_LOCK_UPDATE_SUMMARY",
        event_id: lock.event_id,
        post_lock_quote_observations: after,
        was_available_before_lock: false,
        was_available_after_lock: true,
        prediction_impact: "NONE_ON_LOCKED_PREDICTION",
        info_class: "INFORMATION_AVAILABLE_AFTER_LOCK",
        at: nowIso,
      });
    }
  }

  appendJsonl044(join(root, "model-runs.jsonl"), {
    experiment_id: "exp_044_permanent_live",
    model_version: modelVersion,
    parent_model_version: null,
    training_window: null,
    feature_set: featureVersion,
    hyperparameters: { market_only: true },
    selection_rule: "NO_AUTO_PROMOTE",
    at: nowIso,
    note: "Observation cycle — no training mutation",
  });

  writeCheckpoint044(root, {
    events: store.events.length,
    quotes: store.quotes.length,
    predictions: store.predictions.length,
    locks: store.locks.length,
    settlements: store.settlements.length,
    autopsies: store.autopsies.length,
    lab_a_events: store039.events.length,
    lab_a_decisions: store039.decisions.length,
  });

  appendJournal044(root, {
    kind: "cycle_complete",
    eventsInserted,
    quotesInserted,
    predictionsWritten,
    locksWritten,
  });

  const soccerEvents = store.events.filter((e) => e.sport === "soccer").length;
  const tennisEvents = store.events.filter((e) => e.sport === "tennis").length;

  return {
    eventsInserted,
    quotesInserted,
    predictionsWritten,
    locksWritten,
    settlementsWritten,
    autopsies,
    learningCandidates,
    snapshotsObserved,
    rankings: rankings.length,
    soccerEvents,
    tennisEvents,
    marketObservations: store.quotes.length,
    creditsRemaining: remainingCredits042(loadCreditState042(labARoot)),
    modelVersion,
    labALocked: store039.decisions.length,
    labASettled: settledVerified039(store039),
    collector042,
    ranCollector042,
  };
}
