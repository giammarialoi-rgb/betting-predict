import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStorage, NEON_IN_USE, NEON_STATUS_IT } from "@/domain/storage";
import { SOURCE_CAPABILITIES } from "@/domain/eval/data-intelligence/research/source-engine";
import {
  classifyHumanSourceStatus,
  http200IsNotSuccess,
  isDataSuccess,
} from "@/domain/eval/betmind-runtime/explain/source-status";
import {
  assertNoFutureDataInModel,
  assertNoMarketInputsInPredictionContext,
} from "@/domain/eval/predictive-intelligence/features/asof";
import { enqueueUpcomingEvents, pickResearchBatch, type ResearchQueueFile } from "@/domain/eval/data-intelligence/research/queue";
import { runBetQualificationGate } from "@/domain/eval/value/bet-qualification-gate";
import { decidePromotionStage, recordModelStage } from "@/domain/eval/predictive-intelligence/models/promotion-registry";
import { dataSupportsDixonColes, predictDixonColes } from "@/domain/eval/predictive-intelligence/models/dixon-coles";
import { dataSupportsNegBin, predictNegBin } from "@/domain/eval/predictive-intelligence/models/negbin";
import { dataSupportsGbm, trainGbmStumps } from "@/domain/eval/predictive-intelligence/models/gbm-stumps";
import { truthLabelFromQuality, truthLabelIt } from "@/domain/eval/betmind-runtime/explain/feature-dictionary";
import { createLearningCasePi } from "@/domain/eval/predictive-intelligence/learning/loop";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

describe("Phase 8 mega — source semantics", () => {
  it("HTTP 200 without event fields is not DATA_SUCCESS", () => {
    assert.equal(http200IsNotSuccess(200, []), true);
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "sofascore",
        ok: false,
        fetched: true,
        http_status: 200,
        parser_status: "NO_EVENT",
        fields_extracted: [],
      }),
      "NO_EVENT",
    );
    assert.equal(
      isDataSuccess({
        source_id: "espn",
        ok: false,
        fetched: true,
        http_status: 200,
        fields_extracted: [],
      }),
      false,
    );
  });

  it("403 / challenge is BLOCKED — no WAF bypass", () => {
    assert.equal(
      classifyHumanSourceStatus({
        source_id: "fbref",
        ok: false,
        fetched: true,
        http_status: 403,
        parser_status: "BLOCKED",
        fields_extracted: [],
      }),
      "BLOCKED",
    );
  });

  it("capability TRUE only if adapter extracts — WAF sources declare none", () => {
    assert.deepEqual(SOURCE_CAPABILITIES.sofascore, []);
    assert.deepEqual(SOURCE_CAPABILITIES.fbref, []);
    assert.deepEqual(SOURCE_CAPABILITIES.understat, []);
    assert.ok((SOURCE_CAPABILITIES["football-data-co-uk"] ?? []).includes("historical"));
    assert.ok((SOURCE_CAPABILITIES["open-meteo"] ?? []).includes("weather"));
  });
});

describe("Phase 8 mega — temporal and odds firewalls", () => {
  it("FUTURE_DATA_MUST_NOT_ENTER_MODEL", () => {
    assert.throws(
      () =>
        assertNoFutureDataInModel({
          asOf: "2026-09-11T12:00:00.000Z",
          available_at: "2026-09-11T12:00:01.000Z",
        }),
      /FUTURE_DATA_MUST_NOT_ENTER_MODEL/,
    );
    assert.doesNotThrow(() =>
      assertNoFutureDataInModel({
        asOf: "2026-09-11T12:00:00.000Z",
        available_at: "2026-09-11T11:59:00.000Z",
      }),
    );
  });

  it("odds never enter the independent model", () => {
    assert.throws(
      () => assertNoMarketInputsInPredictionContext(["home_gf_l5", "odds_open"]),
      /MARKET_INPUT_FORBIDDEN/,
    );
  });
});

describe("Phase 8 mega — storage without Neon", () => {
  it("settlement and learning persist on filesystem with DATABASE_URL unset", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const root = mkdtempSync(join(tmpdir(), "bm-p8-"));
    const store = getStorage(root);
    store.appendJsonl("settlements.jsonl", {
      event_id: "e1",
      home_goals: 2,
      away_goals: 1,
      settled_at: "2026-09-11T20:00:00.000Z",
    });
    store.appendJsonl("learning-candidates.jsonl", {
      candidate_id: "c1",
      event_id: "e1",
      auto_applied: false,
    });
    assert.equal(store.readJsonl("settlements.jsonl").length, 1);
    assert.equal(store.readJsonl("learning-candidates.jsonl").length, 1);
    assert.equal(NEON_IN_USE, false);
    assert.equal(NEON_STATUS_IT, "NEON NON UTILIZZATO");
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });
});

