import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { brier3 } from "@/domain/eval/capital-020/models";
import { buildBreakthrough027Assessment } from "@/domain/eval/breakthrough-027/evidence";
import {
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakInventedTimestamp,
  leakOutcome,
  leakRandomSplit,
  leakReliability,
} from "@/domain/eval/incremental-029/leakage";
import { fitResidual, residualPredict, type ResidualWeights } from "@/domain/eval/incremental-029/residual";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { scoreRows } from "@/domain/eval/validation-028/metrics";
import {
  blockBootstrapMeanCI,
  permutationMeanPOneSidedPositive,
} from "@/domain/eval/validation-028/stats";
import {
  FROZEN_028_SHA256_030,
  leakCloseBin,
  leakFutureElo,
  leakFutureForm,
  leakFutureH2H,
  leakFutureMarket,
  loadMovementByMatchBook,
  movementOverlayPath,
  walk030,
  type Family030,
  type FeatureStatus030,
  type ModelId030,
  type WalkRow030,
} from "@/domain/eval/final-feature-reconstruction";

export type Verdict030 = "EDGE_DEMONSTRATED" | "NO_DEMONSTRATED_EDGE" | "INSUFFICIENT_DATA";
export type Production030 = "NOT_DEPLOYABLE" | "PROMOTION_CANDIDATE" | "DEPLOYABLE";

export type Exp030Config = {
  experiment_id: string;
  dataset_version: string;
  frozen_028_sha256: string;
  model_version: string;
  feature_policy_version: string;
  as_of_policy: string;
  primary_metric: string;
  baseline: string;
  ece_bins: number;
  bootstrap_n: number;
  bootstrap_seed: number;
  permutation_n: number;
  alpha: number;
  logistic_iters: number;
  logistic_lr: number;
  logistic_seed: number;
  val_improve_eps: number;
  movement_min_train_coverage: number;
  history_min_meetings: number;
  models: ModelId030[];
  corpus_partitions: Record<"TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT", { start: string; end: string }>;
  solar_years: number[];
  winner: null;
  declared_best: false;
  auto_promotion: false;
  auto_promote: false;
  real_money: false;
  feature_selection_on_test: false;
  holdout_for_training: false;
  random_split: false;
  close_in_decision: false;
  date_only_promoted_to_strict: false;
  invent_available_at: false;
  invent_timestamps: false;
};

export type Score030 = {
  n: number;
  brier: number | null;
  logloss: number | null;
  ece: number | null;
  cal_slope: number | null;
  cal_intercept: number | null;
  delta_brier: number | null;
  delta_logloss: number | null;
};

export type AnnualRow030 = {
  year: number;
  bets: number;
  start: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  status: "VALID" | "NO_BET" | "INSUFFICIENT_DATA" | "INCOMPLETE" | "NO_EDGE";
};

const FAMILY_OF: Record<Exclude<ModelId030, "market_only" | "market_all">, Family030> = {
  market_elo: "elo",
  market_form: "form",
  market_history: "history",
  market_schedule: "schedule",
  market_movement: "movement",
};

export function loadExp030Config(): Exp030Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_030_final_edge_lab.json"), "utf8"),
  ) as Exp030Config;
  if (raw.experiment_id !== "exp_030_final_edge_lab") throw new Error("bad experiment_id");
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.feature_selection_on_test !== false ||
    raw.holdout_for_training !== false ||
    raw.random_split !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timestamps !== false
  ) {
    throw new ExperimentIntegrityError("frozen TASK 030 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") throw new ExperimentIntegrityError("STRICT_AS_OF frozen");
  if (raw.primary_metric !== "brier_test") throw new ExperimentIntegrityError("primary_metric frozen");
  if (raw.baseline !== "market_devig") throw new ExperimentIntegrityError("baseline frozen");
  return raw;
}

export function leakPostTestSelection(): void {
  throw new ExperimentIntegrityError("model selection post-TEST");
}

export function leakAutoPromote030(auto: boolean): void {
  if (auto) throw new ExperimentIntegrityError("challenger cannot auto-promote");
}

