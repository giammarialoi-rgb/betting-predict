import { createHash } from "node:crypto";
import { join } from "node:path";
import { t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { triangulateMarket043 } from "@/domain/eval/live-043/triangulation";
import { marketProbFromTri043 } from "@/domain/eval/live-043/predict";
import { buildFeatureSnapshot043, dataQualityScore043 } from "@/domain/eval/live-043/features";
import {
  buildPredictionReasons044,
  confidenceScore044,
  edgeFromProbs044,
} from "@/domain/eval/permanent-044/predict";
import { predictIndependentForEvent } from "@/domain/eval/predictive-intelligence/predict-live";
import { PI_MODEL_INDEPENDENT_ID } from "@/domain/eval/predictive-intelligence/config";
import {
  appendReasoningSnapshotPi,
} from "@/domain/eval/predictive-intelligence/reasoning/snapshot";
import {
  computeMarketSignals,
  applyMarketSignalConfidenceAdjust,
  appendMarketSignalSnapshot,
  writeMarketSignalsReport,
  writeMarketMovementReport,
  mirrorMarketIntelligenceToPiRoot,
} from "@/domain/eval/market-intelligence";
import { buildEventDiContext } from "@/domain/eval/data-intelligence/context";
import { loadApiSportsPrematchFromCacheSync } from "@/domain/eval/data-intelligence/adapters/api-sports-prematch";
import { buildDailyRankings044 } from "@/domain/eval/permanent-044/ranking";
import { buildTimelineSnapshots044 } from "@/domain/eval/permanent-044/timeline";
import { whyThisPrediction044 } from "@/domain/eval/permanent-044/why-prediction";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";
import { mineErrorPatterns044 } from "@/domain/eval/permanent-044/error-patterns";
import {
  appendPrediction044,
  appendLock044,
  appendJsonl044,
  loadModelRegistry044,
  writeCheckpoint044,
  appendJournal044,
  type Store044,
} from "@/domain/eval/permanent-044/store";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";
import { loadBrainState051 } from "@/domain/eval/brain-051/config";
import type { PermanentLock044, PermanentPrediction044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";
import type { Quote039 } from "@/domain/eval/live-039/types";

function toQuote039(q: PermanentQuote044): Quote039 {
  return {
    event_id: q.event_id,
    market: q.market === "1X2" ? "1X2" : q.market,
    bookmaker: q.bookmaker,
    outcome: q.selection,
    price: q.price,
    source_quote_timestamp: q.available_at_utc,
    collected_at: q.collected_at_utc,
    available_at: q.available_at_utc,
    raw_payload_hash: q.fingerprint.slice(0, 32),
    temporal_class: q.available_at_utc ? "STRICT" : "RESEARCH_TEMPORAL",
    match_status: "MATCH_EXACT",
    window: null,
    offset_seconds_from_kickoff: null,
    coverage_status: q.available_at_utc ? "COVERED" : "NO_OBSERVATION",
  };
}

function nextSeq(store: Store044, eventId: string): number {
  let max = 0;
  for (const p of store.predictions) {
    if (p.event_id === eventId && p.prediction_seq > max) max = p.prediction_seq;
  }
  return max + 1;
}

/**
 * Analyze EVERY Lab B event.
 * MODEL_PROBABILITY comes ONLY from independent features (PI).
 * MARKET is triangulation baseline — never copied into probability_model.
 */
export function analyzeAllLabB045(input: {
  store: Store044;
  nowIso: string;
}): {
  predicted: number;
  locked: number;
  noBet: number;
  candidates: number;
  blocked_downgrades: number;
} {
  const reg = loadModelRegistry044(input.store.root);
  const modelVersion = reg.current_version;
  const featureVersion = "features_pi_v1_independent";
  let predicted = 0;
  let locked = 0;
  let noBet = 0;
  const candidates = 0;
  let blocked_downgrades = 0;
  let reasoningWritten = 0;
  let marketSignalsWritten = 0;
  const brain = loadBrainState051(input.store.root);
  const workerPid = brain.worker_pid ?? (typeof process !== "undefined" ? process.pid : null);
  const cycleNumber = brain.cycles_completed ?? null;
  const movementRows: Array<{
    event_id: string;
    market: string;
    movement_label: string;
    delta_fav_p: number | null;
    steam_move: boolean;
    liquidity_proxy: string;
  }> = [];

  const quotesByEvent = new Map<string, PermanentQuote044[]>();
  for (const q of input.store.quotes) {
    const arr = quotesByEvent.get(q.event_id) ?? [];
    arr.push(q);
    quotesByEvent.set(q.event_id, arr);
  }

  const nowMs = Date.parse(input.nowIso);

  for (const ev of input.store.events) {
    const qs = quotesByEvent.get(ev.event_id) ?? [];
    const q039 = qs.map(toQuote039);
    const cutoffMs = ev.kickoff_utc ? t1hCutoffMs039(ev.kickoff_utc) : null;
    const asOf =
      cutoffMs != null && nowMs >= cutoffMs
        ? new Date(cutoffMs).toISOString()
        : qs.map((q) => q.available_at_utc).filter(Boolean).sort().at(-1) ?? input.nowIso;

    let tri = null;
    const markets = [...new Set(qs.map((q) => q.market))];
    for (const market of markets.length ? markets : ["1X2"]) {
      tri = triangulateMarket043({
        eventId: ev.event_id,
        market,
        sportKey: ev.competition,
        quotes: q039,
        asOf,
      });
    }

    const marketP = marketProbFromTri043(tri);
    const marketSignal = computeMarketSignals({
      eventId: ev.event_id,
      market: "1X2",
      asOf,
      quotes: qs.map((q) => ({
        event_id: q.event_id,
        market: q.market === "1X2" ? "1X2" : q.market,
        bookmaker: q.bookmaker,
        selection: q.selection,
        price: q.price,
        available_at_utc: q.available_at_utc,
        collected_at_utc: q.collected_at_utc,
        source: q.source,
      })),
      consensusDispersion: tri?.dispersion ?? null,
    });
    movementRows.push({
      event_id: ev.event_id,
      market: "1X2",
      movement_label: marketSignal.movement_label,
      delta_fav_p: marketSignal.delta_fav_p,
      steam_move: marketSignal.steam_move,
      liquidity_proxy: marketSignal.liquidity_proxy,
    });

    const diObservations = loadApiSportsPrematchFromCacheSync({
      eventId: ev.event_id,
      eventTime: ev.kickoff_utc,
      homeTeam: ev.home_or_a ?? "",
      awayTeam: ev.away_or_b ?? "",
      decisionTime: asOf,
      labBRoot: input.store.root,
    });

    const independent = predictIndependentForEvent({
      sport: ev.sport,
      home_team: ev.home_or_a,
      away_team: ev.away_or_b,
      competition: ev.competition,
      kickoff_utc: ev.kickoff_utc,
      marketProbability: marketP,
      labBRoot: input.store.root,
      diObservations,
      decisionTime: asOf,
    });

    // CRITICAL: never assign market probs to probability_model
    const modelP = independent.ok ? independent.probability_model : null;
    const insufficient = !independent.ok || independent.insufficient_data;
    const edge = edgeFromProbs044(modelP, marketP);

    const marketFeatures = buildFeatureSnapshot043({
      asOf,
      marketDispersion: tri?.dispersion ?? null,
      nBooks: tri?.n_books ?? 0,
      sport: ev.sport === "tennis" ? "tennis" : "soccer",
    });
    const marketDq = dataQualityScore043(marketFeatures);
    let dq =
      independent.data_quality != null
        ? Math.max(0, Math.min(1, 0.65 * independent.data_quality + 0.35 * marketDq))
        : marketDq * 0.4;

    let conf =
      independent.model_confidence != null
        ? independent.model_confidence
        : confidenceScore044({
            hasMarket: Boolean(marketP),
            nBooks: tri?.n_books ?? 0,
            dispersion: tri?.dispersion ?? null,
            dataQuality: dq,
          });

    const adj = applyMarketSignalConfidenceAdjust({
      confidence: conf,
      dataQuality: dq,
      signal: marketSignal,
    });
    conf = adj.confidence;
    dq = adj.dataQuality;

    const diCtx = buildEventDiContext({
      eventId: ev.event_id,
      homeTeam: ev.home_or_a,
      awayTeam: ev.away_or_b,
      kickoffUtc: ev.kickoff_utc,
      featureCoverage: independent.feature_coverage,
      confidence: conf,
      dataQuality: dq,
      extraFacts: (independent.di_conflicts ?? []).flatMap((c) =>
        c.sources.map((s) => ({
          source_id: s,
          field: c.field,
          value: c.detail,
        })),
      ),
    });
    conf = diCtx.confidence_adjust.confidence;
    dq = diCtx.confidence_adjust.dataQuality;

    const reasons = buildPredictionReasons044({
      marketOnly: false,
      edgeAbsolute: edge.edge_absolute,
      confidence: conf,
      hasMarket: Boolean(marketP),
      nBooks: tri?.n_books ?? 0,
    });
    // Strip any residual market-only codes from template
    reasons.reason_codes = reasons.reason_codes.filter(
      (c) => c !== "MODEL_IS_MARKET_ONLY" && c !== "MARKET_BASELINE_ONLY",
    );

    if (independent.ok) {
      reasons.reason_codes = [
        ...new Set([...reasons.reason_codes, ...independent.reason_codes, "MARKET_BASELINE_COMPARED"]),
      ];
      reasons.human = `Independent model ${PI_MODEL_INDEPENDENT_ID}. Market used only as baseline. ${reasons.human}`;
    } else {
      reasons.reason_codes = [
        ...new Set([
          ...reasons.reason_codes,
          ...independent.reason_codes,
          "INSUFFICIENT_DATA",
          "NO_INDEPENDENT_MODEL",
        ]),
      ];
      reasons.human = `INSUFFICIENT_DATA — independent features unavailable; market baseline recorded separately; MODEL not set from odds. ${reasons.human}`;
      reasons.bucket = "NO_BET";
    }
    if (independent.uncertain || adj.uncertain || diCtx.confidence_adjust.uncertain) {
      reasons.reason_codes = [...new Set([...reasons.reason_codes, "MODEL_UNCERTAIN"])];
    }
    reasons.reason_codes = [
      ...new Set([...reasons.reason_codes, ...marketSignal.reason_codes, ...diCtx.reason_codes]),
    ];
    noBet += 1;

    const seq = nextSeq(input.store, ev.event_id);
    const prev = [...input.store.predictions]
      .filter((p) => p.event_id === ev.event_id)
      .sort((a, b) => b.prediction_seq - a.prediction_seq)[0];

    const alreadyLocked = input.store.lockEventIds.has(ev.event_id);
    const material =
      !prev ||
      JSON.stringify(prev.probability_market) !== JSON.stringify(marketP) ||
      JSON.stringify(prev.probability_model) !== JSON.stringify(modelP) ||
      prev.confidence_score !== conf ||
      // Always persist when independent inference flips on/off
      (Boolean(prev.probability_model) !== Boolean(modelP)) ||
      (independent.ok && !String(prev.model_version ?? "").includes("INDEPENDENT_POISSON"));

    if (material) {
      const pred: PermanentPrediction044 = {
        prediction_id: createHash("sha256")
          .update(`pred|${ev.event_id}|${seq}|${input.nowIso}|${ANALYSIS_RUNTIME_VERSION}`)
          .digest("hex")
          .slice(0, 24),
        event_id: ev.event_id,
        timestamp: input.nowIso,
        model_version: independent.ok ? independent.model_version : `${modelVersion}|NO_INDEPENDENT`,
        feature_version: independent.features_version ?? featureVersion,
        market: "1X2",
        selection: edge.selection,
        line: null,
        probability_model: modelP,
        probability_market: marketP,
        edge_absolute: edge.edge_absolute,
        edge_relative: edge.edge_relative,
        confidence_score: conf,
        data_quality_score: dq,
        recommended: false,
        reason_codes: alreadyLocked
          ? [...reasons.reason_codes, "PRE_KICKOFF_UPDATED_VIEW"]
          : reasons.reason_codes,
        risk_flags: ["RESEARCH_ONLY", "NO_REAL_MONEY", "LAB_B_PERMANENT"],
        human_readable_reason: reasons.human,
        ranking_bucket: reasons.bucket,
        prediction_seq: seq,
        immutable: true,
        analysis_runtime_version: ANALYSIS_RUNTIME_VERSION,
        worker_pid: workerPid,
        cycle_number: cycleNumber,
      };
      const appendResult = appendPrediction044(input.store, pred);
      if (appendResult === "blocked_downgrade") {
        blocked_downgrades += 1;
      } else if (appendResult === "ok") {
        predicted += 1;
        appendJsonl044(join(input.store.root, "updates.jsonl"), {
          kind: "WHY_THIS_PREDICTION",
          ...whyThisPrediction044(pred),
          origin: ev.origin ?? "UNKNOWN",
          independent_why: independent.why,
        });
        appendReasoningSnapshotPi(
          {
            event_id: ev.event_id,
            model_version: pred.model_version,
            feature_snapshot: independent.feature_snapshot ?? {},
            feature_data: independent.feature_data ?? undefined,
            model_probability: modelP,
            market_probability: marketP,
            edge: edge.edge_absolute,
            ev: null,
            decision: insufficient ? "INSUFFICIENT_DATA" : "NO_BET_PENDING_048",
            confidence: conf,
            data_coverage: independent.data_coverage,
            feature_coverage: independent.feature_coverage,
            why: (() => {
              const base = independent.why ?? {
                strengths: [],
                weaknesses: ["INSUFFICIENT_DATA"],
                contextual_factors: [],
                data_quality: [],
                uncertainty: ["INSUFFICIENT_DATA"],
              };
              return {
                ...base,
                contextual_factors: [
                  ...new Set([...base.contextual_factors, ...marketSignal.contextual_factors]),
                ],
              };
            })(),
            at: input.nowIso,
            real_money: false,
          },
          input.store.root,
        );
        reasoningWritten += 1;
        if (alreadyLocked) {
          appendJsonl044(join(input.store.root, "updates.jsonl"), {
            kind: "POST_LOCK_OBSERVATION",
            event_id: ev.event_id,
            note: "Does not mutate LOCKED prediction context",
            at: input.nowIso,
          });
        }
      }
    }

    appendMarketSignalSnapshot(marketSignal, input.store.root);
    marketSignalsWritten += 1;

    buildTimelineSnapshots044({
      store: input.store,
      eventId: ev.event_id,
      kickoffUtc: ev.kickoff_utc,
      quotes: q039,
      modelVersion,
    });

    if (!alreadyLocked && cutoffMs != null && nowMs >= cutoffMs && marketP) {
      const latestPred = [...input.store.predictions]
        .filter((p) => p.event_id === ev.event_id)
        .sort((a, b) => b.prediction_seq - a.prediction_seq)[0];
      const lock: PermanentLock044 = {
        event_id: ev.event_id,
        lock_timestamp: new Date(cutoffMs).toISOString(),
        decision_context_hash: createHash("sha256")
          .update(
            JSON.stringify({
              marketP,
              modelP,
              model: latestPred?.model_version ?? modelVersion,
              asOf: new Date(cutoffMs).toISOString(),
            }),
          )
          .digest("hex"),
        model_version: latestPred?.model_version ?? modelVersion,
        feature_version: latestPred?.feature_version ?? featureVersion,
        market_snapshot_hash: createHash("sha256").update(JSON.stringify(marketP)).digest("hex").slice(0, 24),
        prediction_hash: latestPred
          ? createHash("sha256").update(JSON.stringify(latestPred)).digest("hex")
          : "none",
        lab: "PERMANENT_LIVE",
        lab_a_decision_id: null,
      };
      if (appendLock044(input.store, lock) === "ok") locked += 1;
    }
  }

  buildDailyRankings044({ store: input.store, date: input.nowIso.slice(0, 10), modelVersion });
  mineErrorPatterns044(input.store, input.nowIso);
  appendJsonl044(join(input.store.root, "daily-rankings.jsonl"), {
    kind: "TOP_20_NEXT_3_DAYS",
    date: input.nowIso.slice(0, 10),
    rows: top20Next3Days044(input.store, input.nowIso),
  });

  writeMarketSignalsReport({
    labBRoot: input.store.root,
    nowIso: input.nowIso,
    samples: marketSignalsWritten,
    note: "Market signals are COMPARE layer only — never independent MODEL inputs.",
  });
  writeMarketMovementReport({
    labBRoot: input.store.root,
    nowIso: input.nowIso,
    movements: movementRows,
  });
  mirrorMarketIntelligenceToPiRoot(input.store.root);

  writeCheckpoint044(input.store.root, {
    events: input.store.events.length,
    predictions: input.store.predictions.length,
    locks: input.store.locks.length,
    seed: input.store.events.filter((e) => e.origin === "LAB_A_SEED").length,
    discovered: input.store.events.filter((e) => e.origin === "DISCOVERED_LIVE").length,
    reasoning_snapshots: reasoningWritten,
    market_signals: marketSignalsWritten,
  });
  appendJournal044(input.store.root, {
    kind: "analyze_all_045",
    predicted,
    locked,
    noBet,
    independent_path: true,
    market_as_model_forbidden: true,
    market_signals_layer: true,
    market_signals_enter_model: false,
  });

  return { predicted, locked, noBet, candidates, blocked_downgrades };
}
