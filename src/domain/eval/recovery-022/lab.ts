/**
 * TASK 022 orchestrator — acquire → inspect → normalize → match → diagnostic → blind replay.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { acquireTask019, type Acquire019Options } from "@/domain/eval/acquisition-019/sources";
import { mergeUniqueEvents } from "@/domain/eval/acquisition-019/replay";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";
import {
  acquireClosingOddsCsv,
  CLUSTER_NOTE,
  KAGGLE_LICENSE,
  localClosingOddsPath,
  probeAcquisitionChannels,
} from "@/domain/eval/recovery-022/acquire";
import { loadExp022Config } from "@/domain/eval/recovery-022/config";
import { buildSeriesDiagnostic } from "@/domain/eval/recovery-022/diagnostic";
import { buildBeatTheBookieAssessment } from "@/domain/eval/recovery-022/evidence";
import { assertFrozen022 } from "@/domain/eval/recovery-022/leakage";
import {
  gradeMatch,
  matchCorpus,
  subjectFromBtb,
  subjectFromNormalized,
  type MatchSubject022,
} from "@/domain/eval/recovery-022/matching";
import {
  closingRowToResearchAggregates,
  inspectClosingOddsCsv,
  parseClosingOddsLine,
  type ClosingInspect,
} from "@/domain/eval/recovery-022/parse-closing";
import {
  buildSeriesTxt,
  documentedSeriesFixtureMatrix,
  hashSeriesText,
  parseSeriesTxt,
  seriesCellsToRecords,
  SERIES_FIXTURE_FILENAME,
} from "@/domain/eval/recovery-022/parse-series";
import {
  buildAnnualRows,
  marketLifecycleRows,
  runSanityBlindReplay,
  strategyRows022,
} from "@/domain/eval/recovery-022/replay";
import { DATASET_ID_022, PARSER_VERSION_022 } from "@/domain/eval/recovery-022/types";
import type {
  AcquisitionProbe022,
  AnnualRow022,
  Diagnostic022,
  PeriodRow022,
  SourceQuality022,
  StrategyRow022,
} from "@/domain/eval/recovery-022/types";

export type Task022Report = {
  experiment_id: string;
  task: "022";
  dataset_id: typeof DATASET_ID_022;
  parser_version: typeof PARSER_VERSION_022;
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: string;
  verdict: "NO_DEMONSTRATED_EDGE" | "INSUFFICIENT_DATA";
  inspected: true;
  cluster_note: string;
  license: { dataset: string; code: string; redistributed: false };
  probes: AcquisitionProbe022[];
  closing: {
    acquired: boolean;
    path: string | null;
    rows: number;
    dateMin: string | null;
    dateMax: string | null;
    leagues: number;
    top_bookie_labels: number;
    date_only: number;
    timed: number;
    sha256: string | null;
    has_median: boolean;
    has_t_seconds: boolean;
    vs_readme_880k: string;
    vs_kaggle_card: string;
  };
  series: {
    bulk_acquired: false;
    fixture_parsed: true;
    bookmakers: number;
    markets: string[];
    temporal: "RELATIVE_TO_KICKOFF_APPROX";
    strict_candidate_quotes: number;
    usable_strict: 0;
  };
  matching: {
    fd_events: number;
    club_events: number;
    match_exact: number;
    match_probable: number;
    match_ambiguous: number;
    match_failed: number;
  };
  diagnostic: Diagnostic022;
  quality: SourceQuality022[];
  periods: PeriodRow022[];
  annual: AnnualRow022[];
  market_rows: ReturnType<typeof marketLifecycleRows>;
  strategy_rows: StrategyRow022[];
  sanity: ReturnType<typeof runSanityBlindReplay>;
  sample_assessment: string;
  counts: { decisions: number; bets: number; no_bet: number };
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

export type Run022Options = Acquire019Options & {
  closingCsvText?: string;
  skipFullInspect?: boolean;
};

function parseClosingText(text: string): {
  rows: number;
  dateMin: string | null;
  dateMax: string | null;
  leagues: Set<string>;
  books: Set<string>;
  years: Map<number, number>;
  dateOnly: number;
  timed: number;
  sample: ReturnType<typeof parseClosingOddsLine>[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const years = new Map<number, number>();
  const leagues = new Set<string>();
  const books = new Set<string>();
  let rows = 0;
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  let dateOnly = 0;
  let timed = 0;
  const sample: ReturnType<typeof parseClosingOddsLine>[] = [];
  for (const line of lines) {
    const row = parseClosingOddsLine(line);
    if (!row) continue;
    rows += 1;
    if (row.temporal_precision === "DATE_ONLY") dateOnly += 1;
    else timed += 1;
    if (!dateMin || row.match_date < dateMin) dateMin = row.match_date;
    if (!dateMax || row.match_date > dateMax) dateMax = row.match_date;
    leagues.add(row.league);
    if (row.top_home) books.add(row.top_home);
    if (row.top_draw) books.add(row.top_draw);
    if (row.top_away) books.add(row.top_away);
    const y = Number(row.match_date.slice(0, 4));
    if (Number.isFinite(y)) years.set(y, (years.get(y) ?? 0) + 1);
    if (sample.length < 8) sample.push(row);
  }
  return { rows, dateMin, dateMax, leagues, books, years, dateOnly, timed, sample };
}

async function matchStream(
  path: string,
  right: readonly MatchSubject022[],
): Promise<{ exact: number; probable: number; ambiguous: number; failed: number }> {
  const byDate = new Map<string, MatchSubject022[]>();
  for (const r of right) {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  }
  let exact = 0;
  let probable = 0;
  let ambiguous = 0;
  let failed = 0;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const row = parseClosingOddsLine(line);
    if (!row) continue;
    const g = gradeMatch(subjectFromBtb(row), byDate.get(row.match_date) ?? []);
    if (g.grade === "MATCH_EXACT") exact += 1;
    else if (g.grade === "MATCH_PROBABLE") probable += 1;
    else if (g.grade === "MATCH_AMBIGUOUS") ambiguous += 1;
    else failed += 1;
  }
  return { exact, probable, ambiguous, failed };
}

export async function runTask022(options: Run022Options = {}): Promise<Task022Report> {
  const cfg = loadExp022Config();
  assertFrozen022(cfg);

  const probes = await probeAcquisitionChannels(options.allowNetwork === true);
  const downloaded = await acquireClosingOddsCsv(options.allowNetwork === true);
  const cachePath = downloaded.path ?? localClosingOddsPath();

  let inspect: ClosingInspect | null = null;
  const textStats = options.closingCsvText ? parseClosingText(options.closingCsvText) : null;

  if (!options.skipFullInspect && !options.closingCsvText && cachePath) {
    inspect = await inspectClosingOddsCsv(cachePath);
  }

  const seriesTxt = buildSeriesTxt(documentedSeriesFixtureMatrix());
  const parsedSeries = parseSeriesTxt(seriesTxt, SERIES_FIXTURE_FILENAME);
  const seriesRecords = seriesCellsToRecords({
    cells: parsedSeries.cells,
    meta: parsedSeries.meta,
    dataset: "odds_series_fixture",
    league: "England: Premier League",
    home: "Liverpool",
    away: "Chelsea",
    raw_hash: hashSeriesText(seriesTxt),
  });
  const diagnostic = buildSeriesDiagnostic({
    acquiredBulkSeries: false,
    cells: parsedSeries.cells,
  });

  const fd = await acquireTask019({
    allowNetwork: false,
    skipLocalCache: options.skipLocalCache ?? Boolean(options.closingCsvText),
    skipClubIndex: options.skipClubIndex ?? Boolean(options.closingCsvText),
    eplResultsText: options.eplResultsText,
    eplOddsText: options.eplOddsText,
    extraFdcu: options.extraFdcu,
  });
  const fdEvents = mergeUniqueEvents(fd.bundles.flatMap((b) => b.events));
  const right: MatchSubject022[] = [
    ...fdEvents.map(subjectFromNormalized),
    ...fd.clubIndex.map(subjectFromNormalized),
  ];

  let matching = { exact: 0, probable: 0, ambiguous: 0, failed: 0 };
  if (options.closingCsvText && textStats) {
    const left = textStats.sample.filter(Boolean).map((r) => subjectFromBtb(r!));
    const m = matchCorpus(left, right);
    matching = {
      exact: m.exact,
      probable: m.probable,
      ambiguous: m.ambiguous,
      failed: m.failed,
    };
  } else if (cachePath && right.length > 0 && !options.skipFullInspect) {
    matching = await matchStream(cachePath, right);
  }

  const years = inspect?.years ?? textStats?.years ?? new Map<number, number>();
  const annual = buildAnnualRows({ cfg, eventsByYear: years, extraYears: [2016] });
  const rows = inspect?.rows ?? textStats?.rows ?? 0;
  const leagues = inspect?.leagues.size ?? textStats?.leagues.size ?? 0;
  const books = inspect?.topBookies.size ?? textStats?.books.size ?? 0;
  const dateOnly = inspect?.dateOnly ?? textStats?.dateOnly ?? 0;
  const timed = inspect?.timed ?? textStats?.timed ?? 0;

  const sampleRow = textStats?.sample[0] ?? (options.closingCsvText
    ? parseClosingOddsLine(options.closingCsvText.split("\n")[1] ?? "")
    : null);
  const aggregates = sampleRow ? closingRowToResearchAggregates(sampleRow) : [];
  const sanity = runSanityBlindReplay({
    eventId: `btb|${parsedSeries.meta.match_id}`,
    asOf: new Date("2015-10-10T12:00:00.000Z"),
    aggregates,
    seriesRecords,
    outcome: {
      ftHome: parsedSeries.meta.home_score,
      ftAway: parsedSeries.meta.away_score,
    },
  });
  const assessment = buildBeatTheBookieAssessment({
    eventId: `btb|${sampleRow?.match_id ?? parsedSeries.meta.match_id}`,
    asOf: new Date("2015-10-10T12:00:00.000Z"),
    aggregates,
    seriesQuotes: seriesRecords.length,
    strictQuotes: 0,
  });

  const periods: PeriodRow022[] = [
    {
      period: "2000–2015 (README SQL dump)",
      events: 0,
      quotes: 0,
      markets: "1X2 (documented)",
      bookmakers: "up to 32 (documented)",
      timestamp: "odds_datetime in SQL — not acquired",
      strict: 0,
      model_ready: false,
      stato: "NOT_ACQUIRED",
    },
    {
      period: "2005–2015 (closing_odds.csv)",
      events: rows,
      quotes: 0,
      markets: "1X2",
      bookmakers: `${books} top_bookie labels; avg/max research-only`,
      timestamp: "DATE_ONLY",
      strict: 0,
      model_ready: false,
      stato: rows > 0 ? "RESEARCH_ONLY" : "MISSING",
    },
    {
      period: "2015–2016 (odds_series)",
      events: 0,
      quotes: seriesRecords.length,
      markets: "1X2",
      bookmakers: "32 documented",
      timestamp: "RELATIVE_TO_KICKOFF_APPROX (hourly; TZ unknown)",
      strict: 0,
      model_ready: false,
      stato: "SERIES_BULK_NOT_ACQUIRED; fixture STRICT_CANDIDATE",
    },
    {
      period: "2016 (odds_series_b)",
      events: 0,
      quotes: 0,
      markets: "1X2 (documented)",
      bookmakers: "32 documented",
      timestamp: "same hourly generator",
      strict: 0,
      model_ready: false,
      stato: "NOT_ACQUIRED",
    },
  ];

  const quality: SourceQuality022[] = [
    {
      source: "TilenKopac/Kaggle closing_odds.csv",
      rows,
      events: rows,
      bookmakers: books,
      markets: ["1X2"],
      exact_timestamp: 0,
      relative_timestamp: 0,
      date_only: dateOnly,
      unknown: timed,
      match_exact: matching.exact,
      match_ambiguous: matching.ambiguous,
      strict_usable: 0,
      license_status: KAGGLE_LICENSE,
      data_quality: "DATE_ONLY avg/max closing 1X2; not STRICT",
    },
    {
      source: "odds_series TXT (generator + fixture)",
      rows: seriesRecords.length,
      events: 1,
      bookmakers: 32,
      markets: ["1X2"],
      exact_timestamp: 0,
      relative_timestamp: seriesRecords.length,
      date_only: 0,
      unknown: 0,
      match_exact: 0,
      match_ambiguous: 0,
      strict_usable: 0,
      license_status: KAGGLE_LICENSE,
      data_quality: "hourly LOCF; STRICT_CANDIDATE; available_at=null",
    },
  ];

  const yearsInsufficient = annual.filter((a) => a.status !== "VALID").map((a) => a.year);

  return {
    experiment_id: cfg.experiment_id,
    task: "022",
    dataset_id: DATASET_ID_022,
    parser_version: PARSER_VERSION_022,
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: cfg.frozen_model_id,
    verdict: "NO_DEMONSTRATED_EDGE",
    inspected: true,
    cluster_note: CLUSTER_NOTE,
    license: { dataset: KAGGLE_LICENSE, code: "GPL-3.0", redistributed: false },
    probes,
    closing: {
      acquired: Boolean(cachePath) || Boolean(options.closingCsvText),
      path: cachePath,
      rows,
      dateMin: inspect?.dateMin ?? textStats?.dateMin ?? null,
      dateMax: inspect?.dateMax ?? textStats?.dateMax ?? null,
      leagues,
      top_bookie_labels: books,
      date_only: dateOnly,
      timed,
      sha256: inspect?.sha256 ?? null,
      has_median: inspect?.hasMedian ?? false,
      has_t_seconds: inspect?.hasRelativeSeconds ?? false,
      vs_readme_880k: "CSV is paper subset 479,440 (2005–2015), not README 880,494 (2000–2015 SQL)",
      vs_kaggle_card: "Kaggle card 479,440 / 818 leagues / 2005-01-01; measured dateMax=2015-06-30 vs card 2015-07-30",
    },
    series: {
      bulk_acquired: false,
      fixture_parsed: true,
      bookmakers: 32,
      markets: ["1X2"],
      temporal: "RELATIVE_TO_KICKOFF_APPROX",
      strict_candidate_quotes: seriesRecords.length,
      usable_strict: 0,
    },
    matching: {
      fd_events: fdEvents.length,
      club_events: fd.clubIndex.length,
      match_exact: matching.exact,
      match_probable: matching.probable,
      match_ambiguous: matching.ambiguous,
      match_failed: matching.failed,
    },
    diagnostic,
    quality,
    periods,
    annual,
    market_rows: marketLifecycleRows(["1X2"]),
    strategy_rows: strategyRows022(cfg),
    sanity,
    sample_assessment: assessment.narrativeSummary,
    counts: {
      decisions: annual.reduce((s, a) => s + a.decisions, 0),
      bets: 0,
      no_bet: annual.reduce((s, a) => s + a.no_bets, 0),
    },
    scientific: {
      data_available: `closing_rows=${rows}; series_bulk=false; DATE_ONLY dominant; hourly relative fixture only`,
      strict_events: 0,
      strict_quotes: 0,
      model_ready_markets: [],
      years_testable: [],
      years_insufficient: yearsInsufficient,
      total_blind_decisions: 0,
      total_bets: 0,
      profitable_years: [],
      losing_years: [],
      no_bet_years: annual.map((a) => a.year),
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
      tests: 9,
      bonferroni: bonferroniThreshold(0.05, 9),
      any_significant: false,
    },
  };
}

export function loadTask022ReportForUi(): Task022Report | null {
  const p = join(process.cwd(), "artifacts", "task-022-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task022Report;
    if (raw.experiment_id === "exp_022_historical_odds_recovery_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask022(): Promise<Task022Report> {
  return (
    loadTask022ReportForUi() ??
    runTask022({
      allowNetwork: false,
      skipFullInspect: true,
      skipLocalCache: true,
      skipClubIndex: true,
      closingCsvText: SAMPLE_CLOSING_CSV,
    })
  );
}

export const SAMPLE_CLOSING_CSV = `match_id,league,match_date,home_team,home_score,away_team,away_score,avg_odds_home_win,avg_odds_draw,avg_odds_away_win,max_odds_home_win,max_odds_draw,max_odds_away_win,top_bookie_home_win,top_bookie_draw,top_bookie_away_win,n_odds_home_win,n_odds_draw,n_odds_away_win
170088,England: Premier League,2005-01-01,Liverpool,0,Chelsea,1,2.9944,3.1944,2.2256,3.2000,3.2500,2.2900,Paddy Power,Sportingbet,Expekt,9,9,9
170089,England: Premier League,2005-01-01,Fulham,3,Crystal Palace,1,1.9456,3.2333,3.6722,2.0400,3.3000,4.1500,Pinnacle Sports,bet-at-home,Expekt,9,9,9
`;