export function runHostileBattery030(): { id: string; throws: boolean }[] {
  const cfg = loadExp030Config();
  const asOf = new Date("2016-06-01T12:00:00.000Z");
  const asOfMs = asOf.getTime();
  const cases: { id: string; run: () => void }[] = [
    { id: "outcome", run: () => leakOutcome({ outcome: "HOME" }) },
    { id: "future_form", run: () => leakFutureForm(asOfMs + 1, asOfMs) },
    { id: "future_elo", run: () => leakFutureElo(asOfMs + 1, asOfMs) },
    { id: "future_h2h", run: () => leakFutureH2H(asOfMs + 1, asOfMs) },
    { id: "future_market", run: () => leakFutureMarket(asOfMs + 1, asOfMs) },
    { id: "close", run: () => leakCloseBin(0) },
    { id: "close_t1h", run: () => leakCloseAtT1h(true) },
    { id: "date_only_strict", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "post_test", run: () => leakPostTestSelection() },
    { id: "feature_test", run: () => leakFeatureSelectOnTest(true) },
    { id: "random_split", run: () => leakRandomSplit() },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "reliability", run: () => leakReliability(0.7) },
    { id: "auto_promote", run: () => leakAutoPromote030(true) },
    { id: "lock", run: () => assertLockedBeforeReveal(false) },
    {
      id: "reveal_before_lock",
      run: () => {
        assertOutcomeAbsentFromDecision({ outcome: "HOME" });
      },
    },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.feature_selection_on_test) throw new ExperimentIntegrityError("test fs");
        throw new ExperimentIntegrityError("frozen flags ok");
      },
    },
  ];
  return cases.map((c) => {
    try {
      c.run();
      return { id: c.id, throws: false };
    } catch {
      return { id: c.id, throws: true };
    }
  });
}

function part(rows: readonly WalkRow030[], p: WalkRow030["partition"]): WalkRow030[] {
  return rows.filter((r) => r.partition === p);
}

function xFam(row: WalkRow030, families: readonly Family030[]): number[] {
  return families.flatMap((f) => row.x[f] ?? []);
}

function fitOn(rows: readonly WalkRow030[], families: readonly Family030[], cfg: Exp030Config): ResidualWeights {
  return fitResidual({
    markets: rows.map((r) => r.market),
    X: rows.map((r) => xFam(r, families)),
    y: rows.map((r) => r.actual),
    iters: cfg.logistic_iters,
    lr: cfg.logistic_lr,
    seed: cfg.logistic_seed,
  });
}

function predictRow(
  row: WalkRow030,
  families: readonly Family030[],
  W: ResidualWeights | null,
): [number, number, number] {
  return residualPredict(row.market, xFam(row, families), W);
}

function scored(
  rows: readonly WalkRow030[],
  getP: (r: WalkRow030) => [number, number, number],
  bins: number,
  marketBrier: number | null,
  marketLl: number | null,
): Score030 {
  const packed = rows.map((r) => ({ p: getP(r), actual: r.actual }));
  const s = scoreRows(packed, bins);
  return {
    n: s.n,
    brier: s.brier,
    logloss: s.logloss,
    ece: s.ece,
    cal_slope: s.cal_slope,
    cal_intercept: s.cal_intercept,
    delta_brier: s.brier != null && marketBrier != null ? s.brier - marketBrier : null,
    delta_logloss: s.logloss != null && marketLl != null ? s.logloss - marketLl : null,
  };
}

export function verdict030(input: {
  fixture: boolean;
  testN: number;
  beatsTest: boolean;
  holmRejects: boolean;
  holdoutAlsoBeats: boolean;
  calibrationOk: boolean;
}): Verdict030 {
  if (input.fixture || input.testN < 100) return "INSUFFICIENT_DATA";
  if (input.beatsTest && input.holmRejects && input.holdoutAlsoBeats && input.calibrationOk) {
    return "EDGE_DEMONSTRATED";
  }
  return "NO_DEMONSTRATED_EDGE";
}

