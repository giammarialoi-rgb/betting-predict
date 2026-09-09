import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discoverAcquisitionTargets,
  fetchAcquisitionFile,
  runAcquisitionBatch,
  materializeOfflineArchive,
  hashCsvContent,
} from "@/domain/acquisition/football-data-co-uk";
import { REAL_TRUTH_LAB_E0_CSV } from "@/domain/eval/real-lab/pack-csv";
import { reconcileTruth } from "@/domain/cross-source/truth-reconciler";
import { buildDataQualityReport } from "@/domain/eval/data-quality-report-v2";
import { buildFeatureEngineV4 } from "@/domain/features/engine-v4";
import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";
import { decisionAsOfForEvent } from "@/domain/eval/real-lab/truth-lab";
import { runBlindMarketLabV1 } from "@/domain/eval/blind-market-lab";
import { classifyChallengerSignal } from "@/domain/eval/challenger-signals";
import { explainDecision } from "@/domain/eval/explain-decision";
import { classifyLabError } from "@/domain/eval/lab-error-classes";
import {
  buildCorrelationClusters,
  maxClusterExposure,
} from "@/domain/risk/correlation-exposure";
import { assertNoAutoChampionPromotion } from "@/domain/eval/challenger";
import { assertDecisionContextSafe } from "@/domain/eval/blind-replay";
import { buildRealHistoricalEvaluationSample } from "@/domain/eval/real-lab/truth-lab";
import { FOOTBALL_ACQUISITION_MARKET_CATALOG } from "@/domain/markets/acquisition-catalog";
import { cataloguedStatPlaceholders, assertStatUsableInStrict } from "@/domain/stats/capability-registry";
import { FOOTBALL_DATA_CO_UK_DIVISIONS } from "@/providers/football-data-co-uk/bookmakers";
import { findTop10V2 } from "@/domain/eval/top10-v2";

