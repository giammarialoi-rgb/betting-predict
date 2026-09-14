import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { classifyDecision048, buildWhy048, decisionFromPrediction048 } from "@/domain/eval/factory-048/decision";
import { classifyChange048, detectQuoteChange048 } from "@/domain/eval/factory-048/change";
import { buildAutopsy048, backwardSearch048 } from "@/domain/eval/factory-048/autopsy";
import { learningCase048, counterfactual048, aggregateErrorPatterns048 } from "@/domain/eval/factory-048/learning";
import { runDecisionEngine048 } from "@/domain/eval/factory-048/engine";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import {
  loadStore044,
  appendEvent044,
  appendQuote044,
  appendPrediction044,
  appendLock044,
  appendSettlement044,
} from "@/domain/eval/permanent-044/store";
import { ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { auditTask048 } from "@/domain/eval/factory-048/audit";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { planBudget047 } from "@/domain/eval/factory-047/budget";
import { defaultCreditState042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import type { PermanentPrediction044 } from "@/domain/eval/permanent-044/types";
import { MODEL_V2_048 } from "@/domain/eval/factory-048/config";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "t048-"));
}

function pred(over: Partial<PermanentPrediction044> & { event_id: string }): PermanentPrediction044 {
  return {
    prediction_id: over.prediction_id ?? "p1",
    event_id: over.event_id,
    timestamp: over.timestamp ?? "2026-09-01T00:00:00.000Z",
    model_version: over.model_version ?? "MODEL_v1",
    feature_version: "f1",
    market: over.market ?? "1X2",
    selection: over.selection !== undefined ? over.selection : "HOME",
    line: null,
    probability_model: over.probability_model !== undefined ? over.probability_model : { HOME: 0.45, DRAW: 0.3, AWAY: 0.25 },
    probability_market: over.probability_market !== undefined ? over.probability_market : { HOME: 0.44, DRAW: 0.31, AWAY: 0.25 },
    edge_absolute: over.edge_absolute !== undefined ? over.edge_absolute : 0.01,
    edge_relative: null,
    confidence_score: over.confidence_score ?? 40,
    data_quality_score: over.data_quality_score ?? 0.6,
    recommended: false,
    reason_codes: over.reason_codes ?? ["MODEL_IS_MARKET_ONLY"],
    risk_flags: ["RESEARCH_ONLY"],
    human_readable_reason: "test",
    ranking_bucket: "NO_BET",
    prediction_seq: over.prediction_seq ?? 1,
    immutable: true,
  };
}

