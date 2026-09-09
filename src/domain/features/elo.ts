import { assertAsOf } from "@/lib/as-of";
import type { EloSnapshot, FeatureCell } from "@/domain/features/types";

export const CLUBELO_PROVISIONAL_CUTOFF = "2025-06-15";

export function eloExpectedHomeProbability(
  homeElo: number,
  awayElo: number,
): number {
  return 1 / (1 + 10 ** (-(homeElo - awayElo) / 400));
}

/**
 * Latest official ClubElo snapshot available at asOf.
 * Provisional / unknown provenance → BLOCKED (never SAFE).
 */
export function selectEloAsOf(input: {
  snapshots: readonly EloSnapshot[];
  clubKey: string;
  asOf: Date;
  featureId: string;
}): FeatureCell<number> {
  const eligible = input.snapshots.filter((s) => {
    if (s.clubKey !== input.clubKey) return false;
    if (s.availableAt.getTime() > input.asOf.getTime()) return false;
    return true;
  });
  if (eligible.length === 0) {
    return {
      featureId: input.featureId,
      value: null,
      source: "clubelo",
      availableAt: null,
      temporalPrecision: "unknown",
      status: "MISSING",
    };
  }
  eligible.sort(
    (a, b) => b.availableAt.getTime() - a.availableAt.getTime(),
  );
  const best = eligible[0]!;
  assertAsOf(input.asOf, best.availableAt);

  if (best.provenance === "provisional_blocked") {
    return {
      featureId: input.featureId,
      value: null,
      source: "clubelo",
      availableAt: best.availableAt,
      temporalPrecision: "dataset_window",
      status: "BLOCKED",
      notes: "provisional Elo forbidden in STRICT_AS_OF",
    };
  }
  if (best.provenance !== "official_clubelo") {
    return {
      featureId: input.featureId,
      value: null,
      source: "clubelo",
      availableAt: best.availableAt,
      temporalPrecision: "unknown",
      status: "BLOCKED",
      notes: "unverified Elo provenance",
    };
  }

  return {
    featureId: input.featureId,
    value: best.elo,
    source: "clubelo",
    availableAt: best.availableAt,
    temporalPrecision: "dataset_window",
    status: "DATASET_WINDOW",
  };
}

export function buildEloFeatures(input: {
  snapshots: readonly EloSnapshot[];
  homeClubKey: string;
  awayClubKey: string;
  asOf: Date;
}): {
  homeElo: FeatureCell<number>;
  awayElo: FeatureCell<number>;
  eloDifference: FeatureCell<number>;
  eloExpectedProbability: FeatureCell<number>;
} {
  const homeElo = selectEloAsOf({
    snapshots: input.snapshots,
    clubKey: input.homeClubKey,
    asOf: input.asOf,
    featureId: "home_elo",
  });
  const awayElo = selectEloAsOf({
    snapshots: input.snapshots,
    clubKey: input.awayClubKey,
    asOf: input.asOf,
    featureId: "away_elo",
  });

  if (
    homeElo.value === null ||
    awayElo.value === null ||
    homeElo.status === "BLOCKED" ||
    awayElo.status === "BLOCKED"
  ) {
    return {
      homeElo,
      awayElo,
      eloDifference: {
        featureId: "elo_difference",
        value: null,
        source: "clubelo",
        availableAt: null,
        temporalPrecision: "dataset_window",
        status: "BLOCKED",
        notes: "requires both official Elo cells",
      },
      eloExpectedProbability: {
        featureId: "elo_expected_probability",
        value: null,
        source: "clubelo",
        availableAt: null,
        temporalPrecision: "dataset_window",
        status: "BLOCKED",
      },
    };
  }

  const availableAt =
    homeElo.availableAt && awayElo.availableAt
      ? new Date(
          Math.max(
            homeElo.availableAt.getTime(),
            awayElo.availableAt.getTime(),
          ),
        )
      : null;

  return {
    homeElo,
    awayElo,
    eloDifference: {
      featureId: "elo_difference",
      value: homeElo.value - awayElo.value,
      source: "clubelo",
      availableAt,
      temporalPrecision: "dataset_window",
      status: "DATASET_WINDOW",
    },
    eloExpectedProbability: {
      featureId: "elo_expected_probability",
      value: eloExpectedHomeProbability(homeElo.value, awayElo.value),
      source: "clubelo",
      availableAt,
      temporalPrecision: "dataset_window",
      status: "DATASET_WINDOW",
      notes: "2-way Elo expectation; not a full 1X2 model",
    },
  };
}

export function classifyEloProvenance(
  snapshotIsoDate: string,
): EloSnapshot["provenance"] {
  return snapshotIsoDate >= CLUBELO_PROVISIONAL_CUTOFF
    ? "provisional_blocked"
    : "official_clubelo";
}
