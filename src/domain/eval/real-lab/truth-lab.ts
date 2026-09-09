/**
 * Real Truth Lab V1 — blind reconstruction on real offline pack.
 */

import {
  assertDecisionContextSafe,
  DecisionContextSafetyError,
} from "@/domain/eval/blind-replay";
import type {
  DecisionContext,
  OutcomeContext,
} from "@/domain/eval/contexts";
import {
  assertDecisionOutcomeIsolation,
  type HistoricalEvaluationSample,
} from "@/domain/eval/lab/sample";
import {
  loadRealTruthLabPack,
  type RealHistoricalDataset,
  type RealLabEvent,
} from "@/domain/eval/real-lab/load-pack";
import { quotesAsOf } from "@/domain/markets/discovery-engine";
import { buildFeatureEngineV2 } from "@/domain/features/engine-v2";
import {
  computeOverround,
  normalizeMarketProbabilities,
} from "@/domain/odds/math";
import { computeMarketMicrostructure } from "@/domain/markets/microstructure-math";

export function buildRealHistoricalEvaluationSample(input: {
  eventId: string;
  asOf: Date;
  dataset?: RealHistoricalDataset;
  asOfPolicy?: "STRICT_AS_OF" | "RESEARCH" | "ANY";
  includeOutcome?: boolean;
  /** RESEARCH may include unknown-precision market for baseline experiments. */
  allowUnknownPrecisionMarkets?: boolean;
}): HistoricalEvaluationSample {
  const dataset = input.dataset ?? loadRealTruthLabPack();
  const asOfPolicy = input.asOfPolicy ?? "STRICT_AS_OF";
  const event = dataset.events.find((e) => e.eventId === input.eventId);
  if (!event) throw new Error(`Unknown real lab event: ${input.eventId}`);

  const policyForQuotes =
    input.allowUnknownPrecisionMarkets && asOfPolicy === "STRICT_AS_OF"
      ? "RESEARCH"
      : asOfPolicy;

  const { accepted, rejected } = quotesAsOf(
    dataset.quotes,
    event.eventId,
    input.asOf,
    policyForQuotes,
  );

  // For STRICT decision features, still exclude unknown precision from DecisionContext markets
  const decisionMarkets =
    asOfPolicy === "STRICT_AS_OF"
      ? accepted.filter((q) => q.temporalPrecision !== "unknown")
      : accepted;

  const { features, excluded } = buildFeatureEngineV2({
    event,
    asOf: input.asOf,
    dataset,
    marketQuotes: accepted,
  });

  const safeFeatures = features.filter((f) => {
    if (f.featureStatus === "FORBIDDEN") return false;
    if (asOfPolicy === "STRICT_AS_OF") {
      if (f.featureStatus === "TEMPORAL_UNKNOWN") return false;
      if (f.temporalPrecision === "unknown") return false;
    }
    return true;
  });

  let present = 0;
  let missing = 0;
  let forbidden = 0;
  for (const f of features) {
    if (f.featureStatus === "FORBIDDEN") forbidden++;
    else if (f.featureStatus === "MISSING" || f.value === null) missing++;
    else present++;
  }

  const marketEntries = decisionMarkets.map((q) => ({
    marketType: q.observation.marketType,
    selectionSide: q.observation.selection,
    line: q.observation.line === null ? null : String(q.observation.line),
    bookmakerSlug: q.bookmakerSlug,
    oddsDecimal: q.oddsDecimal,
    availableAt: q.availableAt,
    temporalPrecision: q.temporalPrecision,
    observationKind: q.observationKind,
  }));

  const decisionContext: DecisionContext = {
    kind: "decision",
    eventId: event.eventId,
    sportId: event.sportId,
    asOf: input.asOf,
    asOfPolicy,
    availableFeatures: safeFeatures,
    featureStatuses: Object.fromEntries(
      features.map((f) => [f.featureKey, f.featureStatus]),
    ),
    availableMarkets: marketEntries,
    marketSnapshots: marketEntries,
    dataQuality: {
      featurePresent: present,
      featureMissing: missing,
      featureForbidden: forbidden,
      marketCount: marketEntries.length,
    },
    temporalWarnings: [
      ...(asOfPolicy === "STRICT_AS_OF"
        ? ["unknown_precision_markets_excluded_from_STRICT_decision"]
        : []),
    ],
    modelProbability: null,
    uncertainty: null,
    edge: null,
    confidence: null,
    riskState: null,
  };

  if (asOfPolicy === "STRICT_AS_OF") {
    assertDecisionContextSafe(decisionContext, { requireExactPrecision: true });
  }

  let outcomeContext: OutcomeContext | null = null;
  if (input.includeOutcome) {
    outcomeContext = {
      kind: "outcome",
      eventId: event.eventId,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      resultCode: event.resultCode,
      availableAt: event.resultAvailableAt,
      observedAt: event.resultAvailableAt,
    };
  }

  const resultOpen = accepted.filter(
    (q) =>
      q.observation.marketType === "result" &&
      q.observationKind === "dataset_open" &&
      q.bookmakerSlug === "bet365",
  );
  const bySel = new Map(resultOpen.map((q) => [q.observation.selection, q]));
  let impliedNormalized: Record<string, number> | null = null;
  let overround: number | null = null;
  if (bySel.has("HOME") && bySel.has("DRAW") && bySel.has("AWAY")) {
    const odds = [
      bySel.get("HOME")!.oddsDecimal,
      bySel.get("DRAW")!.oddsDecimal,
      bySel.get("AWAY")!.oddsDecimal,
    ];
    overround = computeOverround(odds).overround;
    const n = normalizeMarketProbabilities(odds);
    impliedNormalized = { HOME: n[0]!, DRAW: n[1]!, AWAY: n[2]! };
  }

  const homePrices = accepted
    .filter(
      (q) =>
        q.observation.marketType === "result" &&
        q.observation.selection === "HOME" &&
        q.observationKind === "dataset_open",
    )
    .map((q) => q.oddsDecimal);
  const micro = computeMarketMicrostructure({
    prices: homePrices,
    openingOdds: bySel.get("HOME")?.oddsDecimal ?? null,
    closingOdds: null,
    marketOddsList:
      bySel.has("HOME") && bySel.has("DRAW") && bySel.has("AWAY")
        ? [
            bySel.get("HOME")!.oddsDecimal,
            bySel.get("DRAW")!.oddsDecimal,
            bySel.get("AWAY")!.oddsDecimal,
          ]
        : undefined,
  });

  const sample: HistoricalEvaluationSample = {
    eventId: event.eventId,
    asOf: input.asOf,
    market: "result",
    featurePolicy: "feature_engine_v2_strict",
    decisionContext,
    marketContext: {
      marketType: "result",
      snapshots: marketEntries,
      opening: marketEntries[0] ?? null,
      latestAvailable: marketEntries[marketEntries.length - 1] ?? null,
      closing: null,
      impliedNormalized,
      overround,
      disagreement: micro.bookmaker_disagreement,
    },
    featureContext: {
      features: safeFeatures,
      usedKeys: safeFeatures
        .filter((f) => f.featureStatus === "VALID" && f.value !== null)
        .map((f) => f.featureKey),
      excludedKeys: excluded,
    },
    outcomeContext,
    dataQuality: {
      eventsTotal: dataset.events.length,
      eventsEvaluated: 1,
      eventsRejected: 0,
      featuresAvailable: present,
      featuresMissing: missing,
      featuresForbidden: forbidden,
      marketsAvailable: decisionMarkets.length,
      marketsRejected: rejected.length,
      temporalViolations: 0,
      entityResolutionFailures: 0,
    },
  };
  assertDecisionOutcomeIsolation(sample);
  return sample;
}

export function decisionAsOfForEvent(event: RealLabEvent): Date {
  return new Date(event.scheduledStartAt.getTime() - 60 * 60 * 1000);
}

export { DecisionContextSafetyError };
