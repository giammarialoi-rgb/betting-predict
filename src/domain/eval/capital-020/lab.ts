/**
 * TASK 020 orchestrator — acquire → snapshot → lineage → blind capital.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { acquireTask019, type Acquire019Options } from "@/domain/eval/acquisition-019/sources";
import { mergeUniqueEvents } from "@/domain/eval/acquisition-019/replay";
import { matchEvents } from "@/domain/eval/acquisition-019/event-matching";
import { CATALOGUED_MARKETS } from "@/domain/eval/acquisition-019/columns";
import { evaluateModelReadyGates } from "@/domain/markets/model-ready-gates";
import { loadExp020Config } from "@/domain/eval/capital-020/config";
import {
  GITHUB_REPO_AUDITS,
  lineageFor019Source,
  uniqueUpstreamClusters,
} from "@/domain/eval/capital-020/lineage";
import { dedupeSnapshots, observation019ToSnapshot, SPORT_ADAPTER_STATUS } from "@/domain/eval/capital-020/snapshot";
import { isStrictCapitalClass } from "@/domain/eval/capital-020/temporal-gate";
import { runBlindCapital020 } from "@/domain/eval/capital-020/replay";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";
import type { Task020Report } from "@/domain/eval/capital-020/report-types";
import type { MarketSnapshot, SourceLineage } from "@/domain/eval/capital-020/types";
import type { NormalizedEvent } from "@/domain/eval/acquisition-019/types";
import type { Acquired019 } from "@/domain/eval/acquisition-019/sources";

export type { Task020Report };

export type Acquired020 = {
  acquired: Acquired019;
  events: NormalizedEvent[];
  snapshots: MarketSnapshot[];
  lineages: SourceLineage[];
  clubMatchCount: number;
};

function catalogAlias(market: string): string[] {
  if (market === "TOTAL_GOALS") return ["TOTAL_GOALS", "OU25"];
  if (market === "ASIAN_HANDICAP") return ["ASIAN_HANDICAP", "AH"];
  return [market];
}

function modelReadyFlag(market: string, snapshots: readonly MarketSnapshot[]): boolean {
  const rows = snapshots.filter((s) => catalogAlias(s.marketType).includes(market) || s.marketType === market);
  const exactN = rows.filter((s) => isStrictCapitalClass(s.temporalClass)).length;
  const books = new Set(rows.map((s) => s.bookmaker)).size;
  const gate = evaluateModelReadyGates({
    market,
    line: market === "OU25" || market === "TOTAL_GOALS" ? 2.5 : null,
    sampleSize: rows.length,
    dataCompleteness: rows.length > 0 ? 1 : 0,
    temporalIntegrity: exactN > 0,
    exactPrecisionShare: rows.length ? exactN / rows.length : 0,
    bookmakerCoverage: books,
    outcomeCompleteness: 1,
    featureAvailability: 0.8,
    calibrationOk: null,
    walkForwardStable: null,
    holdoutPerformanceOk: null,
  });
  return gate.status === "MODEL_READY";
}

export async function acquireHistoricalMarkets020(
  options: Acquire019Options = {},
): Promise<Acquired020> {
  const acquired = await acquireTask019(options);
  const events = mergeUniqueEvents(acquired.bundles.flatMap((b) => b.events));
  const snapshots = dedupeSnapshots(
    acquired.bundles.flatMap((b) => b.observations).map((o) => observation019ToSnapshot(o)),
  );
  const clubMatch = matchEvents(
    events.filter((e) => e.sourceId !== "club-football-match-data"),
    acquired.clubIndex,
  );
  const lineages = acquired.sourceRows.map((s) =>
    lineageFor019Source(s.sourceId, acquired.retrievedAt),
  );
  return {
    acquired,
    events,
    snapshots,
    lineages,
    clubMatchCount: clubMatch.matches.length,
  };
}

export async function runTask020(options: Acquire019Options = {}): Promise<Task020Report> {
  const cfg = loadExp020Config();
  const pack = await acquireHistoricalMarkets020(options);
  const { acquired, events, snapshots, lineages } = pack;

  const replay = runBlindCapital020({
    cfg,
    events,
    clubIndex: acquired.clubIndex,
    snapshots,
  });

  const exactN = snapshots.filter((s) => isStrictCapitalClass(s.temporalClass)).length;
  const dateN = snapshots.filter((s) => s.temporalClass === "DATE_ONLY").length;
  const books = [...new Set(snapshots.map((s) => s.bookmaker))].sort();
  const observedMarkets = [...new Set(snapshots.map((s) => s.marketType))].sort();
  const observedCatalog = new Set(observedMarkets.flatMap(catalogAlias));

  const readyKeys = [
    ...observedCatalog,
    "BTTS",
    "CORNERS",
    "CARDS",
    "DC",
    "DNB",
  ];
  const modelReady = Object.fromEntries(
    [...new Set(readyKeys)].map((m) => [m, modelReadyFlag(m, snapshots)]),
  );

  const catalogGap = CATALOGUED_MARKETS.filter((m) => !observedCatalog.has(m));

  return {
    experiment_id: cfg.experiment_id,
    task: "020",
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: cfg.frozen_model_id,
    verdict: "NO_DEMONSTRATED_EDGE",
    dataset: {
      events_normalized: events.length,
      events_matched_club: pack.clubMatchCount,
      club_index: acquired.clubIndex.length,
      quotes: snapshots.length,
      bookmakers: books.length,
      exact_timestamp: exactN,
      date_only: dateN,
      strict_usable: exactN,
      observed_markets: observedMarkets,
      competitions: [...new Set(events.map((e) => e.competition))].sort(),
    },
    lineage: {
      rows: lineages,
      upstream_clusters: uniqueUpstreamClusters(lineages),
    },
    github_audits: GITHUB_REPO_AUDITS,
    sport_adapters: SPORT_ADAPTER_STATUS,
    model_ready: modelReady,
    catalogued_unobserved: [...catalogGap],
    annual: replay.annual,
    model_rows: replay.modelRows,
    decisions: replay.decisions,
    error_freq: replay.errorFreq,
    policies: {
      flat: "unused",
      fractional_kelly: "unused",
      risk_capped_kelly: "unused",
      actuarial_v1: "unused",
      masaniello_challenger: "unused",
      best: null,
    },
    multiple_testing: {
      alpha: 0.05,
      tests: replay.modelRows.length || 1,
      bonferroni: bonferroniThreshold(0.05, Math.max(1, replay.modelRows.length)),
      any_significant: false,
    },
    counts: {
      decisions: replay.annual.reduce((s, a) => s + a.decisions, 0),
      bets: replay.bets,
      no_bet: replay.noBet,
    },
    sample_assessment: replay.sampleNarrative,
    live_football_data_co_uk: acquired.liveFdStatus,
    better_than_date_only: {
      found_format: true,
      format: "Betfair historic stream publishTime (pt)",
      ingested_for_capital: false,
      reason:
        "official archive is paid / ToS-restricted; public GitHub sample not licensed for STRICT capital",
    },
  };
}

export function loadTask020ReportForUi(): Task020Report | null {
  const p = join(process.cwd(), "artifacts", "task-020-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task020Report;
    if (raw.experiment_id === "exp_020_historical_capital_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask020(): Promise<Task020Report> {
  return loadTask020ReportForUi() ?? runTask020({ allowNetwork: false });
}
