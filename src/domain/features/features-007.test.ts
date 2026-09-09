import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFeatureSnapshot,
  computeFormPoints,
  buildEloFeatures,
  classifyEloProvenance,
  assertNotForbiddenFeature,
  rejectPostEventStatAsPrematch,
  FeatureGateError,
  runDataQualityChecks,
  listForbiddenFeatures,
  buildPredictionExplanation,
} from "@/domain/features";
import { assertClosingNotUsedBeforeKickoff } from "@/domain/markets/microstructure";
import { assertAsOf, AsOfLeakageError } from "@/lib/as-of";
import { assertTemporalPrecision, TemporalPrecisionError } from "@/domain/odds/temporal";
import { assertResolved, resolveTeam } from "@/domain/entity/resolve";
import {
  assertClaimRequiresOos,
  survivesBonferroni,
} from "@/domain/eval/multiple-testing";
import {
  assertNoFutureInTrain,
  assertNotRandomTemporalSplit,
  buildWalkForwardFolds,
} from "@/domain/eval/walk-forward";
import { brierScore, logLoss } from "@/domain/eval/metrics";
import type { HistoricalMatch } from "@/domain/features/types";

function match(
  partial: Partial<HistoricalMatch> &
    Pick<
      HistoricalMatch,
      | "matchId"
      | "homeTeamId"
      | "awayTeamId"
      | "ftHome"
      | "ftAway"
      | "ftResult"
      | "kickoffAt"
      | "resultAvailableAt"
    >,
): HistoricalMatch {
  return {
    competitionId: "E0",
    ...partial,
  };
}

