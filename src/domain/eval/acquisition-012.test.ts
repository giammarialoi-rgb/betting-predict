import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOOTBALL_DATA_CO_UK_LIVE_STATUS } from "@/domain/sources/provider-status";
import {
  buildMarketCoverageMatrix,
  summarizeCoverage,
  buildBookmakerCoverageFromQuotes,
} from "@/domain/markets/coverage-matrix";
import { BOOKMAKER_REGISTRY } from "@/domain/markets/bookmaker-registry";
import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";
import {
  clubEloAsOf,
  assertClubEloNotAfterAsOf,
  provenanceForClubEloDate,
} from "@/domain/features/clubelo-asof";
import {
  computeLaggedGoalRates,
  estimatePoissonRatesFromHistory,
} from "@/domain/features/goal-rates";
import { deriveMarketsFromPoisson } from "@/domain/markets/derived-markets";
import {
  evaluateModelReadyGates,
  selectFirstModelReady,
} from "@/domain/markets/model-ready-gates";
import { MarketEngineV2 } from "@/domain/markets/market-engine-v2";
import { deVig, deVigShin } from "@/domain/markets/consensus-engine";
import { triangulateFact } from "@/domain/cross-source/triangulation";
import { findTop10V2 } from "@/domain/eval/top10-v2";
import type { RankedOpportunity } from "@/domain/eval/top-opportunities";
import { buildWhyTreeV2 } from "@/domain/eval/why-v2";
import {
  assertInformationNotAfterAsOf,
  filterInformationAsOf,
  assertWeatherForecastAsOf,
} from "@/domain/info/contracts";
import {
  runBankrollReplay,
  compareBankrollStrategies,
  computeHypotheticalStake,
  kellyFraction,
} from "@/domain/risk/engine";
import { classifyPredictionError } from "@/domain/eval/error-classes";
import { assertNoAutoChampionPromotion } from "@/domain/eval/challenger";
import { rocAuc } from "@/domain/eval/roc-auc";
import { runExperiment012 } from "@/domain/eval/experiment-012";
import { assertTemporalPrecision } from "@/domain/odds/temporal";
import { assertDecisionContextSafe } from "@/domain/eval/blind-replay";
import {
  buildRealHistoricalEvaluationSample,
  decisionAsOfForEvent,
} from "@/domain/eval/real-lab/truth-lab";
import type { HistoricalMatch } from "@/domain/features/types";