describe("TASK 013 Blind Market Lab V1", () => {
  const dataset = loadRealTruthLabPack();

  it("multi-division discover plans targets without assuming files exist", () => {
    const targets = discoverAcquisitionTargets({
      divisions: ["E0", "E1", "I1", "SP1", "D1", "F1", "N1"],
      seasonCodes: ["2324", "2425"],
    });
    assert.equal(targets.length, 14);
    assert.ok(Object.keys(FOOTBALL_DATA_CO_UK_DIVISIONS).includes("E2"));
    assert.ok(Object.keys(FOOTBALL_DATA_CO_UK_DIVISIONS).includes("N2"));
  });

  it("HTTP 503 → BLOCKED with no bypass; offline archive works", async () => {
    const url = "https://www.football-data.co.uk/mmz4281/2425/E0.csv";
    const blocked = await fetchAcquisitionFile(
      { division: "E0", seasonCode: "2425", url },
      {
        responsesByUrl: new Map([
          [url, { status: 503, text: "Service Unavailable" }],
        ]),
      },
    );
    assert.equal(blocked.provider_status, "BLOCKED");
    assert.equal(blocked.reason, "HTTP_503");
    assert.equal(blocked.csvText, null);

    const offline = materializeOfflineArchive([
      {
        division: "E0",
        seasonCode: "1920",
        csvText: REAL_TRUTH_LAB_E0_CSV,
        source: "offline_pack",
      },
    ]);
    assert.equal(offline[0]!.provider_status, "OK");
    assert.equal(offline[0]!.content_hash, hashCsvContent(REAL_TRUTH_LAB_E0_CSV));

    const batch = await runAcquisitionBatch(
      [{ division: "E0", seasonCode: "2425", url }],
      {
        responsesByUrl: new Map([
          [url, { status: 503, text: "nope" }],
        ]),
      },
    );
    assert.equal(batch.blocked, 1);
    assert.equal(batch.ok, 0);
  });

  it("404 NOT_FOUND continues; invalid content rejected", async () => {
    const url404 = "https://example.test/missing.csv";
    const r404 = await fetchAcquisitionFile(
      { division: "N2", seasonCode: "2425", url: url404 },
      {
        responsesByUrl: new Map([[url404, { status: 404, text: "missing" }]]),
      },
    );
    assert.equal(r404.provider_status, "NOT_FOUND");

    const urlBad = "https://example.test/bad.csv";
    const bad = await fetchAcquisitionFile(
      { division: "E0", seasonCode: "2425", url: urlBad },
      {
        responsesByUrl: new Map([
          [urlBad, { status: 200, text: "<html>not csv</html>" }],
        ]),
      },
    );
    assert.equal(bad.provider_status, "INVALID");
  });

  it("TruthReconciler: AGREEMENT vs CONFLICT without majority vote", () => {
    const agree = reconcileTruth({
      subject: "ft_score",
      observations: [
        {
          sourceId: "football-data-org",
          value: { home: 2, away: 1 },
          availableAt: new Date("2024-01-01"),
          temporalPrecision: "exact",
          authority: "primary",
          completeness: "full",
          freshnessMs: 0,
          provenance: "api",
        },
        {
          sourceId: "football-data-co-uk",
          value: { home: 2, away: 1 },
          availableAt: new Date("2024-01-01"),
          temporalPrecision: "unknown",
          authority: "primary",
          completeness: "full",
          freshnessMs: 1000,
          provenance: "csv",
        },
      ],
    });
    assert.equal(agree.decision, "AGREEMENT");
    assert.deepEqual(agree.canonical, { home: 2, away: 1 });

    const conflict = reconcileTruth({
      subject: "ft_score",
      observations: [
        {
          sourceId: "a",
          value: { home: 2, away: 1 },
          availableAt: new Date(),
          temporalPrecision: "exact",
          authority: "primary",
          completeness: "full",
          freshnessMs: 0,
          provenance: "a",
        },
        {
          sourceId: "b",
          value: { home: 1, away: 1 },
          availableAt: new Date(),
          temporalPrecision: "exact",
          authority: "primary",
          completeness: "full",
          freshnessMs: 0,
          provenance: "b",
        },
      ],
    });
    assert.equal(conflict.decision, "CONFLICT");
    assert.equal(conflict.canonical, null);
  });

  it("DataQualityReport blocks UNKNOWN temporal under STRICT", () => {
    const r = buildDataQualityReport({
      completeness: 0.93,
      exactPrecisionShare: 0,
      sourceAuthorityShare: 0.9,
      crossSourceAgreementShare: 0.8,
      entityResolutionShare: 0.9,
      duplicateRate: 0.01,
      missingRate: 0.05,
    });
    assert.equal(r.kind, "DATA_QUALITY_REPORT");
    assert.equal(r.quality_level, "UNUSABLE");
    assert.ok(
      r.blocking_reasons.some((x) => x.includes("temporal_precision")),
    );
  });

  it("Feature Engine V4 + acquisition catalog + stat placeholders", () => {
    const event = dataset.events[20]!;
    const asOf = decisionAsOfForEvent(event);
    const v4 = buildFeatureEngineV4({
      event,
      asOf,
      dataset,
      marketQuotes: dataset.quotes.filter((q) => q.eventId === event.eventId),
    });
    assert.ok(v4.features.some((f) => f.featureKey.startsWith("home_goals_for")));
    assert.ok(v4.quality.kind === "DATA_QUALITY_REPORT");
    assert.ok(FOOTBALL_ACQUISITION_MARKET_CATALOG.length >= 10);
    const stats = cataloguedStatPlaceholders();
    assert.ok(stats.some((s) => s.capability === "corners"));
    assert.throws(() => assertStatUsableInStrict(stats[0]!));
  });

  it("challenger signals never ROBUST without gates; no auto-promote", () => {
    const s = classifyChallengerSignal({
      absGap: 0.08,
      sampleSize: 50,
      adjustedPValue: 0.01,
      walkForwardPassed: true,
      holdoutPassed: true,
      calibrationOk: true,
    });
    assert.equal(s.level, "WEAK");
    assert.throws(() => assertNoAutoChampionPromotion("auto_promote"));
  });

  it("correlation clusters + explainDecision insufficient evidence", () => {
    const clusters = buildCorrelationClusters([
      { eventId: "e1", market: "result", selection: "HOME", stake: 5 },
      { eventId: "e1", market: "total_goals", selection: "OVER", stake: 5 },
      { eventId: "e1", market: "both_teams_to_score", selection: "YES", stake: 5 },
    ]);
    assert.ok(maxClusterExposure(clusters) >= 15);
    const ex = explainDecision({
      eventId: "e1",
      asOf: new Date(),
      factors: [
        {
          feature: "low_sample",
          value: 3,
          asOf: new Date().toISOString(),
          source: null,
          contribution: "quality_warning",
          quality: "WEAK",
        },
      ],
      blocking: ["temporal_precision_UNKNOWN_blocks_STRICT_AS_OF"],
    });
    assert.equal(ex.summary, "INSUFFICIENT_EVIDENCE");
    assert.equal(
      classifyLabError({ predicted: "HOME", actual: "AWAY" }).error_class,
      "ERROR_MODEL",
    );
  });

  it("top10 does not pad; leakage blocked", () => {
    const top = findTop10V2([], { limit: 10 });
    assert.equal(top.message, "NO_QUALIFIED_OPPORTUNITY");
    const event = dataset.events[5]!;
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
    });
    assert.throws(() =>
      assertDecisionContextSafe({
        ...sample.decisionContext,
        availableFeatures: [
          {
            featureKey: "future",
            value: 1,
            availableAt: new Date(asOf.getTime() + 86400000),
            temporalPrecision: "exact",
            featureStatus: "VALID",
          },
        ],
      }),
    );
  });

  it("Blind Market Lab end-to-end: MODEL_READY may be 0; real_money false", () => {
    const lab = runBlindMarketLabV1();
    assert.equal(lab.experiment.experiment_id, "exp_013_blind_market_lab_v1");
    assert.equal(lab.providerLive.provider_status, "BLOCKED");
    assert.ok(lab.data.events >= 40);
    assert.equal(lab.markets.model_ready, 0);
    assert.equal(lab.risk.real_money, false);
    assert.equal(lab.risk.actuarial_winner, null);
    assert.ok(lab.models.challengers.every((c) => c.auto_promote === false));
    assert.ok(lab.multipleTesting.hypotheses >= 1);
    assert.ok(lab.insufficient_data === true || lab.dataQuality.blocking_reasons.length > 0);
  });
});
