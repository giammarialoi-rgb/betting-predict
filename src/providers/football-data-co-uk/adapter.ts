import { PermanentError, RetryableError } from "@/ingest/retry";
import {
  FOOTBALL_DATA_CO_UK_DIVISIONS,
  FOOTBALL_DATA_CO_UK_SOURCE_ID,
  footballDataCoUkCsvUrl,
  type FootballDataCoUkDivisionCode,
} from "./bookmakers";

export function isFootballDataCoUkDivisionCode(value: string): value is FootballDataCoUkDivisionCode {
  return value in FOOTBALL_DATA_CO_UK_DIVISIONS;
}
import { FOOTBALL_DATA_CO_UK_LICENSE } from "./license";
import { parseFootballDataCoUkMatches } from "./parser";
import type {
  HistoricalOddsFetchResult,
  HistoricalOddsProvider,
  HistoricalOddsProviderHealth,
} from "@/providers/odds/types";

export type FootballDataCoUkFetchDeps = {
  fetch?: typeof fetch;
  /** Inject CSV text for tests (skips HTTP). */
  csvText?: string;
};

export class FootballDataCoUkBlockedError extends PermanentError {
  constructor(message: string) {
    super(message, 503);
    this.name = "FootballDataCoUkBlockedError";
  }
}

/**
 * Dataset adapter for football-data.co.uk CSV files.
 * Live download remains BLOCKED/FAILED while the endpoint returns non-200.
 */
export class FootballDataCoUkOddsProvider implements HistoricalOddsProvider {
  readonly id = FOOTBALL_DATA_CO_UK_SOURCE_ID;
  readonly name = "football-data.co.uk Historical Market Baseline";

  constructor(
    private readonly options: {
      seasonCode: string;
      division: FootballDataCoUkDivisionCode;
    },
    private readonly deps: FootballDataCoUkFetchDeps = {},
  ) {}

  async healthCheck(): Promise<HistoricalOddsProviderHealth> {
    if (this.deps.csvText != null) {
      return { ok: true, message: "fixture mode" };
    }
    try {
      const result = await this.downloadCsv();
      if (result.status !== 200) {
        return {
          ok: false,
          message: `football-data.co.uk CSV blocked: HTTP ${result.status}`,
        };
      }
      return { ok: true, message: "csv reachable" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "download failed",
      };
    }
  }

  async fetchOdds(): Promise<HistoricalOddsFetchResult> {
    const fetchedAt = new Date();
    let csvText: string;
    let httpStatus: number | null = null;
    let url: string | null = null;

    if (this.deps.csvText != null) {
      csvText = this.deps.csvText;
    } else {
      const downloaded = await this.downloadCsv();
      httpStatus = downloaded.status;
      url = downloaded.url;
      if (downloaded.status !== 200) {
        throw new FootballDataCoUkBlockedError(
          `football-data.co.uk CSV import BLOCKED: HTTP ${downloaded.status} for ${downloaded.url}. Live season import remains unavailable until the endpoint returns 200.`,
        );
      }
      csvText = downloaded.text;
    }

    const parsed = parseFootballDataCoUkMatches({
      csvText,
      seasonCode: this.options.seasonCode,
      division: this.options.division,
    });

    const snapshots = parsed.matches.flatMap((match) => match.snapshots);

    return {
      fetchedAt,
      sourcePublishedAt: null,
      payload: {
        provider: this.id,
        license: FOOTBALL_DATA_CO_UK_LICENSE,
        seasonCode: this.options.seasonCode,
        division: this.options.division,
        url,
        httpStatus,
        parseStats: parsed.stats,
        matches: parsed.matches.map((match) => ({
          providerEventId: match.providerEventId,
          division: match.division,
          matchDate: match.matchDate.toISOString(),
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeTeamRaw: match.homeTeamRaw,
          awayTeamRaw: match.awayTeamRaw,
          snapshotCount: match.snapshots.length,
        })),
        csvText,
      },
      snapshots,
    };
  }

  private async downloadCsv(): Promise<{
    status: number;
    url: string;
    text: string;
  }> {
    const url = footballDataCoUkCsvUrl(
      this.options.seasonCode,
      this.options.division,
    );
    const fetchImpl = this.deps.fetch ?? globalThis.fetch.bind(globalThis);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "text/csv,text/plain,*/*",
          "User-Agent": "sports-prediction-engine-research/0.1",
        },
      });
      const text = await response.text();
      return { status: response.status, url, text };
    } catch (error) {
      throw new RetryableError(
        error instanceof Error ? error.message : "network error downloading CSV",
      );
    }
  }
}