describe("TASK 048 decision engine", () => {
  it("NO_BET and BET_CANDIDATE both have structured WHY", () => {
    const no = classifyDecision048({
      edge: 0.01,
      confidence: 40,
      dataQuality: 0.5,
      dispersion: 0.05,
      hasMarket: true,
      marketOnly: true,
    });
    assert.equal(no.decision, "NO_BET");
    const whyNo = buildWhy048({
      decision: no.decision,
      codes: no.codes,
      selection: "HOME",
      modelProb: 0.45,
      marketProb: 0.44,
      edge: 0.01,
      confidence: 40,
      risk: no.risk,
      dispersion: 0.05,
    });
    assert.ok(whyNo.WHY_PRIMARY.length > 10);
    assert.ok(whyNo.WHY_NO_BET);

    const bet = classifyDecision048({
      edge: 0.05,
      confidence: 60,
      dataQuality: 0.7,
      dispersion: 0.04,
      hasMarket: true,
      marketOnly: false,
    });
    assert.equal(bet.decision, "BET_CANDIDATE");
    const whyBet = buildWhy048({
      decision: bet.decision,
      codes: bet.codes,
      selection: "HOME",
      modelProb: 0.55,
      marketProb: 0.5,
      edge: 0.05,
      confidence: 60,
      risk: bet.risk,
      dispersion: 0.04,
    });
    assert.equal(whyBet.WHY_NO_BET, null);
    assert.ok(whyBet.WHY_SUPPORTING.length);
  });

  it("LOCK immutable and post-lock change isolated", () => {
    assert.throws(() => assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z"));
    assert.equal(classifyChange048(0.01), "NO_CHANGE");
    assert.equal(classifyChange048(0.15), "MATERIAL_CHANGE");
    const ch = detectQuoteChange048({
      eventId: "e1",
      pre: {
        event_id: "e1",
        bookmaker: "p",
        market: "h2h",
        market_group: "main",
        market_type: "h2h",
        selection: "HOME",
        line: null,
        price: 1.9,
        available_at_utc: "2026-09-01T16:00:00.000Z",
        collected_at_utc: "2026-09-01T16:00:01.000Z",
        source: "t",
        market_available: true,
        fingerprint: "a",
      },
      post: {
        event_id: "e1",
        bookmaker: "p",
        market: "h2h",
        market_group: "main",
        market_type: "h2h",
        selection: "HOME",
        line: null,
        price: 1.7,
        available_at_utc: "2026-09-01T17:30:00.000Z",
        collected_at_utc: "2026-09-01T17:30:01.000Z",
        source: "t",
        market_available: true,
        fingerprint: "b",
      },
      lockMs: Date.parse("2026-09-01T17:00:00.000Z"),
    });
    assert.equal(ch.relative_to_lock, "POST_LOCK");
  });

  it("autopsy separates outcome vs reasoning; does not mutate prediction", () => {
    const p = pred({ event_id: "e1", selection: "HOME", reason_codes: ["MODEL_IS_MARKET_ONLY"] });
    const frozen = JSON.stringify(p);
    const au = buildAutopsy048({
      prediction: p,
      settlement: {
        event_id: "e1",
        result: "HOME",
        market: "1X2",
        selection: "HOME",
        outcome: "won",
        settled_at: "2026-09-01T20:00:00.000Z",
        source: "t",
        source_confidence: 1,
      },
      decision: decisionFromPrediction048(p, MODEL_V2_048, 0.05),
      nowIso: "2026-09-01T20:01:00.000Z",
    });
    assert.equal(JSON.stringify(p), frozen);
    assert.equal(au.prediction_correct, true);
    assert.equal(au.outcome_reasoning_class, "OUTCOME_CORRECT_REASONING_NOT_SUPPORTED");
    assert.equal(au.capital_note, "THEORETICAL_ONLY_CAPITAL_CLOSED");
  });

  it("backward search never uses post-lock quotes", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "t",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-09-01T18:00:00.000Z",
      collected_at_utc: "2026-09-01T10:00:00.000Z",
      available_at_utc: "2026-09-01T10:00:00.000Z",
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "FINISHED",
    });
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "a",
      market: "h2h",
      market_group: "main",
      market_type: "h2h",
      selection: "HOME",
      line: null,
      price: 1.8,
      available_at_utc: "2026-09-01T16:00:00.000Z",
      collected_at_utc: "2026-09-01T16:00:01.000Z",
      source: "t",
      market_available: true,
      fingerprint: "q1",
    });
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "b",
      market: "h2h",
      market_group: "main",
      market_type: "h2h",
      selection: "HOME",
      line: null,
      price: 2.2,
      available_at_utc: "2026-09-01T16:30:00.000Z",
      collected_at_utc: "2026-09-01T16:30:01.000Z",
      source: "t",
      market_available: true,
      fingerprint: "q2",
    });
    // post-lock huge move — must not be used
    appendQuote044(store, {
      event_id: "e1",
      bookmaker: "a",
      market: "h2h",
      market_group: "main",
      market_type: "h2h",
      selection: "HOME",
      line: null,
      price: 9.0,
      available_at_utc: "2026-09-01T17:30:00.000Z",
      collected_at_utc: "2026-09-01T17:30:01.000Z",
      source: "t",
      market_available: true,
      fingerprint: "q3",
    });
    const p = pred({ event_id: "e1" });
    const au = buildAutopsy048({
      prediction: p,
      settlement: {
        event_id: "e1",
        result: "AWAY",
        market: "1X2",
        selection: "HOME",
        outcome: "lost",
        settled_at: "2026-09-01T20:00:00.000Z",
        source: "t",
        source_confidence: 1,
      },
      decision: null,
      nowIso: "2026-09-01T20:01:00.000Z",
    });
    const bw = backwardSearch048({
      store,
      prediction: p,
      autopsy: au,
      lockTime: "2026-09-01T17:00:00.000Z",
    });
    assert.ok(bw.SIGNAL_TIMESTAMP == null || Date.parse(bw.SIGNAL_TIMESTAMP) <= Date.parse("2026-09-01T17:00:00.000Z"));
    assert.notEqual(bw.SIGNAL_VALUE, "9.000");
  });

  it("learning case + counterfactual + pattern aggregation", () => {
    const p = pred({ event_id: "e1", selection: "HOME" });
    const dec = decisionFromPrediction048(p, MODEL_V2_048, 0.05);
    const au = buildAutopsy048({
      prediction: p,
      settlement: {
        event_id: "e1",
        result: "AWAY",
        market: "1X2",
        selection: "HOME",
        outcome: "lost",
        settled_at: "2026-09-01T20:00:00.000Z",
        source: "t",
        source_confidence: 1,
      },
      decision: dec,
      nowIso: "2026-09-01T20:01:00.000Z",
    });
    const bw = {
      event_id: "e1",
      autopsy_id: au.autopsy_id,
      signal: "dispersion_HOME",
      availability: "AVAILABLE_BUT_IGNORED" as const,
      SIGNAL_TIMESTAMP: "2026-09-01T16:00:00.000Z",
      SIGNAL_VALUE: "0.200",
      note: "x",
      info_class: "POST_EVENT_ANALYSIS" as const,
    };
    const lc = learningCase048({ autopsy: au, backward: bw, nowIso: "2026-09-01T20:02:00.000Z" });
    assert.ok(lc);
    assert.equal(lc!.auto_applied, false);
    assert.equal(lc!.status, "OBSERVATION_ONLY");
    const cf = counterfactual048({
      decision: dec,
      prediction: p,
      settlement: {
        event_id: "e1",
        result: "AWAY",
        market: "1X2",
        selection: "HOME",
        outcome: "lost",
        settled_at: "2026-09-01T20:00:00.000Z",
        source: "t",
        source_confidence: 1,
      },
    });
    assert.equal(cf.capital, "CLOSED");
    assert.equal(cf.OBSERVED_DECISION, "NO_BET");
    const patterns = aggregateErrorPatterns048([lc!], "2026-09-01T21:00:00.000Z");
    assert.ok(patterns.some((x) => x.status === "INSUFFICIENT_N"));
  });

  it("engine writes decisions for every prediction; duplicate prevention", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "t",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-12-01T15:00:00.000Z",
      collected_at_utc: "2026-11-01T00:00:00.000Z",
      available_at_utc: null,
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "SCHEDULED",
    });
    appendPrediction044(store, pred({ event_id: "e1", prediction_id: "p1" }));
    const r1 = runDecisionEngine048({ store, nowIso: "2026-11-02T00:00:00.000Z" });
    assert.equal(r1.decisions_written, 1);
    const store2 = loadStore044(root);
    const r2 = runDecisionEngine048({ store: store2, nowIso: "2026-11-02T01:00:00.000Z" });
    assert.equal(r2.decisions_written, 0);
  });

  it("settlement path produces autopsy + learning without touching lock prediction", () => {
    const root = tmp();
    ensurePermanentDirs044(root);
    const store = loadStore044(root);
    appendEvent044(store, {
      event_id: "e1",
      canonical_event_id: "c1",
      source: "t",
      source_event_id: "s1",
      sport: "soccer",
      competition: "epl",
      country: null,
      home_or_a: "A",
      away_or_b: "B",
      kickoff_utc: "2026-09-01T18:00:00.000Z",
      collected_at_utc: "2026-09-01T10:00:00.000Z",
      available_at_utc: "2026-09-01T10:00:00.000Z",
      semantic_level: "STRICT",
      data_quality: 1,
      fingerprint: "fp",
      status: "FINISHED",
    });
    const p = pred({ event_id: "e1", prediction_id: "p1", selection: "HOME" });
    appendPrediction044(store, p);
    appendLock044(store, {
      event_id: "e1",
      lock_timestamp: "2026-09-01T17:00:00.000Z",
      decision_context_hash: "h",
      model_version: "m",
      feature_version: "f",
      market_snapshot_hash: "ms",
      prediction_hash: "ph",
      lab: "PERMANENT_LIVE",
      lab_a_decision_id: null,
    });
    appendSettlement044(store, {
      event_id: "e1",
      result: "AWAY",
      market: "1X2",
      selection: "HOME",
      outcome: "lost",
      settled_at: "2026-09-01T20:00:00.000Z",
      source: "t",
      source_confidence: 1,
    });
    const r = runDecisionEngine048({ store, nowIso: "2026-09-01T20:05:00.000Z" });
    assert.ok(r.autopsies >= 1);
    assert.ok(r.learning_cases >= 1);
    assert.ok(r.counterfactuals >= 1);
    assert.equal(store.predictions[0]!.selection, "HOME");
  });

  it("budget protection still works", () => {
    const cfg = loadGovernorConfig042();
    const credit = {
      ...defaultCreditState042(cfg),
      observedRemaining: cfg.safeRemaining + 1,
      estimatedRemaining: cfg.safeRemaining + 1,
      safeRemaining: cfg.safeRemaining,
    };
    const plan = planBudget047({ credit, cfg, estimatedCost: 20, wantsDiscovery: true });
    assert.equal(plan.stop_gracefully, true);
  });

  it("Lab A untouched + audit flags", () => {
    const before = labAFingerprint046();
    assertLabAUntouched046(before);
    assert.equal(auditTask048(null).ok, true);
  });

  it("model version is MODEL_v2_DECISION_ENGINE", () => {
    assert.equal(MODEL_V2_048, "MODEL_v2_DECISION_ENGINE");
  });
});
