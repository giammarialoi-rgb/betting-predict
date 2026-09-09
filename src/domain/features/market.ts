import {
  buildMarketBaseline,
  type OneXTwoOdds,
} from "@/domain/odds/baseline";
import {
  computeOverround,
  decimalOddsToImpliedProbability,
} from "@/domain/odds/math";
import { crossBookDispersion } from "@/domain/markets/microstructure";
import type { FeatureCell } from "@/domain/features/types";
import { assertAsOf } from "@/lib/as-of";

export type AsOfBookQuote = {
  bookmakerSlug: string;
  selection: string;
  oddsDecimal: number;
  availableAt: Date;
  temporalPrecision: "exact" | "unknown" | "dataset_window";
  observationKind?: string;
};

/**
 * Market features at decision time — closing excluded unless asOf allows it.
 */
export function buildMarketFeatureCells(input: {
  asOf: Date;
  quotes: readonly AsOfBookQuote[];
  /** If true, include dataset_close / labeled closing rows. */
  allowClosing: boolean;
}): {
  marketImplied: FeatureCell<Record<string, number>>;
  marketOverround: FeatureCell<number>;
  bookmakerDisagreement: FeatureCell<object>;
  bookmakerCount: FeatureCell<number>;
} {
  const usable = input.quotes.filter((q) => {
    if (q.availableAt.getTime() > input.asOf.getTime()) return false;
    assertAsOf(input.asOf, q.availableAt);
    if (
      !input.allowClosing &&
      (q.observationKind === "dataset_close" ||
        q.observationKind === "closing")
    ) {
      return false;
    }
    return true;
  });

  const byBook = new Map<string, Record<string, number>>();
  for (const q of usable) {
    const row = byBook.get(q.bookmakerSlug) ?? {};
    row[q.selection] = q.oddsDecimal;
    byBook.set(q.bookmakerSlug, row);
  }

  const complete: Array<{ bookmakerSlug: string; odds: OneXTwoOdds }> = [];
  for (const [slug, row] of byBook) {
    if (row.HOME && row.DRAW && row.AWAY) {
      complete.push({
        bookmakerSlug: slug,
        odds: { home: row.HOME, draw: row.DRAW, away: row.AWAY },
      });
    }
  }

  if (complete.length === 0) {
    const missing = {
      value: null as null,
      source: "market_snapshots",
      availableAt: null as Date | null,
      temporalPrecision: "unknown" as const,
      status: "MISSING" as const,
    };
    return {
      marketImplied: { featureId: "market_implied_probability", ...missing },
      marketOverround: { featureId: "market_overround", ...missing },
      bookmakerDisagreement: {
        featureId: "bookmaker_disagreement",
        ...missing,
      },
      bookmakerCount: {
        featureId: "bookmaker_count",
        value: byBook.size,
        source: "market_snapshots",
        availableAt: null,
        temporalPrecision: "exact",
        status: byBook.size > 0 ? "STRICT" : "MISSING",
      },
    };
  }

  const baseline = buildMarketBaseline(complete);
  const latestAt = usable.reduce(
    (max, q) => (q.availableAt > max ? q.availableAt : max),
    usable[0]!.availableAt,
  );
  const homeOdds = complete.map((c) => c.odds.home);
  const dispersion = crossBookDispersion(homeOdds);

  return {
    marketImplied: {
      featureId: "market_implied_probability",
      value: baseline.consensusImplied,
      source: "market_snapshots",
      availableAt: latestAt,
      temporalPrecision: "exact",
      status: "STRICT",
    },
    marketOverround: {
      featureId: "market_overround",
      value: computeOverround([
        complete[0]!.odds.home,
        complete[0]!.odds.draw,
        complete[0]!.odds.away,
      ]).overround,
      source: "market_snapshots",
      availableAt: latestAt,
      temporalPrecision: "exact",
      status: "STRICT",
      notes: "per first complete book; use disagreement for cross-book view",
    },
    bookmakerDisagreement: {
      featureId: "bookmaker_disagreement",
      value: {
        odds: baseline.disagreement,
        homeDispersion: dispersion,
        method: baseline.method,
      },
      source: "market_snapshots",
      availableAt: latestAt,
      temporalPrecision: "exact",
      status: "STRICT",
    },
    bookmakerCount: {
      featureId: "bookmaker_count",
      value: complete.length,
      source: "market_snapshots",
      availableAt: latestAt,
      temporalPrecision: "exact",
      status: "STRICT",
    },
  };
}

export function impliedFromOdds(odds: number): number {
  return decimalOddsToImpliedProbability(odds);
}
