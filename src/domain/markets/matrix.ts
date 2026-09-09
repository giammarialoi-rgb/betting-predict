import { assertAsOf } from "@/lib/as-of";
import { computeOverround } from "@/domain/odds/math";
import { getMarket } from "@/domain/markets/catalog";
import type { ObservedMarketOffer } from "@/domain/markets/discovery";

/**
 * Bookmaker × market × line × selection × timestamp matrix (in-memory).
 * Research structure only — never a recommendation.
 */

export type MatrixCell = {
  eventId: string;
  bookmakerSlug: string;
  marketId: string;
  line: number | null;
  selection: string;
  availableAt: Date;
  oddsDecimal: number;
  providerSlug: string;
};

export function buildBookmakerMarketMatrix(
  offers: readonly ObservedMarketOffer[],
  asOf: Date,
): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const o of offers) {
    if (o.availableAt.getTime() > asOf.getTime()) {
      continue;
    }
    assertAsOf(asOf, o.availableAt);
    cells.push({
      eventId: o.eventId,
      bookmakerSlug: o.bookmakerSlug,
      marketId: o.marketId,
      line: o.line,
      selection: o.selection,
      availableAt: o.availableAt,
      oddsDecimal: o.oddsDecimal,
      providerSlug: o.providerSlug,
    });
  }
  return cells;
}

/** Latest quote per bookmaker×market×line×selection at asOf. */
export function latestQuotesAsOf(
  cells: readonly MatrixCell[],
  asOf: Date,
): MatrixCell[] {
  const best = new Map<string, MatrixCell>();
  for (const cell of cells) {
    if (cell.availableAt.getTime() > asOf.getTime()) continue;
    const key = [
      cell.eventId,
      cell.bookmakerSlug,
      cell.marketId,
      cell.line ?? "",
      cell.selection,
    ].join("|");
    const prev = best.get(key);
    if (!prev || cell.availableAt > prev.availableAt) {
      best.set(key, cell);
    }
  }
  return [...best.values()];
}

export function findBestPrice(
  cells: readonly MatrixCell[],
  filter: {
    eventId: string;
    marketId: string;
    selection: string;
    line?: number | null;
  },
): MatrixCell | null {
  let best: MatrixCell | null = null;
  for (const cell of cells) {
    if (cell.eventId !== filter.eventId) continue;
    if (cell.marketId !== filter.marketId) continue;
    if (cell.selection !== filter.selection) continue;
    if ((filter.line ?? null) !== (cell.line ?? null)) continue;
    if (!best || cell.oddsDecimal > best.oddsDecimal) best = cell;
  }
  return best;
}

export function findMissingMarkets(input: {
  eventId: string;
  expectedMarketIds: readonly string[];
  cells: readonly MatrixCell[];
  bookmakerSlug?: string;
}): string[] {
  const present = new Set(
    input.cells
      .filter(
        (c) =>
          c.eventId === input.eventId &&
          (!input.bookmakerSlug || c.bookmakerSlug === input.bookmakerSlug),
      )
      .map((c) => c.marketId),
  );
  return input.expectedMarketIds.filter((id) => !present.has(id));
}

/**
 * Market-specific overround for a complete selection set at one bookmaker.
 */
export function marketOverroundForBook(input: {
  marketId: string;
  oddsBySelection: Readonly<Record<string, number>>;
}): {
  marketId: string;
  selectionCount: number;
  overround: number;
  margin: number;
  method: string;
} {
  const def = getMarket(input.marketId);
  const odds = Object.values(input.oddsBySelection);
  if (odds.length < 2) {
    throw new RangeError("market overround needs >= 2 selections");
  }
  const { overround, margin } = computeOverround(odds);
  const expected =
    def && def.selections.length > 0 ? def.selections.length : odds.length;
  return {
    marketId: input.marketId,
    selectionCount: odds.length,
    overround,
    margin,
    method:
      expected === 3
        ? "ternary_sum_implied"
        : expected === 2
          ? "binary_sum_implied"
          : `n${odds.length}_sum_implied`,
  };
}
