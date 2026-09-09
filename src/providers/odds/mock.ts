import type {
  HistoricalOddsFetchResult,
  HistoricalOddsProvider,
  HistoricalOddsProviderHealth,
  HistoricalOddsSnapshot,
} from "@/providers/odds/types";
import type { ObservationKind } from "@/domain/odds/temporal";

export const MOCK_ODDS_PROVIDER_ID = "mock-odds";

export const MOCK_ODDS_EVENT_PROVIDER_ID = "mock-odds-event-x";
export const MOCK_BOOKMAKER_A_SLUG = "mock-book-a";
export const MOCK_BOOKMAKER_B_SLUG = "mock-book-b";

export const MOCK_ODDS_EVENT_KICKOFF = new Date("2026-09-06T20:00:00.000Z");

export const MOCK_ODDS_T1 = new Date("2026-09-06T12:00:00.000Z");
export const MOCK_ODDS_T2 = new Date("2026-09-06T15:00:00.000Z");
export const MOCK_ODDS_T3 = new Date("2026-09-06T19:30:00.000Z");
export const MOCK_ODDS_T4 = new Date("2026-09-06T20:05:00.000Z");

/** Calendar date of Event X — used only for dataset_open/close anchors. */
export const MOCK_ODDS_MATCH_DATE = new Date("2026-09-06T00:00:00.000Z");

function tickSnapshot(
  observedAt: Date,
  bookmakerSlug: string,
  bookmakerName: string,
  home: number,
  draw: number,
  away: number,
): HistoricalOddsSnapshot {
  return {
    providerEventId: MOCK_ODDS_EVENT_PROVIDER_ID,
    bookmakerSlug,
    bookmakerName,
    marketType: "winner",
    observationKind: "exact_tick",
    temporalPrecision: "exact",
    observedAt,
    sourcePublishedAt: observedAt,
    selections: [
      { side: "HOME", oddsDecimal: home },
      { side: "DRAW", oddsDecimal: draw },
      { side: "AWAY", oddsDecimal: away },
    ],
  };
}

function datasetSnapshot(
  kind: Extract<ObservationKind, "dataset_open" | "dataset_close">,
  bookmakerSlug: string,
  bookmakerName: string,
  home: number,
  draw: number,
  away: number,
): HistoricalOddsSnapshot {
  return {
    providerEventId: MOCK_ODDS_EVENT_PROVIDER_ID,
    bookmakerSlug,
    bookmakerName,
    marketType: "winner",
    observationKind: kind,
    temporalPrecision: "unknown",
    observedAt: MOCK_ODDS_MATCH_DATE,
    sourcePublishedAt: null,
    selections: [
      { side: "HOME", oddsDecimal: home },
      { side: "DRAW", oddsDecimal: draw },
      { side: "AWAY", oddsDecimal: away },
    ],
  };
}

/**
 * Default mock:
 * - exact ticks T1–T4 (Book A) + Book B disagreement at T1
 * - dataset_open / dataset_close (Book A + Book B) with unknown precision
 */
export function defaultMockOddsSnapshots(): HistoricalOddsSnapshot[] {
  return [
    tickSnapshot(MOCK_ODDS_T1, MOCK_BOOKMAKER_A_SLUG, "Mock Book A", 2.0, 3.4, 4.0),
    tickSnapshot(MOCK_ODDS_T2, MOCK_BOOKMAKER_A_SLUG, "Mock Book A", 1.8, 3.6, 4.5),
    tickSnapshot(MOCK_ODDS_T3, MOCK_BOOKMAKER_A_SLUG, "Mock Book A", 1.7, 3.8, 5.0),
    tickSnapshot(MOCK_ODDS_T4, MOCK_BOOKMAKER_A_SLUG, "Mock Book A", 1.6, 4.0, 5.5),
    tickSnapshot(MOCK_ODDS_T1, MOCK_BOOKMAKER_B_SLUG, "Mock Book B", 2.2, 3.3, 3.8),
    datasetSnapshot("dataset_open", MOCK_BOOKMAKER_A_SLUG, "Mock Book A", 2.0, 3.4, 4.0),
    datasetSnapshot("dataset_close", MOCK_BOOKMAKER_A_SLUG, "Mock Book A", 1.8, 3.6, 4.5),
    datasetSnapshot("dataset_open", MOCK_BOOKMAKER_B_SLUG, "Mock Book B", 2.2, 3.3, 3.8),
  ];
}

export class MockHistoricalOddsProvider implements HistoricalOddsProvider {
  readonly id = MOCK_ODDS_PROVIDER_ID;
  readonly name = "Mock Historical Odds Provider";

  constructor(
    private readonly snapshots: HistoricalOddsSnapshot[] = defaultMockOddsSnapshots(),
  ) {}

  async healthCheck(): Promise<HistoricalOddsProviderHealth> {
    return { ok: true, message: "mock odds ready" };
  }

  async fetchOdds(): Promise<HistoricalOddsFetchResult> {
    const fetchedAt = new Date();
    return {
      fetchedAt,
      sourcePublishedAt: null,
      payload: {
        provider: this.id,
        eventProviderId: MOCK_ODDS_EVENT_PROVIDER_ID,
        kickoff: MOCK_ODDS_EVENT_KICKOFF.toISOString(),
        snapshots: this.snapshots.map((item) => ({
          ...item,
          observedAt: item.observedAt.toISOString(),
          sourcePublishedAt: item.sourcePublishedAt?.toISOString() ?? null,
        })),
      },
      snapshots: this.snapshots.map((item) => ({
        ...item,
        selections: item.selections.map((selection) => ({ ...selection })),
      })),
    };
  }
}
