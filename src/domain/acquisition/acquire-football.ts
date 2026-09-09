/**
 * Football acquisition orchestrator — 503 is source-specific, not project blocker.
 */

import {
  discoverAcquisitionTargets,
  materializeOfflineArchive,
  runAcquisitionBatch,
  type AcquisitionFileResult,
  type FetchAcquisitionDeps,
} from "@/domain/acquisition/football-data-co-uk";
import { extractMarketObservationsFromRow } from "@/domain/acquisition/multi-market-extract";
import { buildQualityMatrix } from "@/domain/acquisition/quality-matrix";
import { SOURCE_FALLBACK_MATRIX, resolveFallback } from "@/domain/acquisition/fallback-matrix";
import type { MarketObservation } from "@/domain/markets/market-observation";
import { REAL_TRUTH_LAB_E0_CSV } from "@/domain/eval/real-lab/pack-csv";
import { loadRealTruthLabPack } from "@/domain/eval/real-lab/load-pack";
import { parseCsv, parseFootballDataCoUkDate } from "@/providers/football-data-co-uk/parser";
import { resolveFootballDataCoUkTeamId } from "@/providers/football-data-co-uk/team-aliases";
import { datasetDateAnchorUtc } from "@/domain/odds/temporal";
import {
  fetchClubEloDay,
  CLUBELO_FIXTURE_CSV,
  type ClubEloFetchDeps,
  type ClubEloFetchResult,
} from "@/providers/clubelo/adapter";
import { FOOTBALL_DATA_CO_UK_TARGET_DIVISIONS } from "@/domain/sources/provider-status";
import { FOOTBALL_DATA_CO_UK_SOURCE_ID } from "@/providers/football-data-co-uk/bookmakers";
import { assertNotAggregateAsBookmaker } from "@/domain/markets/canonical";

export type AcquireFootballOptions = {
  source?: "football-data-co-uk" | "clubelo" | "all";
  season?: string;
  competition?: string;
  dryRun?: boolean;
  /** When true, skip live HTTP for FD.co.uk and use offline pack. */
  preferOfflinePack?: boolean;
  liveDeps?: FetchAcquisitionDeps;
  clubEloDeps?: ClubEloFetchDeps;
  clubEloDates?: string[];
};

export type SourceAcquisitionRow = {
  source: string;
  acquired: boolean;
  events: number;
  markets: string[];
  bookmakers: string[];
  precision: string;
  problems: string[];
  http_status: number | null;
  content_hash: string | null;
};

export type MarketCoverageRow = {
  market: string;
  observed: boolean;
  events: number;
  books: number;
  temporal_valid: number;
  model_ready: boolean;
};

function eventsFromCsv(csvText: string, competition: string | null): {
  eventIds: string[];
  observations: MarketObservation[];
  aggregatesSkipped: string[];
} {
  const table = parseCsv(csvText);
  const eventIds: string[] = [];
  const observations: MarketObservation[] = [];
  const aggregatesSkipped = new Set<string>();

  for (const row of table.rows) {
    if (!row.Div && !row.Date && !row.HomeTeam) continue;
    if (competition && row.Div && row.Div !== competition) continue;
    const matchDate = parseFootballDataCoUkDate(row.Date ?? "");
    if (!matchDate) continue;
    const home = resolveFootballDataCoUkTeamId(row.HomeTeam ?? "");
    const away = resolveFootballDataCoUkTeamId(row.AwayTeam ?? "");
    if (!home || !away) continue;
    const day = matchDate.toISOString().slice(0, 10);
    const div = row.Div || competition || "E0";
    const eventId = `fdcu|${div}|${day}|${home}|${away}`;
    eventIds.push(eventId);
    const anchor = datasetDateAnchorUtc(matchDate);
    const extracted = extractMarketObservationsFromRow({
      eventId,
      row,
      availableAt: anchor,
      kind: "dataset_open",
    });
    for (const a of extracted.aggregatesSkipped) aggregatesSkipped.add(a);
    for (const o of extracted.observations) {
      try {
        assertNotAggregateAsBookmaker(o.bookmakerId);
        observations.push(o);
      } catch {
        // skip
      }
    }
  }
  return {
    eventIds: [...new Set(eventIds)],
    observations,
    aggregatesSkipped: [...aggregatesSkipped],
  };
}

