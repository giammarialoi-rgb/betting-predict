/**
 * TASK 024 orchestrator — acquire → parse → temporal audit → STRICT ledger.
 * Replay only if STRICT >= 100 (this run does not).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { acquireSoccerParquetIfMissing, probeTask024, seriesBulkAcquired } from "@/domain/eval/attack-024/acquire";
import { nextDataBlockers, rejectBuckets } from "@/domain/eval/attack-024/blockers";
import { btbSeriesCase, figure2bPrematchBins } from "@/domain/eval/attack-024/btb-semantics";
import { loadExp024Config } from "@/domain/eval/attack-024/config";
import { buildAttack024Assessment } from "@/domain/eval/attack-024/evidence";
import { buildGateTrace } from "@/domain/eval/attack-024/gates";
import { runHostileBattery024 } from "@/domain/eval/attack-024/leakage";
import { buildStrictLedgerFromBetfairFixture } from "@/domain/eval/attack-024/ledger";
import { clusterCount, LINEAGE } from "@/domain/eval/attack-024/lineage";
import {
  classifySoccerSample,
  loadSoccerAudit,
  loadSoccerSamples,
  soccerParquetAcquired,
  verifySoccerParquet,
} from "@/domain/eval/attack-024/soccer-audit";
import {
  DATASET_ID_024,
  PARSER_VERSION_024,
  STRICT_EVENT_GATE,
} from "@/domain/eval/attack-024/types";
import type {
  AcquisitionProbe024,
  AnnualRow024,
  FileHashCheck024,
  GateTrace024,
  InventoryRow024,
  SoccerAudit024,
  Task024Verdict,
  TemporalAuditRow024,
} from "@/domain/eval/attack-024/types";
import { ACQUIRED_CLOSING_SHA256, CLOSING_ODDS_CACHE } from "@/domain/eval/recovery-022/acquire";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";

/** Measured TASK 022 closing_odds.csv row count (DATE_ONLY). Not re-parsed here. */
export const BTB_CLOSING_EVENTS = 479_440;
/** TASK 021 football-data.co.uk DATE_ONLY corpus. */
export const FD_EVENTS = 13_247;
export const FD_QUOTES = 341_637;

export type Task024Report = {
  experiment_id: string;
  task: "024";
  dataset_id: typeof DATASET_ID_024;
  parser_version: typeof PARSER_VERSION_024;
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: string;
  verdict: Task024Verdict;
  success: "A" | "B" | "FAILURE";
  inspected: true;
  probes: AcquisitionProbe024[];
  soccer_download: { downloaded: string[]; skipped: string[]; failed: { file: string; note: string }[] };
  soccer_files: FileHashCheck024[];
  soccer: SoccerAudit024;
  btb_closing_acquired: boolean;
  btb_series_acquired: boolean;
  btb_series_case: ReturnType<typeof btbSeriesCase>;
  figure2b_bins: { php0: number; matlab1: number; relative_hours: number }[];
  gates: GateTrace024[];
  inventory: InventoryRow024[];
  temporal_audit_sample: TemporalAuditRow024[];
  strict_ledger: ReturnType<typeof buildStrictLedgerFromBetfairFixture>;
  rejects: ReturnType<typeof rejectBuckets>;
  next_blockers: ReturnType<typeof nextDataBlockers>;
  lineage_clusters: number;
  lineage: typeof LINEAGE;
  leakage: { id: string; throws: boolean }[];
  annual: AnnualRow024[];
  assessment: ReturnType<typeof buildAttack024Assessment>;
  metrics: {
    datasets_acquired: number;
    events_listed: number;
    odds_listed: number;
    quotes_exact_timestamp: number;
    kickoff_exact: number;
    temporal_relation_proven: number;
    strict_events: number;
    events_rejected: number;
    lineage_clusters: number;
    markets_strict: string[];
    first_testable_year: number | null;
    models_tested: string[];
    blind_bets: number;
    edge_demonstrated: false;
    bankroll_testable: false;
  };
  scientific: {
    data_available: string;
    strict_events: number;
    strict_gate: number;
    years_testable: number[];
    years_insufficient: number[];
    total_bets: 0;
    best_model: null;
    best_risk_policy: null;
    holdout_status: "SACRED";
    primary_blocker: string;
    next_action: string;
    verdict: Task024Verdict;
  };
  walk_forward: {
    train: number[];
    validation: number[];
    test: number[];
    holdout: number[];
    holdout_used_for_selection: false;
    replay_launched: false;
  };
  multiple_testing: { alpha: number; tests: number; bonferroni: number; any_significant: false };
};

