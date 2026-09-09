import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { brier3 } from "@/domain/eval/capital-020/models";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { loadExp028Config } from "@/domain/eval/validation-028/config";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { walkFrozen028, type WalkRow028 } from "@/domain/eval/validation-028/walk";
import { scoreRows } from "@/domain/eval/validation-028/metrics";
import { capitalFromWalk } from "@/domain/eval/validation-028/capital";
import {
  blockBootstrapMeanCI,
  permutationMeanP,
  permutationMeanPOneSidedPositive,
} from "@/domain/eval/validation-028/stats";
import { runHostileBattery028 } from "@/domain/eval/validation-028/leakage";
import { errorTables } from "@/domain/eval/validation-028/errors";
import { promotion028, scientificVerdict028 } from "@/domain/eval/validation-028/verdict";
import { partitionCounts } from "@/domain/eval/validation-028/partition";
import {
  classifyAblation,
  marketEfficiency028,
  slicesBy,
  type EfficiencyBin028,
  type Slice028,
} from "@/domain/eval/validation-028/slices";
import type { RiskPolicyId } from "@/domain/risk/bankroll/policies";
import type { Score028 } from "@/domain/eval/validation-028/types";
import { DATASET_ID_028, PARSER_VERSION_028, type AnnualRow028, type DatasetFreeze028, type Partition028, type ScientificVerdict028 } from "@/domain/eval/validation-028/types";
import { buildBreakthrough027Assessment } from "@/domain/eval/breakthrough-027/evidence";
import { loadExp027Config } from "@/domain/eval/breakthrough-027/config";

const PARTS: Partition028[] = ["TRAIN", "VALIDATION", "TEST", "HOLDOUT"];

function rowsOf(rows: readonly WalkRow028[], p: Partition028): WalkRow028[] {
  return rows.filter((r) => r.partition === p);
}

function scoreModel(rows: readonly WalkRow028[], id: string, bins: number): Score028 {
  const packed = rows
    .map((r) => {
      const p = r.probs[id];
      return p ? { p, actual: r.actual } : null;
    })
    .filter((x): x is { p: [number, number, number]; actual: 0 | 1 | 2 } => x != null);
  return scoreRows(packed, bins);
}

export type Task028Report = {
  experiment_id: string;
  task: "028";
  dataset_id: typeof DATASET_ID_028;
  parser_version: typeof PARSER_VERSION_028;
  git_commit: string | null;
  freeze: DatasetFreeze028;
  HOLDOUT_TOUCHED: false;
  winner: null;
  declared_best: false;
  auto_promote: false;
  real_money: false;
  verdict: ScientificVerdict028;
  model_ready: false;
  fixture_mode: boolean;
  partitions: Record<Partition028, { start: string; end: string; events: number }>;
  project_calendar_holdout_events: 0;
  windows: { window: string; events_available: number; coverage: number }[];
  scores: Record<string, Record<Partition028, Score028>>;
  ablation_test: Record<string, Score028>;
  ablation_labels: Record<string, "USEFUL" | "NEUTRAL" | "HARMFUL" | "UNKNOWN">;
  annual: AnnualRow028[];
  test_capital: { bets: number; roi: number | null; pnl: number[]; ci: { mean: number; low: number; high: number } | null; p: number | null };
  holdout_capital: { bets: number; roi: number | null; pnl: number[]; ci: { mean: number; low: number; high: number } | null; p: number | null };
  risk_challengers: { policy: string; bets: number; roi: number | null }[];
  diagnostic_thresholds_validation: { threshold: number; bets: number; roi: number | null; post_hoc: false; used_for_primary: false }[];
  friction: { rate: number; test_net_roi: number | null }[];
  holm: { family: string; n_tests: number; ids: string[]; raw_p: number[]; adjusted_p: number[]; rejected: boolean[] };
  stability: { year: Slice028[]; league_top: Slice028[]; league_worst: Slice028[]; bookmaker: Slice028[] };
  efficiency: {
    favorite: EfficiencyBin028;
    underdog: EfficiencyBin028;
    odds_range: EfficiencyBin028[];
    overround: EfficiencyBin028[];
  };
  clv: "CLV_UNAVAILABLE";
  execution_cost: "EXECUTION_COST_UNKNOWN";
  rho: null;
  rho_status: "UNKNOWN";
  errors: ReturnType<typeof errorTables>;
  promotion: { promotion: false; reasons: string[] };
  sample_assessment: ReturnType<typeof buildBreakthrough027Assessment> | null;
  leakage: { id: string; throws: boolean }[];
  repro: {
    dataset_hash: string;
    bootstrap_seed: number;
    bootstrap_n: number;
    bootstrap_block: string;
    permutation_n: number;
    multiple_testing: string;
    frozen_model: string;
    frozen_threshold: number;
  };
  metrics: {
    strict_events: number;
    test_events: number;
    holdout_events: number;
    decisions: number;
    bets: number;
    market_brier_test: number | null;
    model_brier_test: number | null;
    market_logloss_test: number | null;
    model_logloss_test: number | null;
    test_roi: number | null;
    holdout_roi: number | null;
    ci95: { low: number; high: number } | null;
    adjusted_p: number | null;
    max_dd: number | null;
  };
};

