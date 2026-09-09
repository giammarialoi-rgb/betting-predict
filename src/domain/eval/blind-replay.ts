import { assertAsOf } from "@/lib/as-of";
import type {
  DecisionContext,
  DecisionFeatureEntry,
  DecisionMarketEntry,
  OutcomeContext,
} from "@/domain/eval/contexts";
import { assertNoOutcomeLeakIntoDecision } from "@/domain/eval/contexts";

export type BlindReplayAsOfPolicy = "STRICT_AS_OF" | "RESEARCH" | "ANY";

export type BlindReplayEvent = {
  eventId: string;
  sportId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledStartAt: Date;
};

export type BlindReplayFeatureRow = {
  eventId: string;
  featureKey: string;
  value: number | string | object | null;
  availableAt: Date | null;
  temporalPrecision: string;
  featureStatus: string;
  source?: string | null;
};

export type BlindReplayMarketRow = {
  eventId: string;
  marketType: string;
  selectionSide: string;
  line: string | null;
  bookmakerSlug?: string;
  oddsDecimal: number;
  availableAt: Date;
  temporalPrecision: string;
  observationKind: string;
};

export type BlindReplayEloRow = {
  teamId: string;
  rating: number;
  availableAt: Date;
  temporalPrecision: string;
  provenance: string;
};

export type BlindReplayFeatureProvider = {
  listFeaturesForEvent(
    eventId: string,
    asOf: Date,
  ): BlindReplayFeatureRow[];
};

export type BlindReplayMarketProvider = {
  listMarketsForEvent(eventId: string, asOf: Date): BlindReplayMarketRow[];
};

export type BlindReplayOutcomeProvider = {
  getOutcome(eventId: string): OutcomeContext | null;
};

export class DecisionContextSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionContextSafetyError";
  }
}

/**
 * Hard firewall for STRICT_AS_OF decision contexts.
 */
export function assertDecisionContextSafe(
  context: DecisionContext,
  options?: { requireExactPrecision?: boolean },
): void {
  const requireExact =
    options?.requireExactPrecision ?? context.asOfPolicy === "STRICT_AS_OF";

  assertNoOutcomeLeakIntoDecision(context);

  for (const f of context.availableFeatures) {
    if (f.featureStatus === "FORBIDDEN") {
      throw new DecisionContextSafetyError(
        `FORBIDDEN feature present: ${f.featureKey}`,
      );
    }
    if (f.availableAt) {
      if (f.availableAt.getTime() > context.asOf.getTime()) {
        throw new DecisionContextSafetyError(
          `Feature ${f.featureKey} available_at after asOf`,
        );
      }
      assertAsOf(context.asOf, f.availableAt);
    }
    if (
      requireExact &&
      f.featureStatus === "VALID" &&
      f.temporalPrecision !== "exact" &&
      f.temporalPrecision !== "dataset_window"
    ) {
      // dataset_window allowed for Elo under STRICT with explicit warning collected elsewhere;
      // unknown is never allowed when STRICT requires exact-or-window.
      if (f.temporalPrecision === "unknown") {
        throw new DecisionContextSafetyError(
          `Feature ${f.featureKey} has temporal_precision=unknown under STRICT_AS_OF`,
        );
      }
    }
    if (requireExact && f.featureStatus === "TEMPORAL_UNKNOWN") {
      throw new DecisionContextSafetyError(
        `TEMPORAL_UNKNOWN feature ${f.featureKey} rejected under STRICT_AS_OF`,
      );
    }
  }

  for (const m of context.availableMarkets) {
    if (m.availableAt.getTime() > context.asOf.getTime()) {
      throw new DecisionContextSafetyError(
        `Market quote available_at after asOf (${m.marketType})`,
      );
    }
    if (requireExact && m.temporalPrecision === "unknown") {
      throw new DecisionContextSafetyError(
        `Market ${m.marketType} temporal_precision=unknown rejected under STRICT_AS_OF`,
      );
    }
  }
}

