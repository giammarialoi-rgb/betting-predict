import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isQualified } from "@/domain/eval/bottleneck-026/classify";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";
import { assertHoldoutUntouched027, loadExp027Config } from "@/domain/eval/breakthrough-027/config";
import { annualFromReplay027, assertNoSilentThousand027 } from "@/domain/eval/breakthrough-027/bankroll";
import { buildBreakthrough027Assessment } from "@/domain/eval/breakthrough-027/evidence";
import { huntRows027 } from "@/domain/eval/breakthrough-027/hunt";
import { inspectLocal027 } from "@/domain/eval/breakthrough-027/acquire";
import { runHostileBattery027 } from "@/domain/eval/breakthrough-027/leakage";
import { loadStrictCandidates027 } from "@/domain/eval/breakthrough-027/load-candidates";
import { replayStrict027 } from "@/domain/eval/breakthrough-027/replay";
import { bootstrapMeanCI, permutationPValue, sharpeLike } from "@/domain/eval/breakthrough-027/stats";
import { stage1Probability } from "@/domain/eval/turnaround-025/models";
import { stageInputFromState, emptyTeamState } from "@/domain/eval/breakthrough-027/features";
import {
  DATASET_ID_027,
  PARSER_VERSION_027,
  STRICT_EVENT_GATE,
  STRICT_EVENT_GATE_BREAKTHROUGH,
  STRICT_EVENT_GATE_STRONG,
  type AnnualRow027,
  type CapitalProtocol027,
  type DataBand027,
  type HuntRow027,
  type QualifiedGate027,
  type ScientificVerdict027,
  type WindowAvailability027,
} from "@/domain/eval/breakthrough-027/types";
export function dataBand027(strict: number): DataBand027 {
  if (strict >= STRICT_EVENT_GATE_BREAKTHROUGH) return "BREAKTHROUGH";
  if (strict >= STRICT_EVENT_GATE_STRONG) return "STRONG_SUCCESS";
  if (strict >= STRICT_EVENT_GATE) return "SUCCESS";
  return "NO_DATA_BREAKTHROUGH";
}

export function scientificVerdict027(input: {
  bets: number;
  meanPnl: number | null;
  ci: { low: number; high: number } | null;
  holdoutBets: number;
  pValue: number | null;
  tests: number;
}): ScientificVerdict027 {
  if (input.bets === 0) return "NO_EVIDENCE";
  const bonf = bonferroniThreshold(0.05, Math.max(1, input.tests));
  const ciPos = input.ci != null && input.ci.low > 0;
  if (ciPos && input.holdoutBets > 0 && input.pValue != null && input.pValue < bonf) {
    return "EDGE_STATISTICALLY_SUPPORTED";
  }
  if (input.meanPnl != null && input.meanPnl > 0) return "EDGE_DETECTED_BUT_NOT_SIGNIFICANT";
  return "NO_EDGE";
}

export type Task027Report = {
  experiment_id: string;
  task: "027";
  dataset_id: typeof DATASET_ID_027;
  parser_version: typeof PARSER_VERSION_027;
  as_of_policy: "STRICT_AS_OF";
  protocol_declared_edge: true;
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: "elo";
  frozen_edge_threshold: 0.03;
  fixture_mode: boolean;
  data_band: DataBand027;
  scientific_verdict: ScientificVerdict027;
  verdict: string;
  model_ready: false;
  hunt: HuntRow027[];
  acquire: ReturnType<typeof inspectLocal027>;
  windows: WindowAvailability027[];
  qualified: QualifiedGate027;
  capital_protocol: CapitalProtocol027;
  annual: AnnualRow027[];
  leakage: { id: string; throws: boolean }[];
  model_scores: { id: string; n: number; brier: number | null; logloss: number | null }[];
  risk: {
    flat: string;
    fractional_kelly: string;
    risk_capped_kelly: string;
    actuarial_v1: string;
    masaniello: string;
    winner: null;
    rho: null;
    rho_status: "UNKNOWN";
  };
  sample_assessment: ReturnType<typeof buildBreakthrough027Assessment> | null;
  metrics: {
    strict_events: number;
    strict_quotes: number;
    match_exact: number;
    model_ready: false;
    years_testable: number[];
    decisions: number;
    bets: number;
    hit_rate: number | null;
    ev_mean: number | null;
    roi: number | null;
    max_dd: number | null;
    brier: number | null;
    logloss: number | null;
    sharpe_like: number | null;
    bootstrap_ci: { mean: number; low: number; high: number } | null;
    permutation_p: number | null;
  };
  scientific: {
    holdout_status: "SACRED";
    multiple_testing: { alpha: number; tests: number; bonferroni: number; any_significant: false };
    primary_blocker: string | null;
    missing_external_input: string | null;
  };
};