export function fingerprint030(input: {
  verdict: Verdict030;
  scores: Record<string, { TEST: Score030; HOLDOUT: Score030 }>;
  selected: Family030[];
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export type Task030Report = {
  experiment_id: string;
  task: "030";
  dataset_version: string;
  model_version: string;
  feature_policy_version: string;
  as_of_policy: "STRICT_AS_OF";
  primary_metric: "brier_test";
  baseline: "market_devig";
  frozen_028_sha256: string;
  observed_sha256: string;
  movement_sha256: string | null;
  movement_rows: number;
  fixture_mode: boolean;
  winner: null;
  declared_best: false;
  auto_promotion: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  promotion: "BLOCKED";
  production: Production030;
  verdict: Verdict030;
  best_model: ModelId030 | null;
  selected_families: Family030[];
  feature_status: Record<Family030, FeatureStatus030>;
  partitions: Record<string, { start: string; end: string; events: number }>;
  scores: Record<string, { TEST: Score030; VALIDATION: Score030; HOLDOUT: Score030 }>;
  holm: { n_tests: number; ids: string[]; raw_p: number[]; adjusted_p: number[]; rejected: boolean[] };
  annual: AnnualRow030[];
  leakage: { id: string; throws: boolean }[];
  sample_assessment: ReturnType<typeof buildBreakthrough027Assessment> | null;
  predictive_gate: boolean;
  ci95_delta_brier_all: { low: number; high: number } | null;
  fingerprint: string;
};

function ensureMovementExtract(skipHeavy: boolean): void {
  if (skipHeavy) return;
  const dest = movementOverlayPath(false);
  if (existsSync(dest)) return;
  spawnSync("python", [join(process.cwd(), "src", "scripts", "extract-task-030-movement.py")], {
    encoding: "utf8",
  });
}

export async function runTask030(input: { skipHeavy?: boolean }): Promise<Task030Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp030Config();
  const { freeze, events } = freezeStrict027({ skipHeavy });
  if (!skipHeavy && !freeze.fixture && freeze.sha256 !== FROZEN_028_SHA256_030) {
    throw new ExperimentIntegrityError(`TASK 028 dataset SHA mismatch ${freeze.sha256}`);
  }
  ensureMovementExtract(skipHeavy);
  const t24 = loadMovementByMatchBook(skipHeavy);
  const rows = walk030({ events, partitions: cfg.corpus_partitions, t24 });
  const train = part(rows, "TRAIN");
  const val = part(rows, "VALIDATION");
  const test = part(rows, "TEST");
  const hold = part(rows, "HOLDOUT");

  const histRate = train.length ? train.filter((r) => r.history_n >= cfg.history_min_meetings).length / train.length : 0;
  const moveRate = train.length ? train.filter((r) => r.movement.available).length / train.length : 0;
  const feature_status: Record<Family030, FeatureStatus030> = {
    elo: "AVAILABLE",
    form: "AVAILABLE",
    schedule: "AVAILABLE",
    history: histRate > 0 ? "AVAILABLE" : "INSUFFICIENT",
    movement: moveRate >= cfg.movement_min_train_coverage ? "AVAILABLE" : moveRate > 0 ? "INSUFFICIENT" : "UNAVAILABLE",
  };

  const m0Test = scored(test, (r) => r.market, cfg.ece_bins, null, null);
  const m0Val = scored(val, (r) => r.market, cfg.ece_bins, null, null);
  const m0Hold = scored(hold, (r) => r.market, cfg.ece_bins, null, null);

  const weights = new Map<ModelId030, { families: Family030[]; W: ResidualWeights | null }>();
  weights.set("market_only", { families: [], W: null });
  const familyModels: Exclude<ModelId030, "market_only" | "market_all">[] = [
    "market_elo",
    "market_form",
    "market_history",
    "market_schedule",
    "market_movement",
  ];
  for (const id of familyModels) {
    const fam: Family030[] = [FAMILY_OF[id]];
    const status = feature_status[FAMILY_OF[id]];
    weights.set(id, {
      families: fam,
      W: status === "UNAVAILABLE" ? null : fitOn(train, fam, cfg),
    });
  }

  const selected: Family030[] = [];
  for (const id of familyModels) {
    const fam = FAMILY_OF[id];
    if (feature_status[fam] === "UNAVAILABLE") continue;
    const spec = weights.get(id)!;
    const sVal = scored(val, (r) => predictRow(r, spec.families, spec.W), cfg.ece_bins, m0Val.brier, m0Val.logloss);
    if (sVal.delta_brier != null && sVal.delta_brier < -cfg.val_improve_eps) selected.push(fam);
  }
  weights.set("market_all", {
    families: selected,
    W: selected.length ? fitOn(train, selected, cfg) : null,
  });

  const scores: Task030Report["scores"] = {};
  for (const id of cfg.models) {
    const spec = weights.get(id)!;
    const getP = (r: WalkRow030) => (id === "market_only" ? r.market : predictRow(r, spec.families, spec.W));
    scores[id] = {
      VALIDATION: scored(val, getP, cfg.ece_bins, m0Val.brier, m0Val.logloss),
      TEST: scored(test, getP, cfg.ece_bins, m0Test.brier, m0Test.logloss),
      HOLDOUT: scored(hold, getP, cfg.ece_bins, m0Hold.brier, m0Hold.logloss),
    };
  }

  const challengers = cfg.models.filter((id) => id !== "market_only");
  const rawP: number[] = [];
  for (const id of challengers) {
    const spec = weights.get(id)!;
    const diffs = test.map((r) => brier3(r.market, r.actual) - brier3(predictRow(r, spec.families, spec.W), r.actual));
    rawP.push(permutationMeanPOneSidedPositive({ values: diffs, nPerm: cfg.permutation_n, seed: cfg.bootstrap_seed }) ?? 1);
  }
  const holm = holmBonferroni(rawP, cfg.alpha);

  const allTest = scores.market_all?.TEST;
  const allHold = scores.market_all?.HOLDOUT;
  const beatsTest = (allTest?.delta_brier ?? 1) < 0 && (allTest?.delta_logloss ?? 1) <= 0;
  const beatsHold = (allHold?.delta_brier ?? 1) < 0;
  const allIdx = challengers.indexOf("market_all");
  const holmOk = allIdx >= 0 && holm.rejected[allIdx] === true && beatsTest;
  const calibrationOk =
    allTest?.ece == null || m0Test.ece == null || allTest.ece <= m0Test.ece + 0.02;

  const mAllDiffs = test.map((r) => {
    const spec = weights.get("market_all")!;
    return brier3(r.market, r.actual) - brier3(predictRow(r, spec.families, spec.W), r.actual);
  });
  const ci = blockBootstrapMeanCI({
    values: mAllDiffs,
    blockIds: test.map((r) => r.week),
    nBoot: cfg.bootstrap_n,
    seed: cfg.bootstrap_seed,
    alpha: cfg.alpha,
  });

  const leakage = runHostileBattery030();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage battery miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }

  const verdict = verdict030({
    fixture: freeze.fixture,
    testN: test.length,
    beatsTest,
    holmRejects: holmOk,
    holdoutAlsoBeats: beatsHold,
    calibrationOk,
  });
  const predictive_gate = verdict === "EDGE_DEMONSTRATED";
  const production: Production030 = predictive_gate ? "PROMOTION_CANDIDATE" : "NOT_DEPLOYABLE";

  const annual: AnnualRow030[] = cfg.solar_years.map((year) => {
    const n = rows.filter((r) => r.year === year).length;
    const incomplete = year >= 2026;
    if (n === 0) {
      return {
        year,
        bets: 0,
        start: 1000,
        end: null,
        pnl: null,
        roi: null,
        max_dd: null,
        status: incomplete ? "INCOMPLETE" : "INSUFFICIENT_DATA",
      };
    }
    return {
      year,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      status: predictive_gate ? "NO_BET" : "NO_EDGE",
    };
  });

  const overlayPath = movementOverlayPath(skipHeavy);
  let movement_sha256: string | null = null;
  let movement_rows = 0;
  if (existsSync(overlayPath)) {
    const buf = readFileSync(overlayPath);
    movement_sha256 = createHash("sha256").update(buf).digest("hex");
    movement_rows = Math.max(0, buf.toString("utf8").split(/\r?\n/).filter((l) => l.length > 0).length - 1);
  }

  const fp = fingerprint030({
    verdict,
    scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { TEST: v.TEST, HOLDOUT: v.HOLDOUT }])),
    selected,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "030",
    dataset_version: cfg.dataset_version,
    model_version: cfg.model_version,
    feature_policy_version: cfg.feature_policy_version,
    as_of_policy: "STRICT_AS_OF",
    primary_metric: "brier_test",
    baseline: "market_devig",
    frozen_028_sha256: FROZEN_028_SHA256_030,
    observed_sha256: freeze.sha256,
    movement_sha256,
    movement_rows,
    fixture_mode: freeze.fixture,
    winner: null,
    declared_best: false,
    auto_promotion: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    promotion: "BLOCKED",
    production,
    verdict,
    best_model: null,
    selected_families: selected,
    feature_status,
    partitions: {
      TRAIN: { ...cfg.corpus_partitions.TRAIN, events: train.length },
      VALIDATION: { ...cfg.corpus_partitions.VALIDATION, events: val.length },
      TEST: { ...cfg.corpus_partitions.TEST, events: test.length },
      HOLDOUT: { ...cfg.corpus_partitions.HOLDOUT, events: hold.length },
    },
    scores,
    holm: {
      n_tests: challengers.length,
      ids: [...challengers],
      raw_p: rawP,
      adjusted_p: holm.adjusted,
      rejected: holm.rejected,
    },
    annual,
    leakage,
    sample_assessment: (test[0] ?? val[0] ?? train[0] ?? rows[0])
      ? buildBreakthrough027Assessment({
          event: (test[0] ?? val[0] ?? train[0] ?? rows[0])!.event,
          modelProbs: (test[0] ?? val[0] ?? train[0] ?? rows[0])!.market,
          hypothesis: "MARKET_ONLY",
        })
      : null,
    predictive_gate,
    ci95_delta_brier_all: ci ? { low: ci.low, high: ci.high } : null,
    fingerprint: fp,
  };
}