describe("Phase 8 mega — research queue", () => {
  it("every upcoming event is queued; budget only governs the batch", () => {
    const root = mkdtempSync(join(tmpdir(), "bm-q-"));
    const nowMs = Date.parse("2026-09-11T12:00:00.000Z");
    const events: PermanentEvent044[] = [1, 2, 3, 4, 5].map((i) => ({
      event_id: `e${i}`,
      canonical_event_id: `e${i}`,
      source: "espn",
      source_event_id: `s${i}`,
      sport: "soccer",
      competition: "EPL",
      country: "GB",
      home_or_a: `H${i}`,
      away_or_b: `A${i}`,
      kickoff_utc: `2026-09-12T1${i}:00:00.000Z`,
      collected_at_utc: "2026-09-11T12:00:00.000Z",
      available_at_utc: "2026-09-11T12:00:00.000Z",
      semantic_level: "RESEARCH",
      data_quality: 0.5,
      fingerprint: `fp${i}`,
      status: "UPCOMING",
    }));
    const file = enqueueUpcomingEvents({
      events,
      nowMs,
      nowIso: "2026-09-11T12:00:00.000Z",
      root,
    });
    assert.equal(file.items.length, 5);
    const batch = pickResearchBatch(file, 2, nowMs);
    assert.equal(batch.length, 2);
    assert.equal(file.items.length, 5);
  });

  it("does not silently drop INSUFFICIENT / PREDICTION states", () => {
    const file: ResearchQueueFile = {
      updated_at: "2026-09-11T12:00:00.000Z",
      items: [
        {
          event_id: "a",
          home: "H",
          away: "A",
          competition: "EPL",
          kickoff_utc: "2026-09-12T15:00:00.000Z",
          state: "INSUFFICIENT",
          last_cycle: 1,
          last_attempt_at: "2026-09-11T10:00:00.000Z",
          attempts: 1,
        },
      ],
    };
    const batch = pickResearchBatch(file, 4, Date.parse("2026-09-11T12:00:00.000Z"));
    assert.equal(file.items.length, 1);
    void batch;
  });
});

describe("Phase 8 mega — settlement / learning no leakage", () => {
  it("learning case records outcome after the event — auto_applied stays false", () => {
    const c = createLearningCasePi({
      event_id: "e1",
      prediction: { HOME: 0.5, DRAW: 0.3, AWAY: 0.2 },
      actual: "HOME",
      market_prob: { HOME: 0.45, DRAW: 0.28, AWAY: 0.27 },
      decision: "NO_BET",
      stake_result: null,
      nowIso: "2026-09-12T18:00:00.000Z",
    });
    assert.equal(c.auto_applied, false);
    assert.equal(c.actual, "HOME");
  });

  it("post-match label time cannot be used as a pre-kickoff feature", () => {
    assert.throws(
      () =>
        assertNoFutureDataInModel({
          asOf: "2026-09-11T14:00:00.000Z",
          available_at: "2026-09-11T16:05:00.000Z",
        }),
      /FUTURE_DATA_MUST_NOT_ENTER_MODEL/,
    );
  });
});

describe("Phase 8 mega — models / promotion / value", () => {
  it("Dixon-Coles / NegBin / GBM only when data supports them", () => {
    assert.equal(dataSupportsDixonColes(10), false);
    assert.equal(dataSupportsDixonColes(40), true);
    const p = predictDixonColes({ lambda_home: 1.4, lambda_away: 1.1 });
    assert.ok(p.HOME + p.DRAW + p.AWAY > 0.99);
    assert.equal(dataSupportsNegBin({ trainN: 10, goals: [1, 1, 1] }), false);
    const nb = predictNegBin({ lambda_home: 1.4, lambda_away: 1.1 });
    assert.ok(nb.HOME > 0);
    assert.equal(dataSupportsGbm({ trainN: 20, keyCount: 2 }), false);
    assert.equal(trainGbmStumps({ rows: [], keys: ["home_gf_l5"] }), null);
  });

  it("promotion is CANDIDATE→…→SHADOW|REJECTED — never auto PROMOTED", () => {
    const leak = decidePromotionStage({
      leakage_pass: false,
      train_n: 200,
      validate_n: 40,
      oos_n: 40,
      beat_naive: true,
      beat_market: true,
      min_train: 40,
    });
    assert.equal(leak.stage, "REJECTED");
    const ok = decidePromotionStage({
      leakage_pass: true,
      train_n: 200,
      validate_n: 40,
      oos_n: 40,
      beat_naive: true,
      beat_market: true,
      min_train: 40,
    });
    assert.equal(ok.stage, "SHADOW");
    const root = mkdtempSync(join(tmpdir(), "bm-reg-"));
    const rec = recordModelStage({
      root,
      model_id: "INDEPENDENT_POISSON_v1",
      version: "test",
      stage: ok.stage,
      leakage_pass: true,
      reasons: ok.reasons,
    });
    assert.equal(rec.auto_promotion, false);
    assert.equal(rec.production, false);
  });

  it("BET_QUALIFICATION_GATE keeps odds out of the model", () => {
    const fail = runBetQualificationGate({
      independent_ok: false,
      insufficient_data: true,
      edge: 0.08,
      confidence: 80,
      data_quality: 0.8,
      has_market: true,
    });
    assert.equal(fail.qualified, false);
    assert.equal(fail.odds_in_model, false);
    const noPromo = runBetQualificationGate({
      independent_ok: true,
      model_not_promoted: true,
      edge: 0.08,
      confidence: 80,
      data_quality: 0.8,
      has_market: true,
    });
    assert.equal(noPromo.decision, "MODEL_NOT_PROMOTED");
  });
});

describe("Phase 8 mega — UI truth labels", () => {
  it("maps qualities to DATI TROVATI/DERIVATI/STORICI/MANCANTI/ESCLUSI/MERCATO", () => {
    assert.equal(truthLabelIt(truthLabelFromQuality("REAL")), "DATI TROVATI");
    assert.equal(truthLabelIt(truthLabelFromQuality("DERIVED")), "DATI DERIVATI");
    assert.equal(truthLabelIt(truthLabelFromQuality("HISTORICAL_PRIOR")), "DATI STORICI");
    assert.equal(truthLabelIt(truthLabelFromQuality("MISSING")), "DATI MANCANTI");
    assert.equal(truthLabelIt(truthLabelFromQuality("EXCLUDED")), "DATI ESCLUSI");
    assert.equal(truthLabelIt(truthLabelFromQuality("REAL", true)), "DATI MERCATO");
  });
});