function filterFeatures(
  rows: BlindReplayFeatureRow[],
  asOf: Date,
  policy: BlindReplayAsOfPolicy,
): DecisionFeatureEntry[] {
  const out: DecisionFeatureEntry[] = [];
  for (const row of rows) {
    if (row.eventId && row.availableAt === null && row.featureStatus === "MISSING") {
      out.push({
        featureKey: row.featureKey,
        value: null,
        availableAt: null,
        temporalPrecision: row.temporalPrecision,
        featureStatus: row.featureStatus,
        source: row.source,
      });
      continue;
    }
    if (row.availableAt && row.availableAt.getTime() > asOf.getTime()) {
      continue;
    }
    if (policy === "STRICT_AS_OF") {
      if (row.featureStatus === "FORBIDDEN") continue;
      if (row.featureStatus === "TEMPORAL_UNKNOWN") continue;
      if (row.temporalPrecision === "unknown") continue;
    }
    out.push({
      featureKey: row.featureKey,
      value: row.value,
      availableAt: row.availableAt,
      temporalPrecision: row.temporalPrecision,
      featureStatus: row.featureStatus,
      source: row.source,
    });
  }
  return out;
}

function filterMarkets(
  rows: BlindReplayMarketRow[],
  asOf: Date,
  policy: BlindReplayAsOfPolicy,
): DecisionMarketEntry[] {
  const out: DecisionMarketEntry[] = [];
  for (const row of rows) {
    if (row.availableAt.getTime() > asOf.getTime()) continue;
    if (policy === "STRICT_AS_OF" && row.temporalPrecision === "unknown") {
      continue;
    }
    out.push({
      marketType: row.marketType,
      selectionSide: row.selectionSide,
      line: row.line,
      bookmakerSlug: row.bookmakerSlug,
      oddsDecimal: row.oddsDecimal,
      availableAt: row.availableAt,
      temporalPrecision: row.temporalPrecision,
      observationKind: row.observationKind,
    });
  }
  return out;
}

/**
 * Blind historical replay: reconstruct DecisionContext without future outcome.
 */
export function runBlindReplay(input: {
  event: BlindReplayEvent;
  asOf: Date;
  asOfPolicy: BlindReplayAsOfPolicy;
  featureProvider: BlindReplayFeatureProvider;
  marketProvider: BlindReplayMarketProvider;
}): DecisionContext {
  const features = filterFeatures(
    input.featureProvider.listFeaturesForEvent(input.event.eventId, input.asOf),
    input.asOf,
    input.asOfPolicy,
  );
  const markets = filterMarkets(
    input.marketProvider.listMarketsForEvent(input.event.eventId, input.asOf),
    input.asOf,
    input.asOfPolicy,
  );

  const featureStatuses: Record<string, string> = {};
  let present = 0;
  let missing = 0;
  let forbidden = 0;
  for (const f of features) {
    featureStatuses[f.featureKey] = f.featureStatus;
    if (f.featureStatus === "MISSING" || f.value === null) missing++;
    else if (f.featureStatus === "FORBIDDEN") forbidden++;
    else present++;
  }

  const temporalWarnings: string[] = [];
  if (input.asOf.getTime() > input.event.scheduledStartAt.getTime()) {
    temporalWarnings.push(
      "asOf is after scheduled_start_at — post-kickoff decision window",
    );
  }
  for (const f of features) {
    if (f.temporalPrecision === "dataset_window") {
      temporalWarnings.push(`${f.featureKey}: dataset_window precision`);
    }
  }

  const context: DecisionContext = {
    kind: "decision",
    eventId: input.event.eventId,
    sportId: input.event.sportId,
    asOf: input.asOf,
    asOfPolicy: input.asOfPolicy,
    availableFeatures: features,
    featureStatuses,
    availableMarkets: markets,
    marketSnapshots: markets,
    dataQuality: {
      featurePresent: present,
      featureMissing: missing,
      featureForbidden: forbidden,
      marketCount: markets.length,
    },
    temporalWarnings,
    modelProbability: null,
    uncertainty: null,
    edge: null,
    confidence: null,
    riskState: null,
  };

  if (input.asOfPolicy === "STRICT_AS_OF") {
    assertDecisionContextSafe(context, { requireExactPrecision: true });
  }

  return context;
}

/**
 * Evaluation phase only — fetch outcome separately from decision.
 */
export function loadOutcomeForEvaluation(
  provider: BlindReplayOutcomeProvider,
  eventId: string,
): OutcomeContext | null {
  const outcome = provider.getOutcome(eventId);
  if (!outcome) return null;
  if (outcome.kind !== "outcome") {
    throw new Error("Outcome provider returned non-outcome context");
  }
  return outcome;
}
