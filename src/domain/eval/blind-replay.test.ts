import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionContextSafe,
  DecisionContextSafetyError,
  loadOutcomeForEvaluation,
  runBlindReplay,
  type BlindReplayFeatureProvider,
  type BlindReplayMarketProvider,
  type BlindReplayOutcomeProvider,
} from "@/domain/eval/blind-replay";
import {
  buildEvaluationSample,
  assertNoOutcomeLeakIntoDecision,
  type DecisionContext,
  type OutcomeContext,
} from "@/domain/eval/contexts";
import {
  assertNotRandomTemporalSplit,
  buildWalkForwardFolds,
} from "@/domain/eval/walk-forward";
import { reconstructFormFromOutcomes, matchesWithLateAvailability } from "@/domain/features/form-persistable";
import { computeFormPoints } from "@/domain/features/form";
import type { HistoricalMatch } from "@/domain/features/types";
import { getFeatureLineage } from "@/domain/features/lineage";

describe("TASK 008 blind replay foundation", () => {
  const T1 = new Date("2024-01-01T12:00:00.000Z");
  const T2 = new Date("2024-01-10T12:00:00.000Z");
  const T3 = new Date("2024-01-20T17:30:00.000Z");
  const T4 = new Date("2024-01-20T19:30:00.000Z");

  const event = {
    eventId: "evt-final",
    sportId: "football",
    homeTeamId: "team-a",
    awayTeamId: "team-b",
    scheduledStartAt: T3,
  };

  const eloFeatures: BlindReplayFeatureProvider = {
    listFeaturesForEvent(_eventId, asOf) {
      const rows = [
        {
          eventId: event.eventId,
          featureKey: "home_elo",
          value: 1500,
          availableAt: T1,
          temporalPrecision: "dataset_window",
          featureStatus: "VALID",
          source: "clubelo",
        },
        {
          eventId: event.eventId,
          featureKey: "home_elo",
          value: 1510,
          availableAt: T2,
          temporalPrecision: "dataset_window",
          featureStatus: "VALID",
          source: "clubelo",
        },
        {
          eventId: event.eventId,
          featureKey: "future_elo",
          value: 1600,
          availableAt: T4,
          temporalPrecision: "dataset_window",
          featureStatus: "VALID",
          source: "clubelo",
        },
        {
          eventId: event.eventId,
          featureKey: "cluster_c_star",
          value: 0.5,
          availableAt: T1,
          temporalPrecision: "unknown",
          featureStatus: "FORBIDDEN",
          source: "benchmark",
        },
      ];
      // Provider returns all rows; replay filters by asOf
      return rows.filter(
        (r) => !r.availableAt || r.availableAt.getTime() <= asOf.getTime() || r.featureKey === "future_elo",
      );
    },
  };

  // Fix provider: return all candidate rows; filtering is replay's job
  const featureProvider: BlindReplayFeatureProvider = {
    listFeaturesForEvent() {
      return [
        {
          eventId: event.eventId,
          featureKey: "home_elo",
          value: 1500,
          availableAt: T1,
          temporalPrecision: "dataset_window",
          featureStatus: "VALID",
          source: "clubelo",
        },
        {
          eventId: event.eventId,
          featureKey: "home_elo_v2",
          value: 1510,
          availableAt: T2,
          temporalPrecision: "dataset_window",
          featureStatus: "VALID",
          source: "clubelo",
        },
        {
          eventId: event.eventId,
          featureKey: "future_elo",
          value: 1600,
          availableAt: T4,
          temporalPrecision: "dataset_window",
          featureStatus: "VALID",
          source: "clubelo",
        },
        {
          eventId: event.eventId,
          featureKey: "form_5_overall",
          value: 9,
          availableAt: T2,
          temporalPrecision: "exact",
          featureStatus: "VALID",
          source: "reconstructed",
        },
        {
          eventId: event.eventId,
          featureKey: "future_form",
          value: 12,
          availableAt: T4,
          temporalPrecision: "exact",
          featureStatus: "VALID",
          source: "reconstructed",
        },
        {
          eventId: event.eventId,
          featureKey: "cluster_c_star",
          value: 0.5,
          availableAt: T1,
          temporalPrecision: "unknown",
          featureStatus: "FORBIDDEN",
          source: "benchmark",
        },
        {
          eventId: event.eventId,
          featureKey: "unknown_pack_odds_feature",
          value: 1.9,
          availableAt: T2,
          temporalPrecision: "unknown",
          featureStatus: "TEMPORAL_UNKNOWN",
          source: "pack",
        },
      ];
    },
  };

  const marketProvider: BlindReplayMarketProvider = {
    listMarketsForEvent() {
      return [
        {
          eventId: event.eventId,
          marketType: "result",
          selectionSide: "HOME",
          line: null,
          bookmakerSlug: "bet365",
          oddsDecimal: 1.9,
          availableAt: T2,
          temporalPrecision: "exact",
          observationKind: "exact_tick",
        },
        {
          eventId: event.eventId,
          marketType: "result",
          selectionSide: "HOME",
          line: null,
          bookmakerSlug: "bet365",
          oddsDecimal: 1.85,
          availableAt: T4,
          temporalPrecision: "exact",
          observationKind: "exact_tick",
        },
        {
          eventId: event.eventId,
          marketType: "total_goals",
          selectionSide: "OVER",
          line: "2.5",
          bookmakerSlug: "bet365",
          oddsDecimal: 1.95,
          availableAt: T2,
          temporalPrecision: "unknown",
          observationKind: "dataset_open",
        },
        {
          eventId: event.eventId,
          marketType: "result",
          selectionSide: "HOME",
          line: null,
          bookmakerSlug: "bet365",
          oddsDecimal: 1.8,
          availableAt: T3,
          temporalPrecision: "exact",
          observationKind: "closing",
        },
      ];
    },
  };

  const outcomeProvider: BlindReplayOutcomeProvider = {
    getOutcome(eventId) {
      if (eventId !== event.eventId) return null;
      return {
        kind: "outcome",
        eventId,
        homeScore: 2,
        awayScore: 1,
        resultCode: "HOME",
        availableAt: T4,
        observedAt: T4,
      } satisfies OutcomeContext;
    },
  };

  it("AS_OF T1 sees Elo 1500 only", () => {
    const ctx = runBlindReplay({
      event,
      asOf: T1,
      asOfPolicy: "RESEARCH",
      featureProvider,
      marketProvider,
    });
    assert.equal(ctx.kind, "decision");
    const elo = ctx.availableFeatures.filter((f) => f.featureKey === "home_elo");
    assert.equal(elo.length, 1);
    assert.equal(elo[0]?.value, 1500);
    assert.equal(
      ctx.availableFeatures.some((f) => f.featureKey === "home_elo_v2"),
      false,
    );
  });

  it("AS_OF T2 sees Elo 1510 update and prematch odds", () => {
    const ctx = runBlindReplay({
      event,
      asOf: T2,
      asOfPolicy: "RESEARCH",
      featureProvider,
      marketProvider,
    });
    assert.ok(ctx.availableFeatures.some((f) => f.featureKey === "home_elo_v2" && f.value === 1510));
    assert.ok(ctx.availableMarkets.some((m) => m.oddsDecimal === 1.9));
    assert.equal(
      ctx.availableFeatures.some((f) => f.featureKey === "future_elo"),
      false,
    );
  });

  it("AS_OF T3 does not see T4 outcome or future features/odds", () => {
    const ctx = runBlindReplay({
      event,
      asOf: T3,
      asOfPolicy: "RESEARCH",
      featureProvider,
      marketProvider,
    });
    assert.equal(
      ctx.availableFeatures.some((f) => f.featureKey === "future_elo"),
      false,
    );
    assert.equal(
      ctx.availableFeatures.some((f) => f.featureKey === "future_form"),
      false,
    );
    assert.equal(
      ctx.availableMarkets.some((m) => m.availableAt.getTime() > T3.getTime()),
      false,
    );
    // Outcome must not be in decision context
    assert.equal("outcome" in ctx, false);
    const outcome = loadOutcomeForEvaluation(outcomeProvider, event.eventId);
    assert.ok(outcome);
    assert.equal(outcome.resultCode, "HOME");
  });

  it("STRICT_AS_OF rejects unknown precision markets and forbidden features", () => {
    const ctx = runBlindReplay({
      event,
      asOf: T2,
      asOfPolicy: "STRICT_AS_OF",
      featureProvider,
      marketProvider,
    });
    assert.equal(
      ctx.availableFeatures.some((f) => f.featureStatus === "FORBIDDEN"),
      false,
    );
    assert.equal(
      ctx.availableMarkets.some((m) => m.temporalPrecision === "unknown"),
      false,
    );
    assert.equal(
      ctx.availableFeatures.some((f) => f.featureStatus === "TEMPORAL_UNKNOWN"),
      false,
    );
  });

  it("DecisionContext ≠ OutcomeContext and evaluation sample keeps them separate", () => {
    const decision = runBlindReplay({
      event,
      asOf: T3,
      asOfPolicy: "RESEARCH",
      featureProvider,
      marketProvider,
    });
    const outcome = loadOutcomeForEvaluation(outcomeProvider, event.eventId);
    const sample = buildEvaluationSample(decision, outcome);
    assert.equal(sample.decision.kind, "decision");
    assert.equal(sample.outcome?.kind, "outcome");
    assertNoOutcomeLeakIntoDecision(sample.decision);
  });

  it("assertDecisionContextSafe fails on future available_at", () => {
    const bad: DecisionContext = {
      kind: "decision",
      eventId: "e",
      sportId: "football",
      asOf: T1,
      asOfPolicy: "STRICT_AS_OF",
      availableFeatures: [
        {
          featureKey: "x",
          value: 1,
          availableAt: T2,
          temporalPrecision: "exact",
          featureStatus: "VALID",
        },
      ],
      featureStatuses: { x: "VALID" },
      availableMarkets: [],
      marketSnapshots: [],
      dataQuality: {
        featurePresent: 1,
        featureMissing: 0,
        featureForbidden: 0,
        marketCount: 0,
      },
      temporalWarnings: [],
      modelProbability: null,
      uncertainty: null,
      edge: null,
      confidence: null,
      riskState: null,
    };
    assert.throws(() => assertDecisionContextSafe(bad), DecisionContextSafetyError);
  });

  it("what-would-we-have-known gate: future feature insertion fails safety", () => {
    const ctx = runBlindReplay({
      event,
      asOf: T3,
      asOfPolicy: "STRICT_AS_OF",
      featureProvider,
      marketProvider,
    });
    const leaked: DecisionContext = {
      ...ctx,
      availableFeatures: [
        ...ctx.availableFeatures.filter((f) => f.featureStatus !== "FORBIDDEN"),
        {
          featureKey: "smuggled_future",
          value: 99,
          availableAt: T4,
          temporalPrecision: "exact",
          featureStatus: "VALID",
        },
      ],
    };
    assert.throws(
      () => assertDecisionContextSafe(leaked),
      /available_at after asOf/,
    );
  });

  it("blind replay is deterministic for same inputs", () => {
    const a = runBlindReplay({
      event,
      asOf: T2,
      asOfPolicy: "STRICT_AS_OF",
      featureProvider,
      marketProvider,
    });
    const b = runBlindReplay({
      event,
      asOf: T2,
      asOfPolicy: "STRICT_AS_OF",
      featureProvider,
      marketProvider,
    });
    assert.equal(JSON.stringify(a.availableFeatures), JSON.stringify(b.availableFeatures));
    assert.equal(JSON.stringify(a.availableMarkets), JSON.stringify(b.availableMarkets));
  });

  it("form uses available_at not kickoff alone", () => {
    const history: HistoricalMatch[] = [
      {
        matchId: "early",
        competitionId: "E0",
        homeTeamId: "team-a",
        awayTeamId: "x",
        ftHome: 1,
        ftAway: 0,
        ftResult: "H",
        kickoffAt: new Date("2024-01-05T15:00:00.000Z"),
        // Result published late — after decision asOf T2
        resultAvailableAt: new Date("2024-01-12T12:00:00.000Z"),
      },
      {
        matchId: "ok",
        competitionId: "E0",
        homeTeamId: "team-a",
        awayTeamId: "y",
        ftHome: 2,
        ftAway: 0,
        ftResult: "H",
        kickoffAt: new Date("2024-01-08T15:00:00.000Z"),
        resultAvailableAt: new Date("2024-01-08T17:00:00.000Z"),
      },
    ];
    const late = matchesWithLateAvailability({
      history,
      asOf: T2,
      decisionKickoff: T3,
    });
    assert.equal(late.length, 1);
    assert.equal(late[0]?.matchId, "early");

    const form = computeFormPoints({
      teamId: "team-a",
      asOf: T2,
      window: 5,
      excludeMatchId: event.eventId,
      history,
    });
    // Only "ok" match (3 points) — late-available "early" excluded
    assert.equal(form.value, 3);

    const insufficient = reconstructFormFromOutcomes({
      teamId: "team-a",
      decisionEventId: event.eventId,
      asOf: T2,
      window: 5,
      history,
    });
    assert.equal(insufficient.status, "MISSING");
    assert.equal(insufficient.value, null);
    assert.ok(insufficient.notes?.includes("INSUFFICIENT_HISTORY"));
  });

  it("feature lineage declares form_5 temporal rules", () => {
    const lineage = getFeatureLineage("form_5_overall");
    assert.ok(lineage);
    assert.equal(lineage.lookback, 5);
    assert.ok(lineage.forbiddenConditions.some((c) => c.includes("kickoff")));
  });

  it("walk-forward contract ready; random split rejected", () => {
    assert.throws(() => assertNotRandomTemporalSplit("random"));
    const folds = buildWalkForwardFolds({
      timelineStart: new Date("2020-01-01"),
      timelineEnd: new Date("2021-06-01"),
      trainDays: 90,
      validationDays: 30,
      testDays: 30,
      stepDays: 30,
    });
    assert.ok(folds.length > 0);
  });

  // silence unused
  void eloFeatures;
});
