import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalMarketKey,
  assertNotAggregateAsBookmaker,
  isAggregateOddsLabel,
} from "@/domain/markets/canonical";
import {
  BOOKMAKER_REGISTRY,
  assertBookmakerNotAggregate,
  listVerifiedBookmakers,
} from "@/domain/markets/bookmaker-registry";
import {
  listMarketCoverage,
  listProviderCoverage,
} from "@/domain/markets/coverage-registry";
import {
  analyzeCrossBookmaker,
  deVig,
  deVigProportional,
  buildBookConsensus,
} from "@/domain/markets/consensus-engine";
import { MarketMicrostructureEngine } from "@/domain/markets/microstructure-engine";
import {
  assertNoInventedCorrelation,
  relatedMarkets,
} from "@/domain/markets/correlation-registry";
import { MarketDiscoveryEngine } from "@/domain/markets/discovery-engine";
import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";
import {
  decisionAsOfForEvent,
  buildRealHistoricalEvaluationSample,
} from "@/domain/eval/real-lab/truth-lab";
import { assertDecisionContextSafe } from "@/domain/eval/blind-replay";
import {
  runBlindResearchV2,
  revealBlindResearchV2,
} from "@/domain/eval/blind-research-v2";
import { classifyEdge } from "@/domain/eval/edge-levels";
import {
  poissonBaseline,
  marketImpliedBaseline,
  frequencyBaseline,
  homeBaseline,
  eloBaseline,
  formBaseline,
} from "@/domain/eval/multi-market-baselines";
import { futureGoalModelStatus } from "@/domain/eval/poisson-baseline";
import { findTopOpportunities } from "@/domain/eval/top-opportunities";
import { buildWhyExplanation } from "@/domain/eval/why-explanation";
import {
  assertNoAutoChampionPromotion,
  canPromoteChallenger,
} from "@/domain/eval/challenger";
import {
  assertNotDefinitiveStaking,
  assertStakeUnknownAtDecision,
  createRiskEngineStub,
  createStakeCalculatorStub,
} from "@/domain/risk/interfaces";
import {
  assertScrapingDenied,
  scrapingAllowedForSource,
} from "@/domain/sources/scraping-policy";
import { getSource } from "@/domain/sources/catalog";
import { assertTemporalPrecision } from "@/domain/odds/temporal";
import { buildFeatureEngineV3 } from "@/domain/features/engine-v3";
import { quotesAsOf } from "@/domain/markets/discovery-engine";