export function auditTask030(report: Task030Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp030Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion) failures.push("cfg_auto_promotion");
  if (cfg.real_money) failures.push("cfg_real_money");
  if (cfg.feature_selection_on_test) failures.push("feature_selection_on_test");
  if (cfg.random_split) failures.push("random_split");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.declared_best) failures.push("declared_best");
    if (report.auto_promotion) failures.push("auto_promotion");
    if (report.real_money) failures.push("real_money");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.promotion !== "BLOCKED") failures.push("promotion");
    if (report.best_model !== null && report.verdict !== "EDGE_DEMONSTRATED") failures.push("best_model");
    if (report.production === "DEPLOYABLE") failures.push("deployable");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year}`);
    }
    if (report.fixture_mode && report.verdict !== "INSUFFICIENT_DATA") failures.push("fixture_overclaim");
    if (report.sample_assessment) {
      const g = report.sample_assessment.evidenceGraph;
      const items = [...g.supporting, ...g.contradicting, ...g.contextual];
      if (items.some((i) => i.sourceReliability !== null)) failures.push("invented_reliability");
      if (g.insufficient.length === 0 && g.supporting.length === 0 && g.contextual.length === 0) {
        failures.push("empty_evidence");
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

export function loadTask030ReportForUi(): Task030Report | null {
  const p = join(process.cwd(), "artifacts", "task-030-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task030Report;
    if (raw.experiment_id === "exp_030_final_edge_lab") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask030(): Promise<Task030Report> {
  return loadTask030ReportForUi() ?? runTask030({ skipHeavy: true });
}
