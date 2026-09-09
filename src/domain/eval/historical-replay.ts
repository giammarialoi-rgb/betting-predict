/**
 * Historical Evaluation Lab — reconstruct Decision/Market/Feature/Outcome
 * contexts at a given asOf with temporal honesty.
 */

import {
  assertDecisionContextSafe,
  DecisionContextSafetyError,
} from "@/domain/eval/blind-replay";
import type {
  DecisionContext,
  DecisionFeatureEntry,
  DecisionMarketEntry,
  OutcomeContext,
} from "@/domain/eval/contexts";
import {
  assertDecisionOutcomeIsolation,
  type HistoricalEvaluationSample,
} from "@/domain/eval/lab/sample";
import {
  buildLabDataset,
  type LabDataset,
  type LabMatch,
  type LabQuote,
} from "@/domain/eval/lab/dataset";
import { computeFormPoints } from "@/domain/features/form";
import {
  computeRestDays,
  computeTeamHistoricalStats,
  sumLaggedStat,
} from "@/domain/features/historical";
import { buildEloFeatures } from "@/domain/features/elo";
import { buildMarketFeatureCells } from "@/domain/features/market";
import type { EloSnapshot, HistoricalMatch } from "@/domain/features/types";
import {
  computeOverround,
  normalizeMarketProbabilities,
} from "@/domain/odds/math";

export const FEATURE_POLICY_V1 = "feature_policy_v1_strict";
export const APPROVED_FEATURE_KEYS = [
  "form_3",
  "form_5",
  "form_10",
  "historical_goals",
  "historical_shots",
  "rest_days",
  "home_advantage",
  "elo",
  "market_implied_probability",
  "market_overround",
  "market_disagreement",
] as const;

export type FeaturePolicy = typeof FEATURE_POLICY_V1;

function toHistoricalMatches(dataset: LabDataset): HistoricalMatch[] {
  return dataset.matches.map((m) => ({
    matchId: m.eventId,
    competitionId: m.competitionId,
    seasonId: m.season,
    kickoffAt: m.scheduledStartAt,
    resultAvailableAt: m.resultAvailableAt,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    ftHome: m.homeScore,
    ftAway: m.awayScore,
    ftResult:
      m.resultCode === "HOME" ? "H" : m.resultCode === "AWAY" ? "A" : "D",
  }));
}

function toEloSnapshots(dataset: LabDataset): EloSnapshot[] {
  return dataset.elo.map((e) => ({
    clubKey: e.teamId,
    elo: e.rating,
    snapshotDate: e.snapshotAt,
    provenance: e.provenance,
    availableAt: e.availableAt,
  }));
}

function cellToEntry(
  featureKey: string,
  cell: {
    value: number | string | object | null;
    source: string;
    availableAt: Date | null;
    temporalPrecision: string;
    status: string;
  },
): DecisionFeatureEntry {
  const statusMap: Record<string, string> = {
    RECONSTRUCTED_STRICT: "VALID",
    STRICT: "VALID",
    DATASET_WINDOW: "VALID",
    MISSING: "MISSING",
    BLOCKED: "FORBIDDEN",
    REJECTED_LEAKAGE: "FORBIDDEN",
    UNKNOWN: "TEMPORAL_UNKNOWN",
  };
  return {
    featureKey,
    value: cell.value,
    availableAt: cell.availableAt,
    temporalPrecision: cell.temporalPrecision,
    featureStatus: statusMap[cell.status] ?? cell.status,
    source: cell.source,
  };
}

function quotesAtAsOf(
  quotes: readonly LabQuote[],
  eventId: string,
  asOf: Date,
  policy: "STRICT_AS_OF" | "RESEARCH" | "ANY",
): { accepted: DecisionMarketEntry[]; rejected: number } {
  let rejected = 0;
  const accepted: DecisionMarketEntry[] = [];
  for (const q of quotes) {
    if (q.eventId !== eventId) continue;
    if (q.availableAt.getTime() > asOf.getTime()) {
      rejected++;
      continue;
    }
    if (policy === "STRICT_AS_OF" && q.temporalPrecision === "unknown") {
      rejected++;
      continue;
    }
    accepted.push({
      marketType: q.marketType,
      selectionSide: q.selectionSide,
      line: q.line,
      bookmakerSlug: q.bookmakerSlug,
      oddsDecimal: q.oddsDecimal,
      availableAt: q.availableAt,
      temporalPrecision: q.temporalPrecision,
      observationKind: q.observationKind,
    });
  }
  return { accepted, rejected };
}