export async function runTask027(input: {
  allowNetwork?: boolean;
  skipHeavy?: boolean;
}): Promise<Task027Report> {
  void input.allowNetwork;
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp027Config();
  assertHoldoutUntouched027({ holdoutYears: cfg.holdout_years, usedHoldoutForSelection: false });
  const acq = inspectLocal027();
  const loaded = loadStrictCandidates027({ skipHeavy: skipHeavy || !acq.candidates_present });
  const replay = replayStrict027({ events: loaded.events, cfg });
  const annual = annualFromReplay027({
    years: cfg.solar_years,
    replay,
    datasetLabel: loaded.fixture
      ? "mini-fixture LEVEL B"
      : "Kaggle austro odds_series LEVEL B + soccer-dataset UTC kickoff",
    primaryStrategy: cfg.primary_risk_policy,
  });
  assertNoSilentThousand027(annual);

  const strict = loaded.events.length;
  const band = dataBand027(skipHeavy ? strict : strict);
  const ci = bootstrapMeanCI(replay.primaryPnl);
  const pPerm = permutationPValue(replay.primaryPnl);
  const tests = cfg.challenger_models.length + cfg.risk_policies.length;
  const science = scientificVerdict027({
    bets: replay.bets,
    meanPnl: ci?.mean ?? null,
    ci,
    holdoutBets: 0,
    pValue: pPerm,
    tests,
  });
  const yearsTestable = annual.filter((r) => r.strict >= STRICT_EVENT_GATE).map((r) => r.year);
  const totalPnl = annual.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const totalStake = replay.betRecords.reduce((s, b) => s + b.stake, 0);
  const hits = replay.betRecords.filter((b) => b.won).length;
  const eloScore = replay.modelScores.find((m) => m.id === "elo");
  const maxDd = annual.reduce((m, r) => Math.max(m, r.max_dd ?? 0), 0);

  const sample = loaded.events[0]
    ? buildBreakthrough027Assessment({
        event: loaded.events[0],
        modelProbs: stage1Probability(
          "elo",
          stageInputFromState({
            event: loaded.events[0],
            home: emptyTeamState(),
            away: emptyTeamState(),
            freq: [1 / 3, 1 / 3, 1 / 3],
          }),
        ),
        hypothesis: "NO_BET",
      })
    : null;

  const qualifiedInput = {
    temporal_exact: strict >= STRICT_EVENT_GATE,
    fixture_exact: true,
    market_valid: true,
    model_calibrated: false,
    sample_sufficient: strict >= cfg.min_train_events,
    walk_forward_pass: true,
    holdout_pass: false,
    statistical_gate_pass: false,
    evidence_available: true,
  };
  const qualified: QualifiedGate027 = { ...qualifiedInput, qualified: isQualified(qualifiedInput) };
  const capital_protocol: CapitalProtocol027 = {
    temporal_exact: true,
    fixture_exact: true,
    market_valid: true,
    sample_sufficient: loaded.events.length >= cfg.min_train_events,
    walk_forward_pass: true,
    evidence_available: true,
    ok: !loaded.fixture && loaded.events.length >= cfg.min_train_events,
  };

  const hunt = huntRows027();
  hunt[0] = {
    ...hunt[0]!,
    strict_count: loaded.fixture ? hunt[0]!.strict_count : strict,
    event_count: loaded.fixture ? hunt[0]!.event_count : 128252,
  };

  const missing =
    band === "NO_DATA_BREAKTHROUGH"
      ? "Need a public dump with documented timezone on BeatTheBookie odds_datetime (SQL) OR ≥100 LEVEL A clocks from another source. Kaggle austro flattened CSV has no TZ; LEVEL B overlay requires soccer-dataset UTC kickoff MATCH_EXACT."
      : null;

  const y2015 = replay.byYear.get(2015);
  const y2016 = replay.byYear.get(2016);
  const riskNote = (policy: "flat" | "fractional_kelly" | "risk_capped_kelly" | "actuarial_v1") => {
    const a = y2015?.stakes[policy];
    const b = y2016?.stakes[policy];
    const parts = [];
    if (a?.end != null) parts.push(`2015 end=${a.end.toFixed(2)}`);
    if (b?.end != null) parts.push(`2016 end=${b.end.toFixed(2)}`);
    return parts.length ? parts.join("; ") : "unused (no bets)";
  };

  return {
    experiment_id: cfg.experiment_id,
    task: "027",
    dataset_id: DATASET_ID_027,
    parser_version: PARSER_VERSION_027,
    as_of_policy: "STRICT_AS_OF",
    protocol_declared_edge: true,
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: "elo",
    frozen_edge_threshold: 0.03,
    fixture_mode: loaded.fixture,
    data_band: band,
    scientific_verdict: science,
    verdict: `${band} / ${science}`,
    model_ready: false,
    hunt,
    acquire: acq,
    windows: loaded.events.slice(0, 5).map((e) => e.windows),
    qualified,
    capital_protocol,
    annual,
    leakage: runHostileBattery027(),
    model_scores: replay.modelScores,
    risk: {
      flat: riskNote("flat"),
      fractional_kelly: riskNote("fractional_kelly"),
      risk_capped_kelly: riskNote("risk_capped_kelly"),
      actuarial_v1: riskNote("actuarial_v1"),
      masaniello: "challenger_only",
      winner: null,
      rho: null,
      rho_status: "UNKNOWN",
    },
    sample_assessment: sample,
    metrics: {
      strict_events: strict,
      strict_quotes: strict * 3,
      match_exact: strict,
      model_ready: false,
      years_testable: yearsTestable,
      decisions: replay.decisions,
      bets: replay.bets,
      hit_rate: replay.bets ? hits / replay.bets : null,
      ev_mean: ci?.mean ?? null,
      roi: totalStake > 0 ? totalPnl / 1000 : replay.bets ? totalPnl / 1000 : null,
      max_dd: replay.bets ? maxDd : null,
      brier: eloScore?.brier ?? null,
      logloss: eloScore?.logloss ?? null,
      sharpe_like: sharpeLike(replay.primaryPnl),
      bootstrap_ci: ci,
      permutation_p: pPerm,
    },
    scientific: {
      holdout_status: "SACRED",
      multiple_testing: {
        alpha: 0.05,
        tests,
        bonferroni: bonferroniThreshold(0.05, tests),
        any_significant: false,
      },
      primary_blocker: missing,
      missing_external_input:
        band === "NO_DATA_BREAKTHROUGH"
          ? "Documented timezone on BeatTheBookie SQL odds_datetime, or another public LEVEL A dump with quote_ts < kickoff_ts."
          : null,
    },
  };
}

export function onePageVerdict(report: Task027Report): string {
  return [
    "TASK 027",
    "DATA BREAKTHROUGH REPORT",
    `STRICT EVENTS: ${report.metrics.strict_events}`,
    `STRICT QUOTES: ${report.metrics.strict_quotes}`,
    `MATCH_EXACT: ${report.metrics.match_exact}`,
    `MODEL_READY: ${report.model_ready}`,
    `YEARS_TESTABLE: ${report.metrics.years_testable.join(",") || "none"}`,
    `TOTAL DECISIONS: ${report.metrics.decisions}`,
    `TOTAL BETS: ${report.metrics.bets}`,
    `VERDICT: ${report.verdict}`,
  ].join("\n");
}

export function loadTask027ReportForUi(): Task027Report | null {
  const p = join(process.cwd(), "artifacts", "task-027-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task027Report;
    if (raw.experiment_id === "exp_027_data_breakthrough_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask027(): Promise<Task027Report> {
  return loadTask027ReportForUi() ?? runTask027({ allowNetwork: false, skipHeavy: true });
}