describe("TASK 011 multi-market data engine", () => {
  const dataset = loadRealTruthLabPack();

  it("A/B/C: market-agnostic canonical key + multi-market representation", () => {
    assert.equal(
      canonicalMarketKey({
        sport: "football",
        marketType: "total_goals",
        period: "FT",
        line: 2.5,
        selection: "OVER",
      }),
      "football|total_goals|FT|2.5|OVER|||",
    );
    assert.equal(
      canonicalMarketKey({
        sport: "football",
        marketType: "result",
        period: "FT",
        line: null,
        selection: "HOME",
      }),
      "football|result|FT||HOME|||",
    );
    assert.ok(BOOKMAKER_REGISTRY.length >= 20);
    assert.ok(listVerifiedBookmakers().length >= 3);
  });

  it("D/E: cross-bookmaker consensus / disagreement / movement / de-vig", () => {
    const cross = analyzeCrossBookmaker({
      marketType: "result",
      line: null,
      selection: "HOME",
      quotes: [
        { bookmakerSlug: "bet365", oddsDecimal: 1.9 },
        { bookmakerSlug: "pinnacle", oddsDecimal: 2.0 },
        { bookmakerSlug: "william-hill", oddsDecimal: 1.95 },
      ],
    });
    assert.equal(cross.number_of_bookmakers, 3);
    assert.ok(cross.disagreement !== null);
    assert.ok(cross.consensus_probability !== null);

    const d = deVigProportional([2.0, 3.4, 4.0]);
    assert.equal(d.method, "proportional");
    assert.equal(d.status, "COMPUTED");
    assert.ok(Math.abs(d.output_probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.equal(deVig([2, 3.5], "shin").status, "COMPUTED");
    assert.equal(deVig([2, 3.5], "power").status, "COMPUTED");
    assert.equal(deVig([2, 3.5], "odds_ratio").status, "NOT_IMPLEMENTED");

    const consensus = buildBookConsensus({
      bookmakerSlug: "bet365",
      selections: ["HOME", "DRAW", "AWAY"],
      odds: [2.0, 3.4, 4.0],
    });
    assert.ok(consensus.overround > 1);

    const micro = new MarketMicrostructureEngine().analyze({
      observations: [
        {
          bookmakerSlug: "bet365",
          oddsDecimal: 2.1,
          availableAt: new Date("2023-01-01T10:00:00.000Z"),
          temporalPrecision: "exact",
          observationKind: "exact_tick",
        },
        {
          bookmakerSlug: "bet365",
          oddsDecimal: 2.0,
          availableAt: new Date("2023-01-01T14:00:00.000Z"),
          temporalPrecision: "exact",
          observationKind: "exact_tick",
        },
      ],
      asOf: new Date("2023-01-01T15:00:00.000Z"),
      scheduledStartAt: new Date("2023-01-01T16:00:00.000Z"),
      requireExactPrecision: true,
    });
    assert.ok(micro.delta_odds !== null);
    assert.equal(micro.closing, null);
  });

  it("F/G: temporal firewall + blind research v2", () => {
    const event = dataset.events[15]!;
    const asOf = decisionAsOfForEvent(event);
    const sample = buildRealHistoricalEvaluationSample({
      eventId: event.eventId,
      asOf,
      dataset,
      includeOutcome: false,
    });
    assert.equal(sample.outcomeContext, null);

    assert.throws(() =>
      assertDecisionContextSafe({
        ...sample.decisionContext,
        availableFeatures: [
          ...sample.decisionContext.availableFeatures,
          {
            featureKey: "future_lineup",
            value: 1,
            availableAt: new Date(asOf.getTime() + 3_600_000),
            temporalPrecision: "exact",
            featureStatus: "VALID",
            source: "attack",
          },
        ],
      }),
    );
    assert.throws(() =>
      assertDecisionContextSafe({
        ...sample.decisionContext,
        availableFeatures: [
          {
            featureKey: "future_injury",
            value: 1,
            availableAt: new Date(asOf.getTime() + 86_400_000),
            temporalPrecision: "exact",
            featureStatus: "VALID",
          },
        ],
      }),
    );

    const lock = runBlindResearchV2({
      event,
      dataset,
      predict: () => ({
        marketType: "result",
        probabilities: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
        modelId: "test",
        modelVersion: "v1",
      }),
    });
    assert.equal(lock.outcomeRevealed, false);
    const reveal = revealBlindResearchV2({ lock, dataset });
    assert.equal(reveal.revealAfterDecision, true);
    assert.equal(reveal.outcomeContext.resultCode, event.resultCode);
  });

  it("H/I: top-10 deterministic + WHY explainability", () => {
    const candidates = dataset.events.slice(0, 20).map((e, i) => ({
      eventId: e.eventId,
      sport: "football",
      market: "result",
      line: null as number | null,
      selection: "HOME",
      odds: 1.8 + (i % 5) * 0.1,
      model_probability: 0.4 + (i % 3) * 0.05,
      market_probability: 0.45,
      scores: {
        data_quality: 0.5 + (i % 4) * 0.1,
        model_confidence: null as number | null,
        market_agreement: 0.7,
        uncertainty: 0.2,
        edge_raw: 0.4 + (i % 3) * 0.05 - 0.45,
        edge_level: "RESEARCH_SIGNAL" as const,
      },
      why: null,
      explanation: null,
      confidence: null as null,
      bet_recommendation: null as null,
    }));
    const a = findTopOpportunities(candidates, {
      sport: "football",
      limit: 10,
      mode: "interesting",
    });
    const b = findTopOpportunities(candidates, {
      sport: "football",
      limit: 10,
      mode: "interesting",
    });
    assert.deepEqual(
      a.map((x) => x.eventId),
      b.map((x) => x.eventId),
    );
    assert.equal(a.length, 10);
    assert.ok(a.every((x) => x.bet_recommendation === null));

    const why = buildWhyExplanation({
      eventId: candidates[0]!.eventId,
      asOf: new Date(),
      factors: [
        {
          feature: "elo_differential",
          value: 40,
          availableAt: new Date(),
          source: "clubelo",
          contribution: "supporting",
          quality: "dataset_window",
        },
        {
          feature: "missing_lineup",
          value: null,
          availableAt: null,
          contribution: "quality_warning",
          quality: "MISSING",
        },
      ],
    });
    assert.ok(why.summary.includes("elo_differential"));
  });

  it("J: data quality ≠ confidence ≠ edge", () => {
    const edge = classifyEdge({
      modelProbability: 0.55,
      marketProbability: 0.45,
      sampleSize: 50,
      walkForwardPassed: false,
      holdoutPassed: false,
      calibrationOk: false,
      multipleTestingCorrected: false,
      temporalIntegrity: true,
    });
    assert.notEqual(edge.level, "VALIDATED_EDGE");
    assert.ok(edge.edge_raw > 0);

    const validatedBlocked = classifyEdge({
      modelProbability: 0.6,
      marketProbability: 0.45,
      sampleSize: 500,
      walkForwardPassed: true,
      holdoutPassed: true,
      calibrationOk: true,
      multipleTestingCorrected: true,
      temporalIntegrity: true,
    });
    assert.equal(validatedBlocked.level, "VALIDATED_EDGE");
  });

  it("K/L/M: no winning/ROI/optimal staking claims", () => {
    assert.throws(() => assertNotDefinitiveStaking("martingale"));
    assert.throws(() => assertNotDefinitiveStaking("masaniello"));
    assert.throws(() => assertNoAutoChampionPromotion("auto_promote"));
    assert.equal(
      canPromoteChallenger({
        challenger_version: "c1",
        champion_version: "ch",
        walk_forward_passed: true,
        holdout_passed: true,
        minimum_sample_met: true,
        statistical_significance: true,
        human_review: "pending",
      }),
      false,
    );
    assert.equal(createStakeCalculatorStub().calculate(), null);
    assert.equal(createRiskEngineStub().evaluate({}).risk_decision, null);
    assertStakeUnknownAtDecision(null);
  });

  it("N: post-event data rejected from DecisionContext", () => {
    const event = dataset.events[8]!;
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
            featureKey: "post_match_shots",
            value: 14,
            availableAt: new Date(event.scheduledStartAt.getTime() + 3_600_000),
            temporalPrecision: "exact",
            featureStatus: "VALID",
          },
        ],
      }),
    );
  });

  it("O: no migration — coverage registries are in-memory", () => {
    assert.ok(listProviderCoverage({ sport: "football" }).length >= 1);
    assert.ok(listMarketCoverage("football").every((m) => m.modelReady === false));
  });

  it("multi-market same event + baselines including Poisson", () => {
    const event = dataset.events[20]!;
    const quotes = dataset.quotes.filter((q) => q.eventId === event.eventId);
    const markets = new Set(quotes.map((q) => q.observation.marketType));
    assert.ok(markets.has("result"));
    const books = new Set(quotes.map((q) => q.bookmakerSlug));
    assert.ok(books.size >= 2);

    const mi = marketImpliedBaseline({
      oddsBySelection: { HOME: 2.0, DRAW: 3.4, AWAY: 4.0 },
    });
    const freq = frequencyBaseline({ counts: { HOME: 10, DRAW: 5, AWAY: 8 } });
    const home = homeBaseline();
    const elo = eloBaseline({ pHome: 0.55 });
    const form = formBaseline({ formPoints: 10 });
    const pois = poissonBaseline({
      rates: { homeLambda: 1.4, awayLambda: 1.1 },
      market: "total_goals",
      line: 2.5,
    });
    assert.ok("OVER" in pois.probabilities);
    assert.equal(futureGoalModelStatus("dixon_coles"), "PREPARED_NOT_IMPLEMENTED");
    for (const p of [mi, freq, home, elo, form, pois]) {
      const s = Object.values(p.probabilities).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(s - 1) < 1e-6);
    }
  });

  it("feature v3 + discovery + unknown≠exact + scraping deny + aggregates", () => {
    const event = dataset.events[12]!;
    const asOf = decisionAsOfForEvent(event);
    const { accepted } = quotesAsOf(dataset.quotes, event.eventId, asOf, "RESEARCH");
    const feat = buildFeatureEngineV3({
      event,
      asOf,
      dataset,
      marketQuotes: accepted,
    });
    assert.ok(feat.byCategory.player.length > 0);
    assert.ok(feat.excluded.some((e) => e.includes("not_connected")));

    const coverage = new MarketDiscoveryEngine().discoverCoverage(dataset);
    assert.ok(coverage.every((c) => c.model_ready === false));

    assert.throws(() => assertTemporalPrecision("unknown", "exact"));
    assert.equal(scrapingAllowedForSource("sofascore"), "ALLOW");
    assert.throws(() => assertScrapingDenied("bypass_cloudflare"));
    assert.throws(() => assertBookmakerNotAggregate("max"));
    assert.ok(isAggregateOddsLabel("AvgH"));
    assert.throws(() => assertNotAggregateAsBookmaker("avg"));
    assertNoInventedCorrelation(null);
    assert.ok(relatedMarkets("result").includes("total_goals"));

    assert.ok(getSource("football-data-co-uk"));
    assert.ok(getSource("club-football-match-data"));
    assert.ok(getSource("open-meteo"));
  });

  it("idempotent discovery on same pack", () => {
    const a = new MarketDiscoveryEngine().discoverCoverage(dataset);
    const b = new MarketDiscoveryEngine().discoverCoverage(loadRealTruthLabPack());
    assert.equal(a.length, b.length);
  });
});
