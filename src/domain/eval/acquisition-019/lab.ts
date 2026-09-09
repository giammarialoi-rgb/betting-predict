/**
 * TASK 019 orchestrator.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadExp019Config } from "@/domain/eval/acquisition-019/config";
import { matchEvents } from "@/domain/eval/acquisition-019/event-matching";
import { buildMarketCoverage, buildObservationMatrix } from "@/domain/eval/acquisition-019/matrix";
import { acquireTask019, RESEARCHED_SOURCES, type Acquire019Options } from "@/domain/eval/acquisition-019/sources";
import { mergeUniqueEvents, runBlindReplay019 } from "@/domain/eval/acquisition-019/replay";
import type {
  AnnualRow019,
  FailureBudget,
  MarketCoverageRow019,
  MatrixRow,
  SourceCoverageRow019,
} from "@/domain/eval/acquisition-019/types";

export type Task019Report = {
  experiment_id: string;
  task: "019";
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  verdict: "D_DATASET_INSUFFICIENT_FOR_STRICT" | "C_NEGATIVE" | "B_NO_EVIDENCE" | "A_PREDICTIVE" | "E_HOLDOUT_COLLAPSE";
  counts: {
    n_raw: number;
    n_normalized: number;
    n_temporally_valid_strict: number;
    n_temporally_valid_date: number;
    n_model_ready: number;
    n_decisions: number;
    n_bets: number;
    n_no_bet: number;
    n_matched_club: number;
  };
  new_sources: string[];
  new_markets: string[];
  new_bookmakers: string[];
  annual: AnnualRow019[];
  markets: MarketCoverageRow019[];
  sources: SourceCoverageRow019[];
  matrix: MatrixRow[];
  failure_budget: FailureBudget;
  researched_sources: typeof RESEARCHED_SOURCES;
  sample_assessment: string | null;
  policies: {
    flat: "unused";
    fractional_kelly: "unused";
    risk_capped_kelly: "unused";
    actuarial_v1: "unused";
    masaniello_challenger: "unused";
    best_performing_policy: null;
  };
  what_we_know: string[];
  what_we_do_not_know: string[];
  what_blocks_us: string[];
  what_to_acquire_next: string[];
  live_football_data_co_uk: number | null;
};

export async function runTask019(options: Acquire019Options = {}): Promise<Task019Report> {
  const cfg = loadExp019Config();
  const acquired = await acquireTask019(options);
  const events = acquired.bundles.flatMap((b) => b.events);
  const observations = acquired.bundles.flatMap((b) => b.observations);
  const unique = mergeUniqueEvents(events);
  const clubMatch = matchEvents(
    unique.filter((e) => e.sourceId !== "club-football-match-data"),
    acquired.clubIndex,
  );
  acquired.budget.matched_events = clubMatch.matches.length;

  const replay = runBlindReplay019({
    cfg,
    events: unique,
    clubIndex: acquired.clubIndex,
    observations,
  });

  const matrix = buildObservationMatrix(observations, unique);
  const markets = buildMarketCoverage(observations, unique);
  const books = [...new Set(observations.map((o) => o.bookmakerId))].sort();
  const observedMarkets = [...new Set(observations.map((o) => o.marketType))].sort();
  const dateN = observations.filter(
    (o) => o.temporalPrecision === "date" && o.observationKind === "dataset_open",
  ).length;
  const strictN = observations.filter((o) => o.temporalPrecision === "exact").length;

  const newSources = acquired.sourceRows
    .filter(
      (s) =>
        s.acquired &&
        s.sourceId !== "offline-pack-e0" &&
        s.sourceId !== "club-football-match-data",
    )
    .map((s) => s.sourceId);

  return {
    experiment_id: cfg.experiment_id,
    task: "019",
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    verdict: "D_DATASET_INSUFFICIENT_FOR_STRICT",
    counts: {
      n_raw: acquired.budget.parsed_rows + acquired.clubIndex.length,
      n_normalized: unique.length,
      n_temporally_valid_strict: strictN,
      n_temporally_valid_date: dateN,
      n_model_ready: markets.filter((m) => m.model_ready).length,
      n_decisions: replay.decisions,
      n_bets: replay.bets,
      n_no_bet: replay.noBet,
      n_matched_club: clubMatch.matches.length,
    },
    new_sources: newSources,
    new_markets: observedMarkets,
    new_bookmakers: books,
    annual: replay.annual,
    markets,
    sources: acquired.sourceRows,
    matrix,
    failure_budget: acquired.budget,
    researched_sources: RESEARCHED_SOURCES,
    sample_assessment: replay.sampleAssessmentNarrative,
    policies: {
      flat: "unused",
      fractional_kelly: "unused",
      risk_capped_kelly: "unused",
      actuarial_v1: "unused",
      masaniello_challenger: "unused",
      best_performing_policy: null,
    },
    what_we_know: [
      "football-data.co.uk documents OPEN vs CLOSE column semantics and a Friday/Tuesday collection schedule, without per-row clocks",
      "A legitimate GitHub redistribution of those EPL files can be parsed into bookmaker-level 1X2 / OU2.5 / AH observations",
      "Max/Avg/Betbrain columns are aggregates and were skipped",
      "Club-Football remains a secondary event index; its Odd* columns stay TEMPORALLY_UNKNOWN",
      "STRICT_AS_OF still admits 0 bets because no observation has temporalPrecision=exact",
      "Closing odds must not be treated as pre-kickoff available_at",
    ],
    what_we_do_not_know: [
      "The exact clock when any opening quote became available",
      "Whether a given Friday-afternoon collection finished before a specific Saturday kickoff (not claimed)",
      "Bookmaker-level odds for most non-EPL seasons after the live site 503",
      "Corners / cards / player / BTTS / DC as observed bookmaker markets in these files",
      "Source reliability (unmeasured; left null)",
    ],
    what_blocks_us: [
      "Live football-data.co.uk HTTP 503",
      "Absence of Level A (event×book×market×selection×odds×timestamp) public archives without scrape or paid login",
      "ClubElo HTTP 502 at probe time (Elo, not odds)",
      "MODEL_READY gates (exact share, calibration, walk-forward, holdout) correctly fail",
    ],
    what_to_acquire_next: [
      "Authorized bookmaker or exchange history with explicit quote timestamps (Level A)",
      "Live football-data.co.uk CSVs when HTTP 200 returns — do not invent clocks even then",
      "Licensed Betfair historic ticks if a research license is obtained",
      "National federation result feeds only as index/settlement, never as odds",
    ],
    live_football_data_co_uk: acquired.liveFdStatus,
  };
}

export function loadTask019ReportForUi(): Task019Report | null {
  const p = join(process.cwd(), "artifacts", "task-019-result.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Task019Report;
}

export async function loadOrRunTask019(): Promise<Task019Report> {
  const cached = loadTask019ReportForUi();
  if (cached?.experiment_id === "exp_019_historical_market_acquisition_v1") {
    return cached;
  }
  return runTask019({ allowNetwork: false });
}