describe("feature engine + leakage suite", () => {
  const history: HistoricalMatch[] = [
    match({
      matchId: "m1",
      homeTeamId: "A",
      awayTeamId: "B",
      ftHome: 2,
      ftAway: 0,
      ftResult: "H",
      kickoffAt: new Date("2024-01-01T15:00:00.000Z"),
      resultAvailableAt: new Date("2024-01-01T17:00:00.000Z"),
    }),
    match({
      matchId: "m2",
      homeTeamId: "C",
      awayTeamId: "A",
      ftHome: 1,
      ftAway: 1,
      ftResult: "D",
      kickoffAt: new Date("2024-01-08T15:00:00.000Z"),
      resultAvailableAt: new Date("2024-01-08T17:00:00.000Z"),
    }),
    match({
      matchId: "m3",
      homeTeamId: "A",
      awayTeamId: "D",
      ftHome: 0,
      ftAway: 1,
      ftResult: "A",
      kickoffAt: new Date("2024-01-15T15:00:00.000Z"),
      resultAvailableAt: new Date("2024-01-15T17:00:00.000Z"),
    }),
  ];

  it("T1 cannot see T2 facts", () => {
    assert.throws(
      () =>
        assertAsOf(
          new Date("2024-01-08T12:00:00.000Z"),
          new Date("2024-01-08T17:00:00.000Z"),
        ),
      AsOfLeakageError,
    );
  });

  it("form excludes current match N", () => {
    const asOf = new Date("2024-01-15T12:00:00.000Z");
    const form = computeFormPoints({
      history,
      teamId: "A",
      asOf,
      window: 5,
      excludeMatchId: "m3",
    });
    // Only m1 (win 3) and m2 (draw 1) available before m3 kickoff decision
    assert.equal(form.value, 4);
    assert.equal(form.status, "RECONSTRUCTED_STRICT");
  });

  it("future Elo rejected / provisional blocked", () => {
    const asOf = new Date("2024-06-01T00:00:00.000Z");
    const elo = buildEloFeatures({
      asOf,
      homeClubKey: "A",
      awayClubKey: "B",
      snapshots: [
        {
          clubKey: "A",
          elo: 1800,
          snapshotDate: new Date("2025-07-01"),
          availableAt: new Date("2025-07-01"),
          provenance: "official_clubelo",
        },
        {
          clubKey: "B",
          elo: 1700,
          snapshotDate: new Date("2024-05-01"),
          availableAt: new Date("2024-05-01"),
          provenance: "official_clubelo",
        },
      ],
    });
    assert.equal(elo.homeElo.status, "MISSING");
    assert.equal(classifyEloProvenance("2025-06-15"), "provisional_blocked");
    const blocked = buildEloFeatures({
      asOf: new Date("2025-07-01"),
      homeClubKey: "A",
      awayClubKey: "B",
      snapshots: [
        {
          clubKey: "A",
          elo: 1800,
          snapshotDate: new Date("2025-06-15"),
          availableAt: new Date("2025-06-15"),
          provenance: "provisional_blocked",
        },
        {
          clubKey: "B",
          elo: 1700,
          snapshotDate: new Date("2025-06-15"),
          availableAt: new Date("2025-06-15"),
          provenance: "provisional_blocked",
        },
      ],
    });
    assert.equal(blocked.homeElo.status, "BLOCKED");
    assert.equal(blocked.eloDifference.status, "BLOCKED");
  });

  it("closing odds unavailable before closing/kickoff", () => {
    assert.throws(
      () =>
        assertClosingNotUsedBeforeKickoff(
          new Date("2024-01-01T12:00:00.000Z"),
          new Date("2024-01-01T18:00:00.000Z"),
          true,
        ),
      /LEAKAGE/,
    );
  });

  it("post-match stats rejected prematch", () => {
    assert.throws(
      () =>
        rejectPostEventStatAsPrematch({
          decisionTime: new Date("2024-01-01T12:00:00.000Z"),
          eventKickoff: new Date("2024-01-01T15:00:00.000Z"),
          usedPostMatchStat: true,
        }),
      FeatureGateError,
    );
  });

  it("unknown precision cannot become exact", () => {
    assert.throws(
      () => assertTemporalPrecision("unknown", "exact"),
      TemporalPrecisionError,
    );
  });

  it("ambiguous entity rejected", () => {
    const map = new Map<string, string>([
      ["football-data-org|team|1", "canon-a"],
      ["api-football|team|1", "canon-b"],
    ]);
    // Without alias linking these, unresolved is fine; force ambiguous via duplicates in candidates
    assert.throws(() => assertResolved({
      status: "ambiguous",
      canonicalId: null,
      candidates: ["a", "b"],
    }), /AMBIGUOUS/);
    const unresolved = resolveTeam({
      providerSource: "x",
      providerEntityId: "nope",
      entityMap: map,
    });
    assert.equal(unresolved.status, "unresolved");
  });

  it("same input + same asOf = same feature matrix", () => {
    const event = {
      eventId: "m3",
      sportId: "football",
      competitionId: "E0",
      homeTeamId: "A",
      awayTeamId: "D",
      scheduledStartAt: new Date("2024-01-15T15:00:00.000Z"),
    };
    const asOf = new Date("2024-01-15T12:00:00.000Z");
    const a = buildFeatureSnapshot({ event, asOf, history });
    const b = buildFeatureSnapshot({ event, asOf, history });
    assert.equal(
      JSON.stringify(a.cells.home_form_5_overall),
      JSON.stringify(b.cells.home_form_5_overall),
    );
  });

  it("missing is not coerced to zero", () => {
    const form = computeFormPoints({
      history: [],
      teamId: "Z",
      asOf: new Date("2024-01-01"),
      window: 5,
    });
    assert.equal(form.status, "MISSING");
    assert.equal(form.value, null);
  });

  it("forbidden cluster features are listed and gated", () => {
    assert.ok(listForbiddenFeatures().some((f) => f.id === "cluster_c_star"));
    assert.throws(() => assertNotForbiddenFeature("cluster_c_star"), FeatureGateError);
  });

  it("rejects invalid odds and self-match in quality gates", () => {
    const issues = runDataQualityChecks({
      odds: [0.9],
      homeTeamId: "A",
      awayTeamId: "A",
      overround: 0,
    });
    assert.ok(issues.some((i) => i.code === "invalid_odds"));
    assert.ok(issues.some((i) => i.code === "team_self_match"));
    assert.ok(issues.some((i) => i.code === "overround_le_0"));
  });

  it("walk-forward rejects random split and future train leakage", () => {
    assert.throws(() => assertNotRandomTemporalSplit("random"));
    assert.throws(() =>
      assertNoFutureInTrain({
        sampleAvailableAt: new Date("2024-06-01"),
        trainEnd: new Date("2024-01-01"),
      }),
    );
    const folds = buildWalkForwardFolds({
      timelineStart: new Date("2020-01-01"),
      timelineEnd: new Date("2022-01-01"),
      trainDays: 180,
      validationDays: 30,
      testDays: 30,
      stepDays: 30,
    });
    assert.ok(folds.length > 0);
  });

  it("multiple-testing guard blocks in-sample-only claims", () => {
    assert.throws(() =>
      assertClaimRequiresOos({
        inSampleSignificant: true,
        outOfSampleConfirmed: false,
        claim: "we beat the bookmaker",
      }),
    );
    assert.equal(
      survivesBonferroni({ pValue: 0.01, alpha: 0.05, numberOfTests: 100 }),
      false,
    );
  });

  it("metrics foundation computes log loss and Brier", () => {
    assert.ok(logLoss(1, 0.8) < logLoss(1, 0.2));
    assert.equal(brierScore(1, 0.5), 0.25);
  });

  it("explanation keeps confidence null", () => {
    const snap = buildFeatureSnapshot({
      event: {
        eventId: "m3",
        sportId: "football",
        competitionId: "E0",
        homeTeamId: "A",
        awayTeamId: "D",
        scheduledStartAt: new Date("2024-01-15T15:00:00.000Z"),
      },
      asOf: new Date("2024-01-15T12:00:00.000Z"),
      history,
      marketId: "result",
    });
    const exp = buildPredictionExplanation(snap);
    assert.equal(exp.uncertainty.confidence, null);
    assert.equal(exp.marketComparison.modelProbability, null);
  });
});