export function decideVerdict(input: {
  strictEvents: number;
  datasetsAcquired: number;
}): Task024Verdict {
  if (input.strictEvents >= STRICT_EVENT_GATE) return "STRICT_DATA_FOUND";
  if (input.strictEvents > 0) return "PARTIAL_STRICT";
  if (input.datasetsAcquired === 0) return "ACQUISITION_BLOCKED";
  return "NO_STRICT_DATA";
}

function annualInsufficient(years: number[]): AnnualRow024[] {
  return years.map((year) => ({
    year,
    start_bankroll: 1000,
    bets: 0,
    turnover: null,
    gross_profit: null,
    net_profit: null,
    end_bankroll: null,
    roi: null,
    max_drawdown: null,
    number_of_bets: 0,
    no_bet_count: 0,
    events: 0,
    strict_events: 0,
    status: year === 2026 ? "INCOMPLETE" : "INSUFFICIENT_DATA",
  }));
}

export async function runTask024(opts?: { allowNetwork?: boolean }): Promise<Task024Report> {
  const cfg = loadExp024Config();
  const soccerDownload = await acquireSoccerParquetIfMissing(opts?.allowNetwork === true);
  const probes = await probeTask024(opts?.allowNetwork === true);
  const soccer = loadSoccerAudit();
  const soccerFiles = verifySoccerParquet(soccer);
  const soccerAcquired = soccerParquetAcquired(soccerFiles);
  const samples = loadSoccerSamples();
  const temporal_audit_sample = samples.map(classifySoccerSample);
  const ledger = buildStrictLedgerFromBetfairFixture();
  const btbClosing = existsSync(CLOSING_ODDS_CACHE);
  const btbSeries = seriesBulkAcquired();
  const seriesCase = btbSeriesCase({
    bulkAcquired: btbSeries,
    hasAbsoluteDatetime: false,
    timezoneProven: false,
    generatorRelativeDocumented: true,
  });
  const datasetsAcquired =
    (soccerAcquired ? 1 : 0) + (btbClosing ? 1 : 0) + (ledger.length > 0 ? 1 : 0);
  const strictEvents = ledger.length;
  const verdict = decideVerdict({ strictEvents, datasetsAcquired });
  const success: Task024Report["success"] =
    strictEvents >= STRICT_EVENT_GATE ? "A" : datasetsAcquired > 0 ? "B" : "FAILURE";

  const gates: GateTrace024[] = [
    buildGateTrace({
      sourceId: "football-data-co-uk",
      exists: true,
      acquired: true,
      parsed: true,
      hasTimestamp: false,
      kickoff: "DATE_ONLY",
      quote: "DATE_ONLY",
      relation: "UNKNOWN",
      temporal_class: "DATE_ONLY",
      note: "Friday collection date; closing C columns; not quote < kickoff",
    }),
    buildGateTrace({
      sourceId: "beatthebookie-closing",
      exists: true,
      acquired: btbClosing,
      parsed: btbClosing,
      hasTimestamp: false,
      kickoff: "DATE_ONLY",
      quote: "DATE_ONLY",
      relation: "UNKNOWN",
      temporal_class: "DATE_ONLY",
      note: `closing_odds.csv n=${BTB_CLOSING_EVENTS}; sha256=${ACQUIRED_CLOSING_SHA256}`,
    }),
    buildGateTrace({
      sourceId: "beatthebookie-series",
      exists: true,
      acquired: btbSeries,
      parsed: false,
      hasTimestamp: false,
      kickoff: "UNKNOWN",
      quote: "RELATIVE",
      relation: "UNKNOWN",
      temporal_class: btbSeries ? "RELATIVE_UNVERIFIED_TZ" : "NOT_ACQUIRED",
      note: seriesCase.note,
    }),
    buildGateTrace({
      sourceId: "soccer-dataset",
      exists: true,
      acquired: soccerAcquired,
      parsed: true,
      hasTimestamp: true,
      kickoff: "EXACT",
      quote: "EXACT",
      relation: "QUOTE_EQUALS_KICKOFF",
      temporal_class: "CLOSING_AT_KICKOFF",
      note: `known_at == date_utc on ${soccer.known_at_eq_kickoff}/${soccer.odds_rows} odds rows; dictionary closing line`,
    }),
    buildGateTrace({
      sourceId: "betfair-historic-official",
      exists: true,
      acquired: false,
      parsed: false,
      hasTimestamp: true,
      kickoff: "EXACT",
      quote: "EXACT",
      relation: "UNKNOWN",
      temporal_class: "NOT_ACQUIRED",
      note: "BASIC £0 + login; not used",
    }),
    buildGateTrace({
      sourceId: "betfair-historic-mirror",
      exists: true,
      acquired: true,
      parsed: true,
      hasTimestamp: true,
      kickoff: "EXACT",
      quote: "EXACT",
      relation: "QUOTE_BEFORE_KICKOFF",
      temporal_class: "STRICT_PREMATCH",
      note: "petermclagan football BASIC sample; 1 EPL MATCH_ODDS event",
    }),
    buildGateTrace({
      sourceId: "zenodo-tale-of-two-markets",
      exists: true,
      acquired: false,
      parsed: true,
      hasTimestamp: false,
      kickoff: "DATE_ONLY",
      quote: "DATE_ONLY",
      relation: "UNKNOWN",
      temporal_class: "DATE_ONLY",
      note: "README: football-data.co.uk redistribution collected 2022-05-22 — same FD cluster",
    }),
  ];

  const inventory: InventoryRow024[] = [
    {
      source: "football-data.co.uk",
      events: FD_EVENTS,
      odds: FD_QUOTES,
      exact_timestamp: false,
      exact_kickoff: false,
      temporal_relation_proven: false,
      strict: 0,
      independence: "upstream (lineageRoot football-data.co.uk)",
      status: "DATE_ONLY",
    },
    {
      source: "BeatTheBookie closing_odds.csv",
      events: btbClosing ? BTB_CLOSING_EVENTS : 0,
      odds: btbClosing ? BTB_CLOSING_EVENTS : 0,
      exact_timestamp: false,
      exact_kickoff: false,
      temporal_relation_proven: false,
      strict: 0,
      independence: "REDISTRIBUTION of Lisandro79/BeatTheBookie",
      status: btbClosing ? "DATE_ONLY" : "NOT_ACQUIRED",
    },
    {
      source: "BeatTheBookie odds_series / odds_series_b / SQL",
      events: 0,
      odds: 0,
      exact_timestamp: false,
      exact_kickoff: false,
      temporal_relation_proven: false,
      strict: 0,
      independence: "same BeatTheBookie root",
      status: "NOT_ACQUIRED",
    },
    {
      source: "eatpizzanot/soccer-dataset",
      events: soccer.odds_fixtures,
      odds: soccer.odds_rows,
      exact_timestamp: true,
      exact_kickoff: "mixed",
      temporal_relation_proven: "equals_kickoff",
      strict: 0,
      independence: "DERIVED (API-Football + football-data.co.uk + The-Odds-API)",
      status: "CLOSING_AT_KICKOFF",
    },
    {
      source: "Betfair Historic official BASIC",
      events: 0,
      odds: 0,
      exact_timestamp: true,
      exact_kickoff: true,
      temporal_relation_proven: false,
      strict: 0,
      independence: "OFFICIAL historicdata.betfair.com",
      status: "ACQUISITION_BLOCKED",
    },
    {
      source: "Betfair Historic GitHub MIRROR",
      events: 1,
      odds: ledger.length > 0 ? 3 : 0,
      exact_timestamp: true,
      exact_kickoff: true,
      temporal_relation_proven: true,
      strict: strictEvents,
      independence: "MIRROR of historicdata.betfair.com",
      status: strictEvents > 0 ? "PARTIAL_STRICT" : "INSUFFICIENT_DATA",
    },
    {
      source: "Zenodo 10.5281/zenodo.12673394",
      events: 0,
      odds: 0,
      exact_timestamp: false,
      exact_kickoff: false,
      temporal_relation_proven: false,
      strict: 0,
      independence: "REDISTRIBUTION of football-data.co.uk",
      status: "NOT_ACQUIRED (semantics proven; FD cluster)",
    },
  ];

  const rejects = rejectBuckets({
    soccerOddsFixtures: soccer.odds_fixtures,
    soccerMidnightFixtures: soccer.odds_fixtures_midnight,
    soccerClockFixtures: soccer.odds_fixtures_clock,
    soccerOddsRows: soccer.odds_rows,
    btbClosingEvents: btbClosing ? BTB_CLOSING_EVENTS : 0,
    btbSeriesAcquired: btbSeries,
    betfairOfficialEvents: 0,
    strictEvents,
  });
  const blockers = nextDataBlockers(strictEvents);
  const eventsRejected = rejects.reduce((s, r) => s + r.events, 0);
  const quotesExact =
    soccer.odds_rows + (strictEvents > 0 ? 1 : 0);
  const kickoffExact = soccer.odds_fixtures_clock + strictEvents;
  const relationProven = soccer.odds_rows + strictEvents;
  const annual = annualInsufficient(cfg.solar_years);
  const asOf = new Date("2017-04-30T12:05:00.000Z");
  const assessment = buildAttack024Assessment({
    asOf,
    strictEvents,
    soccerOddsFixtures: soccer.odds_fixtures,
  });
  const f2b = figure2bPrematchBins().map((b) => ({
    php0: b.php0,
    matlab1: b.matlab1,
    relative_hours: b.relative_hours,
  }));

  return {
    experiment_id: cfg.experiment_id,
    task: "024",
    dataset_id: DATASET_ID_024,
    parser_version: PARSER_VERSION_024,
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: cfg.frozen_model_id,
    verdict,
    success,
    inspected: true,
    probes,
    soccer_download: soccerDownload,
    soccer_files: soccerFiles,
    soccer,
    btb_closing_acquired: btbClosing,
    btb_series_acquired: btbSeries,
    btb_series_case: seriesCase,
    figure2b_bins: f2b,
    gates,
    inventory,
    temporal_audit_sample,
    strict_ledger: ledger,
    rejects,
    next_blockers: blockers,
    lineage_clusters: clusterCount(),
    lineage: LINEAGE,
    leakage: runHostileBattery024(samples.find((s) => !s.kickoff_midnight) ?? samples[0]!),
    annual,
    assessment,
    metrics: {
      datasets_acquired: datasetsAcquired,
      events_listed: FD_EVENTS + (btbClosing ? BTB_CLOSING_EVENTS : 0) + soccer.fixtures + 1,
      odds_listed: FD_QUOTES + (btbClosing ? BTB_CLOSING_EVENTS : 0) + soccer.odds_rows,
      quotes_exact_timestamp: quotesExact,
      kickoff_exact: kickoffExact,
      temporal_relation_proven: relationProven,
      strict_events: strictEvents,
      events_rejected: eventsRejected,
      lineage_clusters: clusterCount(),
      markets_strict: strictEvents > 0 ? ["MATCH_ODDS"] : [],
      first_testable_year: null,
      models_tested: [],
      blind_bets: 0,
      edge_demonstrated: false,
      bankroll_testable: false,
    },
    scientific: {
      data_available: `soccer_odds_fixtures=${soccer.odds_fixtures}; soccer_odds_rows=${soccer.odds_rows}; known_at_eq_kickoff=${soccer.known_at_eq_kickoff}; btb_closing=${btbClosing ? BTB_CLOSING_EVENTS : 0}; btb_series=${btbSeries}; betfair_mirror_strict=${strictEvents}; official_betfair=0`,
      strict_events: strictEvents,
      strict_gate: STRICT_EVENT_GATE,
      years_testable: [],
      years_insufficient: annual.map((a) => a.year),
      total_bets: 0,
      best_model: null,
      best_risk_policy: null,
      holdout_status: "SACRED",
      primary_blocker:
        "Official Betfair Historic BASIC is login-gated (credentials not used). BeatTheBookie odds_series / odds_series_b / SQL remain NOT_ACQUIRED (Dropbox HTML / Drive). soccer-dataset known_at equals date_utc on all 213,983 odds rows (closing, not STRICT prematch).",
      next_action: blockers[0]?.action ?? "",
      verdict,
    },
    walk_forward: {
      train: cfg.train_years,
      validation: cfg.val_years,
      test: cfg.test_years,
      holdout: cfg.holdout_years,
      holdout_used_for_selection: false,
      replay_launched: false,
    },
    multiple_testing: {
      alpha: 0.05,
      tests: 7,
      bonferroni: bonferroniThreshold(0.05, 7),
      any_significant: false,
    },
  };
}

export function loadTask024ReportForUi(): Task024Report | null {
  const p = join(process.cwd(), "artifacts", "task-024-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task024Report;
    if (raw.experiment_id === "exp_024_historical_data_attack_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask024(): Promise<Task024Report> {
  return loadTask024ReportForUi() ?? runTask024({ allowNetwork: false });
}