describe("TASK 012 multi-market acquisition", () => {
  const dataset = loadRealTruthLabPack();

  it("records football-data.co.uk BLOCKED on HTTP 503 (no bypass)", () => {
    assert.equal(FOOTBALL_DATA_CO_UK_LIVE_STATUS.provider_status, "BLOCKED");
    assert.equal(FOOTBALL_DATA_CO_UK_LIVE_STATUS.reason, "HTTP_503");
    assert.equal(FOOTBALL_DATA_CO_UK_LIVE_STATUS.http_status, 503);
  });

  it("builds real coverage matrix with catalogued vs observed", () => {
    const rows = buildMarketCoverageMatrix({
      quotes: dataset.quotes.map((q) => ({
        eventId: q.eventId,
        marketType: q.observation.marketType,
        line: q.observation.line,
        selection: q.observation.selection,
        bookmakerSlug: q.bookmakerSlug,
        sourceId: q.sourceId,
        availableAt: q.availableAt,
        temporalPrecision: q.temporalPrecision,
      })),
    });
    const summary = summarizeCoverage(rows);
    assert.ok(summary.observed > 0);
    assert.ok(summary.catalogued > 0);
    assert.equal(summary.model_ready, 0);
    assert.ok(rows.some((r) => r.market === "result" && r.status === "OBSERVED"));
    assert.ok(
      rows.some(
        (r) => r.market === "both_teams_to_score" && r.status === "CATALOGUED",
      ),
    );
  });

  it("bookmaker coverage measures observed vs registry; Max/Avg excluded", () => {
    const rows = buildBookmakerCoverageFromQuotes({
      quotes: dataset.quotes.map((q) => ({
        bookmakerSlug: q.bookmakerSlug,
        marketType: q.observation.marketType,
        temporalPrecision: q.temporalPrecision,
      })),
      registrySlugs: BOOKMAKER_REGISTRY.map((b) => b.slug),
    });
    assert.ok(rows.some((r) => r.bookmaker === "bet365" && r.status === "VERIFIED"));
    assert.ok(rows.some((r) => r.status === "UNKNOWN"));
    assert.ok(!rows.some((r) => r.bookmaker.toLowerCase().startsWith("max")));
  });

  it("ClubElo asOf path rejects future ratings", () => {
    const asOf = new Date("2023-06-01T00:00:00.000Z");
    const cell = clubEloAsOf({
      teamId: "liverpool",
      asOf,
      observations: [
        {
          teamId: "liverpool",
          rating: 1900,
          ratingDate: new Date("2023-01-01T00:00:00.000Z"),
          availableAt: new Date("2023-01-01T00:00:00.000Z"),
          provenance: "official_clubelo",
        },
        {
          teamId: "liverpool",
          rating: 2000,
          ratingDate: new Date("2023-09-01T00:00:00.000Z"),
          availableAt: new Date("2023-09-01T00:00:00.000Z"),
          provenance: "official_clubelo",
        },
      ],
    });
    assert.equal(cell.value, 1900);
    assert.throws(() =>
      assertClubEloNotAfterAsOf(new Date("2023-09-01"), asOf),
    );
    assert.equal(provenanceForClubEloDate("2025-07-01"), "provisional_blocked");
  });

  it("lagged goal rates + Poisson derived markets (not MODEL_READY)", () => {
    const history: HistoricalMatch[] = dataset.events.map((e) => ({
      matchId: e.eventId,
      competitionId: e.competitionId,
      kickoffAt: e.scheduledStartAt,
      resultAvailableAt: e.resultAvailableAt,
      homeTeamId: e.homeTeamId,
      awayTeamId: e.awayTeamId,
      ftHome: e.homeScore,
      ftAway: e.awayScore,
      ftResult:
        e.resultCode === "HOME" ? "H" : e.resultCode === "AWAY" ? "A" : "D",
    }));
    const event = dataset.events[30]!;
    const asOf = decisionAsOfForEvent(event);
    const rates = computeLaggedGoalRates({
      history,
      teamId: event.homeTeamId,
      asOf,
      excludeMatchId: event.eventId,
      window: 5,
    });
    assert.ok(rates.status === "RECONSTRUCTED_STRICT" || rates.status === "MISSING");
    const est = estimatePoissonRatesFromHistory({
      history,
      homeTeamId: event.homeTeamId,
      awayTeamId: event.awayTeamId,
      asOf,
      excludeMatchId: event.eventId,
    });
    const derived = deriveMarketsFromPoisson({
      homeLambda: est.homeLambda,
      awayLambda: est.awayLambda,
    });
    assert.ok(derived.some((d) => d.market === "total_goals" && d.line === 2.5));
    assert.ok(derived.some((d) => d.market === "both_teams_to_score"));
    assert.ok(derived.every((d) => d.model_ready === false));
  });

  it("MODEL_READY gates may correctly yield 0", () => {
    const r = evaluateModelReadyGates({
      market: "result",
      line: null,
      sampleSize: 61,
      dataCompleteness: 0.85,
      temporalIntegrity: true,
      exactPrecisionShare: 0,
      bookmakerCoverage: 3,
      outcomeCompleteness: 1,
      featureAvailability: 0.8,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    });
    assert.equal(r.status, "NOT_READY");
    assert.ok(r.failedGates.includes("exact_precision_share"));
    assert.equal(selectFirstModelReady([r]), null);
  });

  it("market engine V2 consensus / model-vs-market / validated_edge false", () => {
    const eng = new MarketEngineV2();
    const c = eng.consensus([
      { bookmakerSlug: "bet365", oddsDecimal: 1.9 },
      { bookmakerSlug: "pinnacle", oddsDecimal: 2.05 },
    ]);
    assert.ok(c.dispersion !== null);
    const cmp = eng.compare({
      modelProbability: 0.5,
      marketOdds: 2.0,
      marketOddsList: [2.0, 3.5, 4.0],
      selectionIndex: 0,
    });
    assert.equal(cmp.validated_edge, false);
    assert.ok(cmp.P_market_devig !== null);
  });

  it("Shin and Power de-vig COMPUTED when sum≈1; odds_ratio stays NOT_IMPLEMENTED", () => {
    const shin = deVigShin([2.1, 3.4, 3.6]);
    assert.equal(shin.status, "COMPUTED");
    const sum = shin.output_probabilities.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
    const power = deVig([2.1, 3.4, 3.6], "power");
    assert.equal(power.status, "COMPUTED");
    const oddsRatio = deVig([2.1, 3.4, 3.6], "odds_ratio");
    assert.equal(oddsRatio.status, "NOT_IMPLEMENTED");
  });

  it("triangulation preserves conflicts; no majority vote", () => {
    const t = triangulateFact([
      {
        sourceId: "a",
        value: { home: 2 },
        availableAt: new Date("2024-01-01"),
        temporalPrecision: "unknown",
        authority: "secondary",
        completeness: "full",
      },
      {
        sourceId: "b",
        value: { home: 1 },
        availableAt: new Date("2024-01-01"),
        temporalPrecision: "exact",
        authority: "primary",
        completeness: "partial",
      },
    ]);
    assert.equal(t.selectionReason, "prefer_exact_temporal");
    assert.deepEqual(t.canonical, { home: 1 });
    assert.equal(t.conflicts.length, 1);
  });

  it("top10 V2 does not pad; can return NO_QUALIFIED_OPPORTUNITY", () => {
    const weak: RankedOpportunity[] = [
      {
        eventId: "e1",
        sport: "football",
        market: "result",
        line: null,
        selection: "HOME",
        odds: 2.0,
        model_probability: 0.4,
        market_probability: 0.4,
        scores: {
          data_quality: 0.1,
          model_confidence: null,
          market_agreement: null,
          uncertainty: 0.9,
          edge_raw: 0,
          edge_level: "NO_SIGNAL",
        },
        why: null,
        explanation: null,
        confidence: null,
        bet_recommendation: null,
      },
    ];
    const none = findTop10V2(weak, { limit: 10, minQuality: 0.4 });
    assert.equal(none.message, "NO_QUALIFIED_OPPORTUNITY");
    assert.equal(none.qualified.length, 0);
    assert.equal(none.insufficient_evidence, 10);

    const strong: RankedOpportunity[] = Array.from({ length: 3 }, (_, i) => ({
      ...weak[0]!,
      eventId: `e${i}`,
      scores: {
        ...weak[0]!.scores,
        data_quality: 0.8,
        edge_raw: 0.08,
        edge_level: "RESEARCH_SIGNAL" as const,
      },
      model_probability: 0.55,
      market_probability: 0.45,
    }));
    const partial = findTop10V2(strong, { limit: 10 });
    assert.equal(partial.message, "PARTIAL_QUALIFIED");
    assert.equal(partial.qualified.length, 3);
    assert.equal(partial.insufficient_evidence, 7);
  });

  it("WHY V2 hierarchical + info/weather temporal firewall", () => {
    const tree = buildWhyTreeV2({
      eventId: "e1",
      asOf: new Date(),
      factors: [
        {
          feature: "form_5",
          value: 10,
          asOf: new Date().toISOString(),
          source: "lab",
          contribution: "supporting",
          quality: "VALID",
        },
        {
          feature: "market_disagreement",
          value: 0.1,
          asOf: new Date().toISOString(),
          source: "lab",
          contribution: "supporting",
          quality: "unknown",
        },
        {
          feature: "player_missing",
          value: null,
          asOf: new Date().toISOString(),
          source: null,
          contribution: "quality_warning",
          quality: "MISSING",
        },
      ],
    });
    assert.ok(tree.MODEL.form.length === 1);
    assert.ok(tree.MARKET.disagreement.length === 1);

    const asOf = new Date("2024-01-01T18:00:00.000Z");
    assert.throws(() =>
      assertInformationNotAfterAsOf(
        {
          information_type: "INJURY",
          subject: "Player X",
          published_at: new Date("2024-01-01T18:32:00.000Z"),
          available_at: new Date("2024-01-01T18:32:00.000Z"),
          source: "news",
          confidence: null,
        },
        asOf,
      ),
    );
    const ok = filterInformationAsOf(
      [
        {
          information_type: "NEWS",
          subject: "t",
          published_at: new Date("2024-01-01T17:00:00.000Z"),
          available_at: new Date("2024-01-01T17:00:00.000Z"),
          source: "news",
          confidence: null,
        },
      ],
      asOf,
    );
    assert.equal(ok.length, 1);
    assert.throws(() =>
      assertWeatherForecastAsOf(
        {
          temperature: 10,
          precipitation: null,
          wind: null,
          humidity: null,
          weather_condition: null,
          forecast_available_at: new Date("2024-01-01T19:00:00.000Z"),
          event_time: new Date("2024-01-01T20:00:00.000Z"),
        },
        asOf,
      ),
    );
  });

  it("blind bankroll replay + actuarial comparison without declaring winner", () => {
    assert.ok(kellyFraction(0.55, 2.0) > 0);
    const stake = computeHypotheticalStake({
      strategy: "fractional_kelly",
      bankroll: 1000,
      probability: 0.55,
      odds: 2.1,
    });
    assert.equal(stake.real_money, false);

    const decisions = [
      {
        asOf: "2023-01-01",
        modelProbability: 0.55,
        odds: 2.0,
        selection: "HOME",
        won: true,
      },
      {
        asOf: "2023-01-02",
        modelProbability: 0.4,
        odds: 2.5,
        selection: "HOME",
        won: false,
      },
      {
        asOf: "2023-01-03",
        modelProbability: 0.5,
        odds: 2.2,
        selection: "HOME",
        won: true,
      },
    ];
    const flat = runBankrollReplay({
      strategy: "flat",
      startingBankroll: 1000,
      decisions,
    });
    const kelly = runBankrollReplay({
      strategy: "fractional_kelly",
      startingBankroll: 1000,
      decisions,
    });
    const cmp = compareBankrollStrategies([flat, kelly]);
    assert.equal(cmp.winner, null);
    assert.equal(flat.declared_best, false);
  });

  it("error classes + no auto promote + ROC-AUC + temporal unknown≠exact", () => {
    const err = classifyPredictionError({
      prediction: { HOME: 0.6, DRAW: 0.2, AWAY: 0.2 },
      actual: "AWAY",
    });
    assert.equal(err.error_class, "MODEL_ERROR");
    assert.equal(
      classifyPredictionError({
        prediction: { HOME: 0.5 },
        actual: "HOME",
        temporalViolation: true,
      }).error_class,
      "TEMPORAL_ERROR",
    );
    assert.throws(() => assertNoAutoChampionPromotion("auto_promote"));
    const auc = rocAuc([
      { yTrue: 1, yPred: 0.9 },
      { yTrue: 1, yPred: 0.8 },
      { yTrue: 0, yPred: 0.2 },
      { yTrue: 0, yPred: 0.3 },
    ]);
    assert.ok(auc !== null && auc > 0.9);
    assert.throws(() => assertTemporalPrecision("unknown", "exact"));
  });

  it("leakage: future feature / post-event blocked", () => {
    const event = dataset.events[10]!;
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
            featureKey: "future_stat",
            value: 1,
            availableAt: new Date(asOf.getTime() + 86400000),
            temporalPrecision: "exact",
            featureStatus: "VALID",
          },
        ],
      }),
    );
  });

  it("experiment 012 runs end-to-end with MODEL_READY possibly 0", () => {
    const result = runExperiment012();
    assert.equal(result.experiment.experiment_id, "exp_012_multi_market_acquisition");
    assert.equal(result.providerStatus.provider_status, "BLOCKED");
    assert.ok(result.events >= 40);
    assert.equal(result.modelReadyCount, 0);
    assert.equal(result.bankroll.winner, null);
    assert.ok(result.coverageSummary.observed > 0);
  });
});