export async function acquireFootball(options: AcquireFootballOptions = {}) {
  const sourceFilter = options.source ?? "all";
  const dryRun = options.dryRun ?? false;
  const competition = options.competition ?? null;
  const season = options.season ?? "2425";

  const blockers: Array<{
    source: string;
    http_status: number | null;
    reason: string;
    endpoint: string;
    timestamp: string;
  }> = [];
  const sourceRows: SourceAcquisitionRow[] = [];
  let allObservations: MarketObservation[] = [];
  const eventIds = new Set<string>();
  let clubElo: ClubEloFetchResult | null = null;
  const liveResults: AcquisitionFileResult[] = [];

  // --- football-data.co.uk ---
  if (sourceFilter === "all" || sourceFilter === "football-data-co-uk") {
    const preferOffline = options.preferOfflinePack ?? false;
    let offlineUsed = false;

    if (!preferOffline && !dryRun) {
      const divisions = competition
        ? [competition]
        : [...FOOTBALL_DATA_CO_UK_TARGET_DIVISIONS].slice(0, 8);
      const targets = discoverAcquisitionTargets({
        divisions,
        seasonCodes: [season],
      });
      const batch = await runAcquisitionBatch(targets, options.liveDeps);
      liveResults.push(...batch.results);
      for (const r of batch.results) {
        if (r.provider_status === "BLOCKED" || r.provider_status === "NOT_FOUND") {
          blockers.push({
            source: FOOTBALL_DATA_CO_UK_SOURCE_ID,
            http_status: r.http_status,
            reason: r.reason ?? r.provider_status,
            endpoint: r.url,
            timestamp: new Date().toISOString(),
          });
        }
        if (r.provider_status === "OK" && r.csvText) {
          const parsed = eventsFromCsv(r.csvText, r.division);
          for (const id of parsed.eventIds) eventIds.add(id);
          allObservations = allObservations.concat(parsed.observations);
          sourceRows.push({
            source: `${FOOTBALL_DATA_CO_UK_SOURCE_ID}:${r.division}:${r.seasonCode}`,
            acquired: true,
            events: parsed.eventIds.length,
            markets: [...new Set(parsed.observations.map((o) => o.marketType))],
            bookmakers: [
              ...new Set(parsed.observations.map((o) => o.bookmakerId)),
            ],
            precision: "unknown",
            problems: [],
            http_status: 200,
            content_hash: r.content_hash,
          });
        }
      }
    }

    // Offline pack always available as independent historical path when live blocked/empty
    if (eventIds.size === 0 || preferOffline || dryRun) {
      offlineUsed = true;
      const offline = materializeOfflineArchive([
        {
          division: "E0",
          seasonCode: "1920",
          csvText: REAL_TRUTH_LAB_E0_CSV,
          source: "offline_pack",
        },
      ]);
      const parsed = eventsFromCsv(offline[0]!.csvText!, competition ?? "E0");
      for (const id of parsed.eventIds) eventIds.add(id);
      allObservations = allObservations.concat(parsed.observations);
      sourceRows.push({
        source: `${FOOTBALL_DATA_CO_UK_SOURCE_ID}:offline_pack`,
        acquired: true,
        events: parsed.eventIds.length,
        markets: [...new Set(parsed.observations.map((o) => o.marketType))],
        bookmakers: [
          ...new Set(parsed.observations.map((o) => o.bookmakerId)),
        ],
        precision: "unknown",
        problems: offlineUsed
          ? ["live_unavailable_or_prefer_offline", ...parsed.aggregatesSkipped.map((a) => `aggregate_skipped:${a}`)]
          : [],
        http_status: null,
        content_hash: offline[0]!.content_hash,
      });
    }
  }

  // --- ClubElo (independent source) ---
  if (sourceFilter === "all" || sourceFilter === "clubelo") {
    const dates = options.clubEloDates ?? ["2019-08-01", "2023-01-01"];
    let eloObs = 0;
    const problems: string[] = [];
    let hash: string | null = null;
    let http: number | null = null;
    for (const d of dates) {
      const deps: ClubEloFetchDeps = options.clubEloDeps ?? {
        csvText: CLUBELO_FIXTURE_CSV,
      };
      // If no csvText injected and not dry-run, attempt live; on failure fall back fixture
      let result = await fetchClubEloDay(d, deps);
      if (result.provider_status !== "OK" && !options.clubEloDeps?.csvText) {
        blockers.push({
          source: "clubelo",
          http_status: result.http_status,
          reason: result.reason ?? "BLOCKED",
          endpoint: result.url,
          timestamp: new Date().toISOString(),
        });
        result = await fetchClubEloDay(d, { csvText: CLUBELO_FIXTURE_CSV });
        problems.push(`live_failed_fallback_fixture:${d}`);
      }
      clubElo = result;
      eloObs += result.observations.length;
      hash = result.content_hash;
      http = result.http_status;
      if (result.provider_status !== "OK") {
        problems.push(result.reason ?? "failed");
      }
    }
    sourceRows.push({
      source: "clubelo",
      acquired: eloObs > 0,
      events: 0,
      markets: ["elo"],
      bookmakers: [],
      precision: "date",
      problems,
      http_status: http,
      content_hash: hash,
    });
  }

  // Pack cross-check (same offline source — not a third independent events source)
  const pack = loadRealTruthLabPack();

  const books = [...new Set(allObservations.map((o) => o.bookmakerId))];
  const marketTypes = [...new Set(allObservations.map((o) => o.marketType))];

  const marketCoverage: MarketCoverageRow[] = [
    "result",
    "total_goals",
    "both_teams_to_score",
    "team_total_goals",
    "asian_handicap",
    "corners",
    "cards",
    "player_goals",
  ].map((market) => {
    const obs = allObservations.filter((o) => o.marketType === market);
    const ev = new Set(obs.map((o) => o.eventId));
    const bk = new Set(obs.map((o) => o.bookmakerId));
    const temporalValid = obs.filter((o) => o.temporalPrecision === "exact").length;
    return {
      market,
      observed: obs.length > 0,
      events: ev.size,
      books: bk.size,
      temporal_valid: temporalValid,
      model_ready: false,
    };
  });

  const quality = buildQualityMatrix({
    observations: allObservations,
    competition: competition ?? "E0",
  });

  const dataLimited = eventIds.size < 200;

  return {
    experiment_id: "exp_014b_real_data_acquisition_v1",
    dry_run: dryRun,
    data_limited: dataLimited,
    scale: {
      events: eventIds.size,
      markets: marketTypes.length,
      market_observations: allObservations.length,
      bookmakers: books.length,
      competitions: competition ? 1 : new Set([...eventIds].map((e) => e.split("|")[1])).size,
      seasons: 1,
      sources: sourceRows.filter((s) => s.acquired).length,
      raw_payloads_hashed: sourceRows.filter((s) => s.content_hash).length,
      duplicates: quality.reduce((a, r) => a + r.duplicates, 0),
      rejected_records: blockers.length,
      temporal_precision_distribution: {
        exact: allObservations.filter((o) => o.temporalPrecision === "exact").length,
        unknown: allObservations.filter((o) => o.temporalPrecision === "unknown").length,
        dataset_window: allObservations.filter((o) => o.temporalPrecision === "dataset_window").length,
      },
      pack_cross_check_events: pack.events.length,
      clubelo_observations: clubElo?.observations.length ?? 0,
    },
    sources: sourceRows,
    markets: marketCoverage,
    quality_matrix: quality,
    blockers,
    fallback_matrix: SOURCE_FALLBACK_MATRIX.map((r) => ({
      market: r.market,
      resolution: resolveFallback(r.market),
    })),
    data_gaps: [
      "corners: MISSING — no free verified historical odds source acquired",
      "cards: MISSING",
      "player_props: MISSING",
      "BTTS odds: not present in offline pack columns",
      "team_goals odds: not present in offline pack columns",
      "exact temporal precision: unavailable on football-data.co.uk dataset columns",
      dataLimited
        ? `events ${eventIds.size} < 200 — DATA_LIMITED until live multi-division CSV returns 200`
        : null,
    ].filter(Boolean),
    next_highest_eig_acquisition:
      "When football-data.co.uk returns HTTP 200: acquire E0–E3,I1,I2,SP1,SP2,D1,D2,F1,F2 multi-season archives to exceed 200/1000 events with bookmaker-level odds",
    observations: allObservations,
    books,
  };
}

export type AcquireFootballResult = Awaited<ReturnType<typeof acquireFootball>>;