export async function runTask028(input: { skipHeavy?: boolean }): Promise<Task028Report> {
  const cfg = loadExp028Config();
  loadExp027Config();
  const { freeze, events } = freezeStrict027({ skipHeavy: input.skipHeavy === true });
  const walked = walkFrozen028({ events, cfg });
  const counts = partitionCounts(
    walked.rows.map((r) => r.event.kickoff),
    cfg,
  );
  const partitions = {
    TRAIN: { ...cfg.corpus_partitions.TRAIN, events: counts.TRAIN },
    VALIDATION: { ...cfg.corpus_partitions.VALIDATION, events: counts.VALIDATION },
    TEST: { ...cfg.corpus_partitions.TEST, events: counts.TEST },
    HOLDOUT: { ...cfg.corpus_partitions.HOLDOUT, events: counts.HOLDOUT },
  };
  const scores: Task028Report["scores"] = {};
  for (const id of cfg.models) {
    scores[id] = {
      TRAIN: scoreModel(rowsOf(walked.rows, "TRAIN"), id, cfg.ece_bins),
      VALIDATION: scoreModel(rowsOf(walked.rows, "VALIDATION"), id, cfg.ece_bins),
      TEST: scoreModel(rowsOf(walked.rows, "TEST"), id, cfg.ece_bins),
      HOLDOUT: scoreModel(rowsOf(walked.rows, "HOLDOUT"), id, cfg.ece_bins),
    };
  }
  const ablation_test: Record<string, Score028> = {};
  for (const id of cfg.ablation) {
    ablation_test[id] = scoreModel(rowsOf(walked.rows, "TEST"), id, cfg.ece_bins);
  }

  const testRows = rowsOf(walked.rows, "TEST");
  const rawP: number[] = [];
  for (const id of cfg.models) {
    const diffs: number[] = [];
    const weeks: string[] = [];
    for (const r of testRows) {
      const p = r.probs[id];
      if (!p) continue;
      diffs.push(brier3(p, r.actual) - brier3(r.market, r.actual));
      weeks.push(r.week);
    }
    const pVal = permutationMeanPOneSidedPositive({
      values: diffs.map((x) => -x),
      nPerm: cfg.permutation_n,
      seed: cfg.bootstrap_seed,
    });
    rawP.push(pVal ?? 1);
  }
  const holm = holmBonferroni(rawP, cfg.alpha);

  const fullCap = capitalFromWalk({
    rows: walked.rows,
    cfg,
    modelId: cfg.frozen_model_id,
    threshold: cfg.frozen_edge_threshold,
    partitions: PARTS,
  });
  const testCap = capitalFromWalk({
    rows: walked.rows,
    cfg,
    modelId: cfg.frozen_model_id,
    threshold: cfg.frozen_edge_threshold,
    partitions: ["TEST"],
  });
  const holdCap = capitalFromWalk({
    rows: walked.rows,
    cfg,
    modelId: cfg.frozen_model_id,
    threshold: cfg.frozen_edge_threshold,
    partitions: ["HOLDOUT"],
  });

  const testCi = blockBootstrapMeanCI({
    values: testCap.primaryPnl,
    blockIds: testCap.bets.map((b) => walked.rows.find((r) => r.event.event_id === b.eventId)?.week ?? b.eventId),
    nBoot: cfg.bootstrap_n,
    seed: cfg.bootstrap_seed,
    alpha: cfg.alpha,
  });
  const holdCi = blockBootstrapMeanCI({
    values: holdCap.primaryPnl,
    blockIds: holdCap.bets.map((b) => walked.rows.find((r) => r.event.event_id === b.eventId)?.week ?? b.eventId),
    nBoot: cfg.bootstrap_n,
    seed: cfg.bootstrap_seed,
    alpha: cfg.alpha,
  });
  const testP = permutationMeanP({
    values: testCap.primaryPnl,
    nPerm: cfg.permutation_n,
    seed: cfg.bootstrap_seed,
  });
  const holdP = permutationMeanP({
    values: holdCap.primaryPnl,
    nPerm: cfg.permutation_n,
    seed: cfg.bootstrap_seed,
  });

  const testRoi =
    testCap.bets.length && testCap.annual.filter((a) => a.bets > 0).length
      ? testCap.annual.filter((a) => a.bets > 0).reduce((s, a) => s + (a.pnl ?? 0), 0) /
        (1000 * testCap.annual.filter((a) => a.bets > 0).length)
      : testCap.bets.length
        ? testCap.primaryPnl.reduce((s, x) => s + x, 0) / 1000
        : null;
  const holdRoi =
    holdCap.bets.length && holdCap.annual.filter((a) => a.bets > 0).length
      ? holdCap.annual.filter((a) => a.bets > 0).reduce((s, a) => s + (a.pnl ?? 0), 0) /
        (1000 * holdCap.annual.filter((a) => a.bets > 0).length)
      : holdCap.bets.length
        ? holdCap.primaryPnl.reduce((s, x) => s + x, 0) / 1000
        : null;

  const friction = cfg.friction_rates.map((rate) => {
    if (testCap.bets.length === 0) return { rate, test_net_roi: null as number | null };
    let pnl = 0;
    const years = new Set<number>();
    for (const b of testCap.bets) {
      years.add(b.year);
      const gross = b.won ? b.stake * (b.odds - 1) : -b.stake;
      pnl += gross - b.stake * rate;
    }
    return { rate, test_net_roi: pnl / (1000 * Math.max(1, years.size)) };
  });

  const mktTest = scores.market_devig?.TEST;
  const eloTest = scores.elo?.TEST;
  const freqTest = scores.frequency?.TEST;
  const modelBeatsMarket =
    eloTest?.brier != null && mktTest?.brier != null && eloTest.brier < mktTest.brier;
  const modelBeatsFreq =
    eloTest?.brier != null && freqTest?.brier != null && eloTest.brier < freqTest.brier;
  const eloHolmIdx = cfg.models.indexOf("elo");
  const holmRejects = eloHolmIdx >= 0 && holm.rejected[eloHolmIdx] === true && modelBeatsMarket;

  const verdict = scientificVerdict028({
    fixture: freeze.fixture,
    testN: counts.TEST,
    holdoutN: counts.HOLDOUT,
    modelBeatsFrequencyTest: modelBeatsFreq,
    modelBeatsMarketTest: modelBeatsMarket,
    testRoi,
    testCiLow: testCi?.low ?? null,
    holdoutRoi: holdRoi,
    holdoutCiLow: holdCi?.low ?? null,
    holmRejectsMarketEdge: holmRejects,
    projectCalendarHoldoutN: 0,
  });

  const promo = promotion028({
    beatsMarketTest: modelBeatsMarket,
    beatsMarketHoldout:
      (scores.elo?.HOLDOUT.brier ?? 9) < (scores.market_devig?.HOLDOUT.brier ?? 0),
    calOk: (eloTest?.ece ?? 1) < 0.05,
    ciPosTest: (testCi?.low ?? -1) > 0,
    holmOk: holmRejects,
    projectHoldoutN: 0,
    multiLeague: new Set(testCap.bets.map((b) => b.league)).size >= 3,
    multiSeason: new Set(testCap.bets.map((b) => b.year)).size >= 2,
    frozenThreshold: true,
  });

  const errors = errorTables({
    rows: testRows.length ? testRows : walked.rows,
    bets: testCap.bets,
    modelId: "elo",
    limit: freeze.fixture ? 3 : 50,
  });
  const sampleEvent = (testRows[0] ?? walked.rows[0])?.event ?? null;
  const sample = sampleEvent
    ? buildBreakthrough027Assessment({
        event: sampleEvent,
        modelProbs: (testRows[0] ?? walked.rows[0])?.probs.elo ?? null,
        hypothesis: "NO_BET",
      })
    : null;

  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const maxDd = fullCap.annual.reduce((m, r) => Math.max(m, r.max_dd ?? 0), 0);

  const mktTrain = scores.market_devig?.TRAIN;
  const ablation_labels: Task028Report["ablation_labels"] = {};
  for (const id of cfg.ablation) {
    const trainBrier = scoreModel(rowsOf(walked.rows, "TRAIN"), id, cfg.ece_bins).brier;
    ablation_labels[id] =
      id === "market_only"
        ? "NEUTRAL"
        : classifyAblation({
            trainMarket: mktTrain?.brier ?? null,
            trainModel: trainBrier,
            testMarket: mktTest?.brier ?? null,
            testModel: ablation_test[id]?.brier ?? null,
            testN: ablation_test[id]?.n ?? 0,
          });
  }

  const leagueSlices = slicesBy(testRows, (r) => r.event.competition || "UNKNOWN", "elo");
  const stability = {
    year: slicesBy(testRows, (r) => String(r.year), "elo"),
    league_top: leagueSlices.slice(0, 12),
    league_worst: [...leagueSlices].filter((s) => s.n >= 20).sort((a, b) => (b.brier_model ?? 0) - (a.brier_model ?? 0)).slice(0, 8),
    bookmaker: slicesBy(testRows, (r) => r.event.bookmaker || "UNKNOWN", "elo").slice(0, 12),
  };
  const efficiency = marketEfficiency028(testRows.length ? testRows : walked.rows);

  const risk_challengers = cfg.risk_policies.map((policy) => {
    const cap = capitalFromWalk({
      rows: walked.rows,
      cfg: { ...cfg, primary_risk_policy: policy as RiskPolicyId },
      modelId: cfg.frozen_model_id,
      threshold: cfg.frozen_edge_threshold,
      partitions: ["TEST"],
    });
    const years = new Set(cap.bets.map((b) => b.year));
    const pnl = cap.primaryPnl.reduce((s, x) => s + x, 0);
    return {
      policy,
      bets: cap.bets.length,
      roi: cap.bets.length ? pnl / (1000 * Math.max(1, years.size)) : null,
    };
  });

  const diagnostic_thresholds_validation = cfg.diagnostic_thresholds.map((threshold) => {
    const cap = capitalFromWalk({
      rows: walked.rows,
      cfg,
      modelId: cfg.frozen_model_id,
      threshold,
      partitions: ["VALIDATION"],
    });
    const years = new Set(cap.bets.map((b) => b.year));
    const pnl = cap.primaryPnl.reduce((s, x) => s + x, 0);
    return {
      threshold,
      bets: cap.bets.length,
      roi: cap.bets.length ? pnl / (1000 * Math.max(1, years.size)) : null,
      post_hoc: false as const,
      used_for_primary: false as const,
    };
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "028",
    dataset_id: DATASET_ID_028,
    parser_version: PARSER_VERSION_028,
    git_commit: git.status === 0 ? git.stdout.trim() : null,
    freeze,
    HOLDOUT_TOUCHED: false,
    winner: null,
    declared_best: false,
    auto_promote: false,
    real_money: false,
    verdict,
    model_ready: false,
    fixture_mode: freeze.fixture,
    partitions,
    project_calendar_holdout_events: 0,
    windows: [
      { window: "T-72h", events_available: 0, coverage: 0 },
      { window: "T-48h", events_available: 0, coverage: 0 },
      { window: "T-24h", events_available: 0, coverage: 0 },
      { window: "T-12h", events_available: 0, coverage: 0 },
      { window: "T-6h", events_available: 0, coverage: 0 },
      { window: "T-3h", events_available: 0, coverage: 0 },
      { window: "T-1h", events_available: walked.rows.length, coverage: 1 },
      { window: "T-30m", events_available: 0, coverage: 0 },
      { window: "T-15m", events_available: 0, coverage: 0 },
      { window: "T-5m", events_available: 0, coverage: 0 },
      { window: "T-1m", events_available: 0, coverage: 0 },
    ],
    scores,
    ablation_test,
    ablation_labels,
    annual: fullCap.annual,
    test_capital: {
      bets: testCap.bets.length,
      roi: testRoi,
      pnl: testCap.primaryPnl,
      ci: testCi,
      p: testP,
    },
    holdout_capital: {
      bets: holdCap.bets.length,
      roi: holdRoi,
      pnl: holdCap.primaryPnl,
      ci: holdCi,
      p: holdP,
    },
    risk_challengers,
    diagnostic_thresholds_validation,
    friction,
    holm: {
      family: "TEST_brier_model_minus_market_onesided_model_better",
      n_tests: cfg.models.length,
      ids: [...cfg.models],
      raw_p: rawP,
      adjusted_p: holm.adjusted,
      rejected: holm.rejected,
    },
    stability,
    efficiency,
    clv: "CLV_UNAVAILABLE",
    execution_cost: "EXECUTION_COST_UNKNOWN",
    rho: null,
    rho_status: "UNKNOWN",
    errors,
    promotion: promo,
    sample_assessment: sample,
    leakage: runHostileBattery028(),
    repro: {
      dataset_hash: freeze.sha256,
      bootstrap_seed: cfg.bootstrap_seed,
      bootstrap_n: cfg.bootstrap_n,
      bootstrap_block: cfg.bootstrap_block,
      permutation_n: cfg.permutation_n,
      multiple_testing: cfg.multiple_testing_method,
      frozen_model: cfg.frozen_model_id,
      frozen_threshold: cfg.frozen_edge_threshold,
    },
    metrics: {
      strict_events: freeze.events,
      test_events: counts.TEST,
      holdout_events: counts.HOLDOUT,
      decisions: fullCap.annual.reduce((s, r) => s + r.decisions, 0),
      bets: fullCap.annual.reduce((s, r) => s + r.bets, 0),
      market_brier_test: mktTest?.brier ?? null,
      model_brier_test: eloTest?.brier ?? null,
      market_logloss_test: mktTest?.logloss ?? null,
      model_logloss_test: eloTest?.logloss ?? null,
      test_roi: testRoi,
      holdout_roi: holdRoi,
      ci95: testCi ? { low: testCi.low, high: testCi.high } : null,
      adjusted_p: eloHolmIdx >= 0 ? holm.adjusted[eloHolmIdx]! : null,
      max_dd: fullCap.annual.some((r) => r.bets > 0) ? maxDd : null,
    },
  };
}

export function loadTask028ReportForUi(): Task028Report | null {
  const p = join(process.cwd(), "artifacts", "task-028-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task028Report;
    if (raw.experiment_id === "exp_028_scientific_validation_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask028(): Promise<Task028Report> {
  return loadTask028ReportForUi() ?? runTask028({ skipHeavy: true });
}