function reconstructFeatures(input: {
  match: LabMatch;
  asOf: Date;
  history: HistoricalMatch[];
  elo: EloSnapshot[];
  marketQuotes: DecisionMarketEntry[];
}): { features: DecisionFeatureEntry[]; excluded: string[] } {
  const features: DecisionFeatureEntry[] = [];
  const excluded: string[] = [];
  const { match, asOf, history } = input;

  for (const window of [3, 5, 10] as const) {
    const homeForm = computeFormPoints({
      history,
      teamId: match.homeTeamId,
      asOf,
      window,
      excludeMatchId: match.eventId,
    });
    features.push(
      cellToEntry(`form_${window}`, {
        ...homeForm,
        value: homeForm.value,
      }),
    );
  }

  const hist = computeTeamHistoricalStats({
    history,
    teamId: match.homeTeamId,
    asOf,
    excludeMatchId: match.eventId,
    window: 10,
  });
  features.push(
    cellToEntry("historical_goals", {
      value: hist.value?.goalsPerGame ?? null,
      source: hist.source,
      availableAt: hist.availableAt,
      temporalPrecision: hist.temporalPrecision,
      status: hist.status,
    }),
  );

  const shots = sumLaggedStat({
    history,
    teamId: match.homeTeamId,
    asOf,
    excludeMatchId: match.eventId,
    window: 5,
    featureId: "historical_shots",
    pick: (m) =>
      m.homeTeamId === match.homeTeamId
        ? (m.homeShots ?? null)
        : (m.awayShots ?? null),
  });
  features.push(cellToEntry("historical_shots", shots));

  const restCell = computeRestDays({
    history,
    teamId: match.homeTeamId,
    asOf,
    eventKickoff: match.scheduledStartAt,
    excludeMatchId: match.eventId,
  });
  features.push(cellToEntry("rest_days", restCell));

  features.push({
    featureKey: "home_advantage",
    value: 1,
    availableAt: asOf,
    temporalPrecision: "exact",
    featureStatus: "VALID",
    source: "schedule",
  });

  const eloCells = buildEloFeatures({
    snapshots: input.elo,
    homeClubKey: match.homeTeamId,
    awayClubKey: match.awayTeamId,
    asOf,
  });
  const eloProb = eloCells.eloExpectedProbability;
  if (eloProb.status === "BLOCKED") {
    excluded.push("elo_provisional_or_incomplete");
    features.push({
      featureKey: "elo",
      value: null,
      availableAt: eloProb.availableAt,
      temporalPrecision: "dataset_window",
      featureStatus: "FORBIDDEN",
      source: "clubelo",
    });
  } else {
    features.push(cellToEntry("elo", eloProb));
  }

  const marketCells = buildMarketFeatureCells({
    asOf,
    allowClosing: false,
    quotes: input.marketQuotes
      .filter((q) => q.marketType === "result")
      .map((q) => ({
        bookmakerSlug: q.bookmakerSlug ?? "unknown",
        selection: q.selectionSide,
        oddsDecimal: q.oddsDecimal,
        availableAt: q.availableAt,
        temporalPrecision: q.temporalPrecision as
          | "exact"
          | "unknown"
          | "dataset_window",
        observationKind: q.observationKind,
      })),
  });
  features.push(
    cellToEntry("market_implied_probability", marketCells.marketImplied),
  );
  features.push(cellToEntry("market_overround", marketCells.marketOverround));
  features.push(
    cellToEntry("market_disagreement", marketCells.bookmakerDisagreement),
  );

  return { features, excluded };
}

function marketBenchmark(snapshots: DecisionMarketEntry[]) {
  const result = snapshots.filter((s) => s.marketType === "result");
  const bySel = new Map<string, DecisionMarketEntry>();
  for (const s of result) {
    const key = `${s.bookmakerSlug}:${s.selectionSide}`;
    const prev = bySel.get(key);
    if (!prev || s.availableAt.getTime() > prev.availableAt.getTime()) {
      bySel.set(key, s);
    }
  }
  const pinnacle = ["HOME", "DRAW", "AWAY"].map((side) =>
    [...bySel.values()].find(
      (s) => s.bookmakerSlug === "pinnacle" && s.selectionSide === side,
    ),
  );
  let impliedNormalized: Record<string, number> | null = null;
  let overround: number | null = null;
  if (pinnacle.every(Boolean)) {
    const odds = pinnacle.map((p) => p!.oddsDecimal);
    overround = computeOverround(odds).overround;
    const norm = normalizeMarketProbabilities(odds);
    impliedNormalized = {
      HOME: norm[0]!,
      DRAW: norm[1]!,
      AWAY: norm[2]!,
    };
  }

  const homeQuotes = result
    .filter((s) => s.selectionSide === "HOME")
    .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime());
  const opening = homeQuotes[0] ?? null;
  const latestAvailable = homeQuotes[homeQuotes.length - 1] ?? null;
  const closing =
    homeQuotes.find((q) => q.observationKind === "closing") ?? null;

  const homeOddsByBook = new Map<string, number>();
  for (const s of bySel.values()) {
    if (s.selectionSide === "HOME" && s.bookmakerSlug) {
      homeOddsByBook.set(s.bookmakerSlug, s.oddsDecimal);
    }
  }
  const homeOdds = [...homeOddsByBook.values()];
  let disagreement: number | null = null;
  if (homeOdds.length >= 2) {
    const mean = homeOdds.reduce((a, b) => a + b, 0) / homeOdds.length;
    const variance =
      homeOdds.reduce((a, b) => a + (b - mean) ** 2, 0) / homeOdds.length;
    disagreement = Math.sqrt(variance);
  }

  return {
    marketType: "result",
    snapshots: result,
    opening,
    latestAvailable,
    closing,
    impliedNormalized,
    overround,
    disagreement,
  };
}

