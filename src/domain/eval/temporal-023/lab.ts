/**
 * TASK 023 orchestrator — acquire → inspect → as-of → blind lock → measure.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";
import { FOOTBALL_JSON_CACHE, probeTask023 } from "@/domain/eval/temporal-023/acquire";
import { matchOddsFixturePath, loadExp023Config } from "@/domain/eval/temporal-023/config";
import { costTable, EXPECTED_INFORMATION_GAIN } from "@/domain/eval/temporal-023/cost";
import { runHostileBattery } from "@/domain/eval/temporal-023/leakage";
import { parseMcmNdjson } from "@/domain/eval/temporal-023/parse-mcm";
import { buildAnnualRows023, matchOddsLifecycle, runBlindLock023 } from "@/domain/eval/temporal-023/replay";
import {
  DATASET_ID_023,
  FULL_FOOTBALL_SAMPLE_SHA256,
  MATCH_ODDS_FIXTURE_SHA256,
  PARSER_VERSION_023,
} from "@/domain/eval/temporal-023/types";
import type {
  AcquisitionProbe023,
  AnnualRow023,
  CostRow023,
  ParsedStream023,
  SourceClass023,
  Task023Verdict,
} from "@/domain/eval/temporal-023/types";

export type Task023Report = {
  experiment_id: string;
  task: "023";
  dataset_id: typeof DATASET_ID_023;
  parser_version: typeof PARSER_VERSION_023;
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: string;
  verdict: Task023Verdict;
  inspected: true;
  official_bulk_acquired: false;
  source_class_primary: SourceClass023;
  probes: AcquisitionProbe023[];
  fixture: {
    path: string;
    lines: number;
    bytes: number;
    sha256: string;
    sha256_expected: typeof MATCH_ODDS_FIXTURE_SHA256;
  };
  full_sample: {
    acquired: boolean;
    path: string | null;
    bytes: number | null;
    sha256: string | null;
    sha256_expected: typeof FULL_FOOTBALL_SAMPLE_SHA256;
    lines: number;
    markets: number;
    events: number;
    ltp_ticks: number;
    batb: number;
    atb: number;
    atl: number;
  };
  match_odds: {
    marketId: string;
    eventId: string;
    eventName: string;
    kickoff: string;
    timezone_field: string | null;
    prematch: number;
    inplay: number;
    postmatch: number;
    unknown: number;
    timestamp_observations: number;
  };
  coverage: { window: string; requested: number; available: number; coverage: number }[];
  first_available: ReturnType<typeof runBlindLock023>["first_available"];
  windows: ReturnType<typeof runBlindLock023>["windows_home"];
  blind: ReturnType<typeof runBlindLock023>;
  leakage: { id: string; throws: boolean }[];
  annual: AnnualRow023[];
  market_row: ReturnType<typeof matchOddsLifecycle>;
  models: ReturnType<typeof runBlindLock023>["models"];
  cost: CostRow023[];
  expected_information_gain: typeof EXPECTED_INFORMATION_GAIN;
  quality: {
    source: string;
    events: number;
    markets: number;
    timestamps: number;
    prematch_timestamps: number;
    inplay_timestamps: number;
    postmatch_timestamps: number;
    exact_timestamp: number;
    unknown_timestamp: number;
    median_interval: number | null;
    coverage_note: string;
    strict_events: number;
    license: string;
    cost: string;
    data_quality: string;
  };
  sources_table: {
    source: string;
    period: string;
    events: number;
    markets: number;
    timestamp: string;
    strict: number;
    cost: string;
    status: string;
  }[];
  counts: { decisions: number; bets: number; no_bet: number; strict_events: number };
  scientific: {
    data_available: string;
    strict_events: number;
    official_strict_events: number;
    timestamp_observations: number;
    acceptance_100_events: false;
    model_ready_markets: string[];
    years_testable: number[];
    years_insufficient: number[];
    total_blind_decisions: number;
    total_bets: number;
    best_model: null;
    best_risk_policy: null;
    statistical_significance: string;
    holdout_status: "SACRED";
    clv_home_implied_delta: number | null;
    verdict: Task023Verdict;
  };
  multiple_testing: { alpha: number; tests: number; bonferroni: number; any_significant: false };
  walk_forward: {
    train: number[];
    validation: number[];
    test: number[];
    holdout: number[];
    holdout_used_for_selection: false;
  };
};

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function decideVerdict(input: {
  officialBulk: boolean;
  strictEvents: number;
  timestampObs: number;
  formatValid: boolean;
}): Task023Verdict {
  if (!input.formatValid) return "DATA_INVALID";
  if (input.officialBulk && input.strictEvents >= 100 && input.timestampObs >= 1000) {
    return "STRICT_UNLOCKED";
  }
  if (input.strictEvents > 0 && input.timestampObs >= 1 && input.formatValid) {
    return "PARTIAL_STRICT";
  }
  if (!input.officialBulk && input.strictEvents === 0) return "ACQUISITION_BLOCKED";
  return "INSUFFICIENT_DATA";
}

export async function runTask023(opts?: { allowNetwork?: boolean }): Promise<Task023Report> {
  const cfg = loadExp023Config();
  const probes = await probeTask023(opts?.allowNetwork === true);
  const fixturePath = matchOddsFixturePath();
  const fixtureBuf = readFileSync(fixturePath);
  const fixtureText = fixtureBuf.toString("utf8");
  const fixtureParsed = parseMcmNdjson(fixtureText);

  let fullParsed: ParsedStream023 | null = null;
  let fullBuf: Buffer | null = null;
  if (existsSync(FOOTBALL_JSON_CACHE)) {
    fullBuf = readFileSync(FOOTBALL_JSON_CACHE);
    fullParsed = parseMcmNdjson(fullBuf.toString("utf8"));
  }

  const blind = runBlindLock023({ cfg, parsed: fixtureParsed });
  const tickPhases = {
    prematch: fixtureParsed.ticks.filter((t) => t.phase === "PREMATCH").length,
    inplay: fixtureParsed.ticks.filter((t) => t.phase === "INPLAY").length,
    postmatch: fixtureParsed.ticks.filter((t) => t.phase === "POSTMATCH").length,
    unknown: fixtureParsed.ticks.filter((t) => t.phase === "UNKNOWN").length,
  };
  const timestampObs = (fullParsed ?? fixtureParsed).ticks.length;
  const matchOddsTicks = fixtureParsed.ticks.length;
  const strictEvents = blind.triple_complete && blind.unknown_ticks === 0 ? 1 : 0;
  const formatValid =
    fixtureParsed.parseFail === 0 &&
    fixtureParsed.ticks.length > 0 &&
    blind.kickoff.endsWith("Z");
  const verdict = decideVerdict({
    officialBulk: false,
    strictEvents,
    timestampObs,
    formatValid,
  });
  const annual = buildAnnualRows023({
    cfg,
    eventsByYear: new Map([
      [2017, { events: 1, strict: strictEvents }],
      [2018, { events: 0, strict: 0 }],
      [2019, { events: 0, strict: 0 }],
      [2020, { events: 0, strict: 0 }],
    ]),
  });
  const market_row = matchOddsLifecycle({
    observed: true,
    temporallyValid: strictEvents > 0,
    sampleSize: 1,
  });
  const firstMd = fixtureParsed.definitions[0];

  return {
    experiment_id: cfg.experiment_id,
    task: "023",
    dataset_id: DATASET_ID_023,
    parser_version: PARSER_VERSION_023,
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: cfg.frozen_model_id,
    verdict,
    inspected: true,
    official_bulk_acquired: false,
    source_class_primary: "MIRROR",
    probes,
    fixture: {
      path: fixturePath,
      lines: fixtureParsed.lines,
      bytes: fixtureBuf.length,
      sha256: sha256(fixtureBuf),
      sha256_expected: MATCH_ODDS_FIXTURE_SHA256,
    },
    full_sample: {
      acquired: Boolean(fullParsed),
      path: fullParsed ? FOOTBALL_JSON_CACHE : null,
      bytes: fullBuf?.length ?? null,
      sha256: fullBuf ? sha256(fullBuf) : null,
      sha256_expected: FULL_FOOTBALL_SAMPLE_SHA256,
      lines: fullParsed?.lines ?? 0,
      markets: fullParsed?.marketIds.length ?? fixtureParsed.marketIds.length,
      events: fullParsed?.eventIds.length ?? fixtureParsed.eventIds.length,
      ltp_ticks: fullParsed?.ticks.length ?? fixtureParsed.ticks.length,
      batb: fullParsed?.batbCount ?? fixtureParsed.batbCount,
      atb: fullParsed?.atbCount ?? fixtureParsed.atbCount,
      atl: fullParsed?.atlCount ?? fixtureParsed.atlCount,
    },
    match_odds: {
      marketId: blind.marketId,
      eventId: blind.eventId,
      eventName: blind.eventName,
      kickoff: blind.kickoff,
      timezone_field: firstMd?.timezone ?? null,
      prematch: tickPhases.prematch,
      inplay: tickPhases.inplay,
      postmatch: tickPhases.postmatch,
      unknown: tickPhases.unknown,
      timestamp_observations: timestampObs,
    },
    coverage: blind.coverage,
    first_available: blind.first_available,
    windows: blind.windows_home,
    blind,
    leakage: runHostileBattery(),
    annual,
    market_row,
    models: blind.models,
    cost: costTable(blind.first_available.median_observation_interval),
    expected_information_gain: EXPECTED_INFORMATION_GAIN,
    quality: {
      source: "GitHub MIRROR of Betfair Historic BASIC (petermclagan sample) + official portal probed unauthenticated",
      events: fullParsed?.eventIds.length ?? 1,
      markets: fullParsed?.marketTypes.length ?? fixtureParsed.marketTypes.length,
      timestamps: timestampObs,
      prematch_timestamps: (fullParsed ?? fixtureParsed).ticks.filter((t) => t.phase === "PREMATCH").length,
      inplay_timestamps: (fullParsed ?? fixtureParsed).ticks.filter((t) => t.phase === "INPLAY").length,
      postmatch_timestamps: (fullParsed ?? fixtureParsed).ticks.filter((t) => t.phase === "POSTMATCH").length,
      exact_timestamp: (fullParsed ?? fixtureParsed).ticks.filter((t) => t.temporalPrecision === "exact").length,
      unknown_timestamp: (fullParsed ?? fixtureParsed).ticks.filter((t) => t.temporalPrecision === "unknown").length,
      median_interval: blind.first_available.median_observation_interval,
      coverage_note: "Window coverage = share of MATCH_ODDS selections with a PREMATCH tick ≤ asOf; no interpolation",
      strict_events: strictEvents,
      license: "Betfair Historic ToS for official bulk (not acquired). GitHub test sample = MIRROR, not an independent source.",
      cost: "BASIC £0 + login (blocked this run). Advanced soccer £69/month or £699/year. Not purchased.",
      data_quality: "Documented BASIC ≈1 min LTP, no ladder. Measured MATCH_ODDS unique-pt median interval is sparser than 1 min; batb/atb/atl=0; kickoff=marketTime UTC",
    },
    sources_table: [
      {
        source: "historicdata.betfair.com BASIC (OFFICIAL)",
        period: "from ~2015/2016 documented",
        events: 0,
        markets: 0,
        timestamp: "EXACT pt (not acquired)",
        strict: 0,
        cost: "£0 + login",
        status: "ACQUISITION_BLOCKED",
      },
      {
        source: "petermclagan football-basic-sample (MIRROR)",
        period: "2017-04-30 EPL Middlesbrough v Man City",
        events: 1,
        markets: fullParsed?.marketTypes.length ?? 1,
        timestamp: "EXACT pt vs marketTime",
        strict: strictEvents,
        cost: "£0 (GitHub test fixture)",
        status: strictEvents > 0 ? "PARTIAL_STRICT" : "INSUFFICIENT_DATA",
      },
      {
        source: "kito129 tennis BASIC json (MIRROR)",
        period: "tennis MATCH_ODDS sample",
        events: 0,
        markets: 1,
        timestamp: "EXACT pt (format only; not soccer capital)",
        strict: 0,
        cost: "£0",
        status: "FORMAT_ONLY",
      },
    ],
    counts: {
      decisions: 1,
      bets: 0,
      no_bet: 1,
      strict_events: strictEvents,
    },
    scientific: {
      data_available: `mirror_events=1; official_bulk=false; full_sample_ltp=${timestampObs}; match_odds_ltp=${matchOddsTicks}; BASIC ladder=0`,
      strict_events: strictEvents,
      official_strict_events: 0,
      timestamp_observations: timestampObs,
      acceptance_100_events: false,
      model_ready_markets: [],
      years_testable: [],
      years_insufficient: annual.map((a) => a.year),
      total_blind_decisions: 1,
      total_bets: 0,
      best_model: null,
      best_risk_policy: null,
      statistical_significance: "none (n=1; Bonferroni 7 models; no edge claim)",
      holdout_status: "SACRED",
      clv_home_implied_delta: blind.clv.implied_delta,
      verdict,
    },
    multiple_testing: {
      alpha: 0.05,
      tests: 7,
      bonferroni: bonferroniThreshold(0.05, 7),
      any_significant: false,
    },
    walk_forward: {
      train: cfg.train_years,
      validation: cfg.val_years,
      test: cfg.test_years,
      holdout: cfg.holdout_years,
      holdout_used_for_selection: false,
    },
  };
}

export function loadTask023ReportForUi(): Task023Report | null {
  const p = join(process.cwd(), "artifacts", "task-023-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task023Report;
    if (raw.experiment_id === "exp_023_temporal_odds_breakthrough_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask023(): Promise<Task023Report> {
  return loadTask023ReportForUi() ?? runTask023({ allowNetwork: false });
}
