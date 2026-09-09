import type { MatrixCell } from "@/domain/markets/matrix";
import { marketMovement } from "@/domain/odds/math";

/**
 * Market microstructure research features — descriptive only.
 */

export type PricePath = {
  opening: MatrixCell | null;
  current: MatrixCell | null;
  closing: MatrixCell | null;
};

export function selectPricePath(
  cells: readonly MatrixCell[],
  filter: {
    eventId: string;
    bookmakerSlug: string;
    marketId: string;
    selection: string;
    line?: number | null;
    scheduledStartAt: Date;
    asOf: Date;
  },
): PricePath {
  const scoped = cells
    .filter(
      (c) =>
        c.eventId === filter.eventId &&
        c.bookmakerSlug === filter.bookmakerSlug &&
        c.marketId === filter.marketId &&
        c.selection === filter.selection &&
        (filter.line ?? null) === (c.line ?? null) &&
        c.availableAt.getTime() <= filter.asOf.getTime(),
    )
    .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime());

  const opening = scoped[0] ?? null;
  const current = scoped.length ? scoped[scoped.length - 1]! : null;
  const preKick = scoped.filter(
    (c) => c.availableAt.getTime() <= filter.scheduledStartAt.getTime(),
  );
  const closing = preKick.length ? preKick[preKick.length - 1]! : null;

  // Closing is only meaningful when asOf >= scheduledStartAt.
  // Callers deciding earlier must not use closing.
  return {
    opening,
    current,
    closing:
      filter.asOf.getTime() >= filter.scheduledStartAt.getTime() ? closing : null,
  };
}

export function assertClosingNotUsedBeforeKickoff(
  decisionTime: Date,
  scheduledStartAt: Date,
  usedClosing: boolean,
): void {
  if (usedClosing && decisionTime.getTime() < scheduledStartAt.getTime()) {
    throw new Error(
      "LEAKAGE: closing price cannot be used before scheduled start / close observation",
    );
  }
}

export type MicrostructureSummary = {
  openingOdds: number | null;
  currentOdds: number | null;
  closingOdds: number | null;
  openingToCurrentDelta: number | null;
  openingToClosingDelta: number | null;
  velocityPerHour: number | null;
  lineMoved: boolean;
  priceMovedWithoutLine: boolean;
};

export function summarizeMicrostructure(
  path: PricePath,
  options?: { openingLine?: number | null; currentLine?: number | null },
): MicrostructureSummary {
  const openingOdds = path.opening?.oddsDecimal ?? null;
  const currentOdds = path.current?.oddsDecimal ?? null;
  const closingOdds = path.closing?.oddsDecimal ?? null;
  const openingToCurrentDelta =
    openingOdds !== null && currentOdds !== null
      ? currentOdds - openingOdds
      : null;
  const openingToClosingDelta =
    openingOdds !== null && closingOdds !== null
      ? closingOdds - openingOdds
      : null;

  let velocityPerHour: number | null = null;
  if (path.opening && path.current && path.opening !== path.current) {
    const hours =
      (path.current.availableAt.getTime() - path.opening.availableAt.getTime()) /
      3_600_000;
    if (hours > 0) {
      velocityPerHour =
        marketMovement(path.opening.oddsDecimal, path.current.oddsDecimal)
          .oddsDelta / hours;
    }
  }

  const lineMoved =
    options?.openingLine !== undefined &&
    options?.currentLine !== undefined &&
    options.openingLine !== options.currentLine;

  const priceMovedWithoutLine =
    openingToCurrentDelta !== null &&
    openingToCurrentDelta !== 0 &&
    !lineMoved;

  return {
    openingOdds,
    currentOdds,
    closingOdds,
    openingToCurrentDelta,
    openingToClosingDelta,
    velocityPerHour,
    lineMoved,
    priceMovedWithoutLine,
  };
}

export function crossBookDispersion(
  quotes: readonly number[],
): {
  min: number;
  max: number;
  mean: number;
  median: number;
  range: number;
  count: number;
} | null {
  if (quotes.length === 0) return null;
  const sorted = [...quotes].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean,
    median,
    range: sorted[sorted.length - 1]! - sorted[0]!,
    count: sorted.length,
  };
}