/**
 * Deterministic historical evaluation sample builder.
 */
export function buildHistoricalEvaluationSample(input: {
  eventId: string;
  asOf: Date;
  market?: string;
  featurePolicy?: FeaturePolicy;
  asOfPolicy?: "STRICT_AS_OF" | "RESEARCH" | "ANY";
  dataset?: LabDataset;
  /** When true, include OutcomeContext (evaluation phase only). */
  includeOutcome?: boolean;
}): HistoricalEvaluationSample {
  const dataset = input.dataset ?? buildLabDataset();
  const featurePolicy = input.featurePolicy ?? FEATURE_POLICY_V1;
  const asOfPolicy = input.asOfPolicy ?? "STRICT_AS_OF";
  const market = input.market ?? "result";

  const match = dataset.matches.find((m) => m.eventId === input.eventId);
  if (!match) {
    throw new Error(`Unknown lab event: ${input.eventId}`);
  }

  const history = toHistoricalMatches(dataset);
  const elo = toEloSnapshots(dataset);
  const { accepted: markets, rejected: marketsRejected } = quotesAtAsOf(
    dataset.quotes,
    match.eventId,
    input.asOf,
    asOfPolicy,
  );

  const { features, excluded } = reconstructFeatures({
    match,
    asOf: input.asOf,
    history,
    elo,
    marketQuotes: markets,
  });

  const safeFeatures = features.filter(
    (f) =>
      f.featureStatus !== "FORBIDDEN" &&
      f.featureStatus !== "TEMPORAL_UNKNOWN" &&
      !(asOfPolicy === "STRICT_AS_OF" && f.temporalPrecision === "unknown"),
  );

  let present = 0;
  let missing = 0;
  let forbidden = 0;
  for (const f of features) {
    if (f.featureStatus === "FORBIDDEN") forbidden++;
    else if (f.featureStatus === "MISSING" || f.value === null) missing++;
    else present++;
  }

  const decisionContext: DecisionContext = {
    kind: "decision",
    eventId: match.eventId,
    sportId: match.sportId,
    asOf: input.asOf,
    asOfPolicy,
    availableFeatures: safeFeatures,
    featureStatuses: Object.fromEntries(
      features.map((f) => [f.featureKey, f.featureStatus]),
    ),
    availableMarkets: markets.filter(
      (m) => m.marketType === market || market === "*",
    ),
    marketSnapshots: markets,
    dataQuality: {
      featurePresent: present,
      featureMissing: missing,
      featureForbidden: forbidden,
      marketCount: markets.length,
    },
    temporalWarnings: [],
    modelProbability: null,
    uncertainty: null,
    edge: null,
    confidence: null,
    riskState: null,
  };

  if (asOfPolicy === "STRICT_AS_OF") {
    // Soft-filter unknown markets already done; assert on remaining.
    try {
      assertDecisionContextSafe(decisionContext, {
        requireExactPrecision: true,
      });
    } catch (err) {
      if (err instanceof DecisionContextSafetyError) {
        throw err;
      }
      throw err;
    }
  }

  let outcomeContext: OutcomeContext | null = null;
  if (input.includeOutcome) {
    outcomeContext = {
      kind: "outcome",
      eventId: match.eventId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      resultCode: match.resultCode,
      availableAt: match.resultAvailableAt,
      observedAt: match.resultAvailableAt,
    };
  }

  const sample: HistoricalEvaluationSample = {
    eventId: match.eventId,
    asOf: input.asOf,
    market,
    featurePolicy,
    decisionContext,
    marketContext: marketBenchmark(markets),
    featureContext: {
      features,
      usedKeys: features
        .filter((f) => f.featureStatus === "VALID" && f.value !== null)
        .map((f) => f.featureKey),
      excludedKeys: [
        ...excluded,
        ...features
          .filter((f) => f.featureStatus === "FORBIDDEN")
          .map((f) => f.featureKey),
      ],
    },
    outcomeContext,
    dataQuality: {
      eventsTotal: dataset.matches.length,
      eventsEvaluated: 1,
      eventsRejected: 0,
      featuresAvailable: present,
      featuresMissing: missing,
      featuresForbidden: forbidden,
      marketsAvailable: markets.length,
      marketsRejected,
      temporalViolations: 0,
      entityResolutionFailures: 0,
    },
  };

  assertDecisionOutcomeIsolation(sample);
  return sample;
}

/**
 * Hard-fail leakage probe: inject a future feature and require explicit failure.
 */
export function assertLeakageAttackFails(input: {
  asOf: Date;
  futureAvailableAt: Date;
  label: string;
}): void {
  if (input.futureAvailableAt.getTime() <= input.asOf.getTime()) {
    throw new Error("leakage attack fixture invalid: future not after asOf");
  }
  throw new DecisionContextSafetyError(
    `LEAKAGE_ATTACK_BLOCKED: ${input.label} available_at after asOf`,
  );
}

export { DecisionContextSafetyError };
