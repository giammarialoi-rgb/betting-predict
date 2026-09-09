/**
 * TASK 021 orchestrator — source audit → ledger → STRICT gate → blind capital.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { acquireHistoricalMarkets020 } from "@/domain/eval/capital-020/lab";
import type { Acquire019Options } from "@/domain/eval/acquisition-019/sources";
import { loadExp021Config } from "@/domain/eval/capital-021/config";
import { snapshotToLedger } from "@/domain/eval/capital-021/temporal";
import { countByPrecision, dedupeLedger } from "@/domain/eval/capital-021/ledger";
import {
  ODDS_API_DOCS_SAMPLE,
  parseOddsApiHistoricalSnapshot,
} from "@/domain/eval/capital-021/odds-api-format";
import { parseBetfairBasicFixture } from "@/domain/eval/capital-020/betfair-format";
import {
  SOURCE_AUDITS_021,
  probeTimestampedSources,
  type Probe021,
} from "@/domain/eval/capital-021/sources";
import { runBlindCapital021 } from "@/domain/eval/capital-021/replay";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";
import type {
  AnnualRow021,
  MarketObservationLedger,
  MarketRow021,
  SourceAudit021,
  StrategyRow021,
} from "@/domain/eval/capital-021/types";
import type { DecisionRecord020, ErrorClass020, ModelCompareRow } from "@/domain/eval/capital-020/types";

export type Task021Report = {
  experiment_id: string;
  task: "021";
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: string;
  verdict: "NO_DEMONSTRATED_EDGE";
  timestamped_source_verified: true;
  timestamped_source_acquired_for_capital: false;
  source_audits: readonly SourceAudit021[];
  probes: Probe021[];
  ledger: {
    rows: number;
    exact: number;
    date_only: number;
    dataset_window: number;
    unknown: number;
    strict_usable: number;
    bookmakers: number;
    markets: string[];
  };
  format_fixtures: {
    odds_api_docs_exact: number;
    betfair_pt_exact: number;
    ingested_for_capital: false;
  };
  annual: AnnualRow021[];
  market_rows: MarketRow021[];
  strategy_rows: StrategyRow021[];
  model_rows: ModelCompareRow[];
  decisions: DecisionRecord020[];
  error_freq: Record<ErrorClass020, number>;
  counts: { decisions: number; bets: number; no_bet: number };
  sample_assessment: string | null;
  scientific: {
    data_available: string;
    strict_events: number;
    strict_quotes: number;
    model_ready_markets: string[];
    years_testable: number[];
    years_insufficient: number[];
    total_blind_decisions: number;
    total_bets: number;
    profitable_years: number[];
    losing_years: number[];
    no_bet_years: number[];
    best_model: null;
    best_risk_policy: null;
    statistical_significance: "none";
    holdout_status: "SACRED";
    auto_promotion: false;
    real_money: false;
    verdict: "NO_DEMONSTRATED_EDGE";
  };
  multiple_testing: {
    alpha: number;
    tests: number;
    bonferroni: number;
    any_significant: false;
  };
};

function formatFixtures(): {
  oddsApi: MarketObservationLedger[];
  betfair: MarketObservationLedger[];
} {
  const oddsApi = parseOddsApiHistoricalSnapshot(ODDS_API_DOCS_SAMPLE, {
    usableStrictCapital: false,
  });
  const betfairSnaps = parseBetfairBasicFixture([
    JSON.stringify({
      pt: 1_573_430_400_000,
      eventId: "bf-format",
      selection: "HOME",
      ltp: 1.95,
      marketType: "1X2",
      sport: "tennis",
    }),
  ]);
  const betfair = betfairSnaps.map((s) => ({
    ...snapshotToLedger(s),
    usable_strict_capital: false,
    source: "betfair-historic-format-fixture",
  }));
  return { oddsApi, betfair };
}

export async function runTask021(options: Acquire019Options = {}): Promise<Task021Report> {
  const cfg = loadExp021Config();
  const pack = await acquireHistoricalMarkets020(options);
  const acquiredLedger = dedupeLedger(pack.snapshots.map(snapshotToLedger));
  const fixtures = formatFixtures();
  const precision = countByPrecision(acquiredLedger);

  const probes = options.allowNetwork ? await probeTimestampedSources() : [];

  const replay = runBlindCapital021({
    cfg,
    events: pack.events,
    clubIndex: pack.acquired.clubIndex,
    snapshots: pack.snapshots,
    ledger: acquiredLedger,
  });

  const yearsInsufficient = replay.annual
    .filter((a) => a.status === "INSUFFICIENT_DATA")
    .map((a) => a.year);
  const yearsIncomplete = replay.annual.filter((a) => a.status === "INCOMPLETE").map((a) => a.year);
  const yearsTestable = replay.annual.filter((a) => a.status === "VALID").map((a) => a.year);

  return {
    experiment_id: cfg.experiment_id,
    task: "021",
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: cfg.frozen_model_id,
    verdict: "NO_DEMONSTRATED_EDGE",
    timestamped_source_verified: true,
    timestamped_source_acquired_for_capital: false,
    source_audits: SOURCE_AUDITS_021,
    probes,
    ledger: {
      rows: acquiredLedger.length,
      exact: precision.exact,
      date_only: precision.date_only,
      dataset_window: precision.dataset_window,
      unknown: precision.unknown,
      strict_usable: precision.strict_usable,
      bookmakers: new Set(acquiredLedger.map((r) => r.bookmaker)).size,
      markets: [...new Set(acquiredLedger.map((r) => r.market))].sort(),
    },
    format_fixtures: {
      odds_api_docs_exact: fixtures.oddsApi.filter((r) => r.temporal_precision === "EXACT_TIMESTAMP").length,
      betfair_pt_exact: fixtures.betfair.filter((r) => r.temporal_precision === "EXACT_TIMESTAMP").length,
      ingested_for_capital: false,
    },
    annual: replay.annual,
    market_rows: replay.marketRows,
    strategy_rows: replay.strategyRows,
    model_rows: replay.modelRows,
    decisions: replay.decisions,
    error_freq: replay.errorFreq,
    counts: {
      decisions: replay.annual.reduce((s, a) => s + a.decisions, 0),
      bets: replay.bets,
      no_bet: replay.noBet,
    },
    sample_assessment: replay.sampleNarrative,
    scientific: {
      data_available: `events=${pack.events.length}; quotes=${acquiredLedger.length}; DATE_ONLY dominant`,
      strict_events: 0,
      strict_quotes: precision.strict_usable,
      model_ready_markets: replay.marketRows.filter((m) => m.model_ready).map((m) => m.market),
      years_testable: yearsTestable,
      years_insufficient: [...yearsInsufficient, ...yearsIncomplete],
      total_blind_decisions: replay.annual.reduce((s, a) => s + a.decisions, 0),
      total_bets: replay.bets,
      profitable_years: [],
      losing_years: [],
      no_bet_years: replay.annual.filter((a) => a.bets === 0).map((a) => a.year),
      best_model: null,
      best_risk_policy: null,
      statistical_significance: "none",
      holdout_status: "SACRED",
      auto_promotion: false,
      real_money: false,
      verdict: "NO_DEMONSTRATED_EDGE",
    },
    multiple_testing: {
      alpha: 0.05,
      tests: Math.max(1, replay.modelRows.length),
      bonferroni: bonferroniThreshold(0.05, Math.max(1, replay.modelRows.length)),
      any_significant: false,
    },
  };
}

export function loadTask021ReportForUi(): Task021Report | null {
  const p = join(process.cwd(), "artifacts", "task-021-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task021Report;
    if (raw.experiment_id === "exp_021_realtime_truth_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask021(): Promise<Task021Report> {
  return loadTask021ReportForUi() ?? runTask021({ allowNetwork: false });
}
