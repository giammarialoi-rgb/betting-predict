/**
 * Selection side vocabulary for market snapshots.
 * Prefer these over free-form strings. Use selection_ref for TEAM/PLAYER/OTHER.
 */
export const SELECTION_SIDES = [
  "HOME",
  "DRAW",
  "AWAY",
  "OVER",
  "UNDER",
  "TEAM",
  "PLAYER",
  "OTHER",
] as const;

export type SelectionSide = (typeof SELECTION_SIDES)[number];

export function isSelectionSide(value: string): value is SelectionSide {
  return (SELECTION_SIDES as readonly string[]).includes(value);
}

/** Format decimal odds for NUMERIC(12,6) storage and identity keys. */
export function formatOddsDecimal(odds: number): string {
  if (!Number.isFinite(odds)) {
    throw new RangeError("odds must be a finite number");
  }
  return odds.toFixed(6);
}

export function parseOddsDecimal(value: string | number): number {
  const odds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(odds)) {
    throw new RangeError("odds must be a finite number");
  }
  return odds;
}

/**
 * Market-implied probability from decimal odds.
 * This is NOT a model prediction, confidence, or true probability.
 * p = 1 / odds
 */
export function decimalOddsToImpliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new RangeError("decimal odds must be finite and > 1");
  }
  return 1 / odds;
}

/**
 * Inverse of decimalOddsToImpliedProbability.
 * odds = 1 / p
 */
export function impliedProbabilityToDecimalOdds(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new RangeError("implied probability must be in (0, 1)");
  }
  return 1 / probability;
}

export type OverroundResult = {
  /** Raw implied probabilities in input order (sum may exceed 1). */
  rawImpliedProbabilities: number[];
  /** sum(1/odds) — bookmaker overround / margin factor. */
  overround: number;
  /** overround - 1 when overround >= 1, else overround (still informative). */
  margin: number;
};

/**
 * Multi-selection market overround.
 * Does NOT remove the bookmaker margin. Callers that need de-vigging
 * must use normalizeMarketProbabilities and document the method.
 */
export function computeOverround(oddsList: readonly number[]): OverroundResult {
  if (oddsList.length < 2) {
    throw new RangeError("overround requires at least two selections");
  }
  const rawImpliedProbabilities = oddsList.map((odds) =>
    decimalOddsToImpliedProbability(odds),
  );
  const overround = rawImpliedProbabilities.reduce((sum, p) => sum + p, 0);
  return {
    rawImpliedProbabilities,
    overround,
    margin: overround - 1,
  };
}

/**
 * Proportional (multiplicative) margin removal:
 *   p'_i = p_i / sum(p)
 *
 * This is the simplest common method. It is NOT Shin, power, or additive.
 * Resulting probabilities sum to 1. They are still market-implied, not truth.
 */
export function normalizeMarketProbabilities(
  oddsList: readonly number[],
): number[] {
  const { rawImpliedProbabilities, overround } = computeOverround(oddsList);
  if (overround <= 0) {
    throw new RangeError("cannot normalize: overround must be > 0");
  }
  return rawImpliedProbabilities.map((p) => p / overround);
}

export type OddsChange = {
  fromOdds: number;
  toOdds: number;
  oddsDelta: number;
  oddsRelativeChange: number;
};

export type ImpliedProbabilityChange = {
  fromImpliedProbability: number;
  toImpliedProbability: number;
  impliedProbabilityDelta: number;
};

export type MarketMovement = {
  oddsChange: OddsChange;
  impliedProbabilityChange: ImpliedProbabilityChange;
};

/** Pure arithmetic movement. No causal interpretation. */
export function oddsChange(fromOdds: number, toOdds: number): OddsChange {
  if (!Number.isFinite(fromOdds) || fromOdds <= 1) {
    throw new RangeError("fromOdds must be finite and > 1");
  }
  if (!Number.isFinite(toOdds) || toOdds <= 1) {
    throw new RangeError("toOdds must be finite and > 1");
  }
  return {
    fromOdds,
    toOdds,
    oddsDelta: toOdds - fromOdds,
    oddsRelativeChange: (toOdds - fromOdds) / fromOdds,
  };
}

export function impliedProbabilityChange(
  fromOdds: number,
  toOdds: number,
): ImpliedProbabilityChange {
  const fromImpliedProbability = decimalOddsToImpliedProbability(fromOdds);
  const toImpliedProbability = decimalOddsToImpliedProbability(toOdds);
  return {
    fromImpliedProbability,
    toImpliedProbability,
    impliedProbabilityDelta: toImpliedProbability - fromImpliedProbability,
  };
}

export function marketMovement(fromOdds: number, toOdds: number): MarketMovement {
  return {
    oddsChange: oddsChange(fromOdds, toOdds),
    impliedProbabilityChange: impliedProbabilityChange(fromOdds, toOdds),
  };
}

export function buildMarketSnapshotIdentityKey(input: {
  bookmakerSlug: string;
  eventId: string;
  marketType: string;
  selectionSide: string;
  line: string | null;
  observationKind: string;
  observedAt: Date;
  oddsDecimal: number | string;
}): string {
  const odds = formatOddsDecimal(parseOddsDecimal(input.oddsDecimal));
  return [
    input.bookmakerSlug,
    input.eventId,
    input.marketType,
    input.selectionSide,
    input.line ?? "-",
    input.observationKind,
    input.observedAt.toISOString(),
    odds,
  ].join("|");
}
