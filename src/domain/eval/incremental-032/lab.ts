import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { brier3 } from "@/domain/eval/capital-020/models";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { scoreRows } from "@/domain/eval/validation-028/metrics";
import {
  blockBootstrapMeanCI,
  permutationMeanPOneSidedPositive,
} from "@/domain/eval/validation-028/stats";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import {
  FROZEN_028_SHA256_030,
  walk030,
  loadMovementByMatchBook,
  type Family030,
  type WalkRow030,
} from "@/domain/eval/final-feature-reconstruction";
import { fitResidual, residualPredict, type ResidualWeights } from "@/domain/eval/incremental-029/residual";
import { incrementalClass032 } from "@/domain/eval/incremental-032/classify";
import { assertHoldoutLocked032, assertTestLocked032, loadExp032Config } from "@/domain/eval/incremental-032/config";
import { featureFingerprint032, featureInventory032 } from "@/domain/eval/incremental-032/feature-audit";
import { leakMasanielloProduction, runHostileBattery032 } from "@/domain/eval/incremental-032/leakage";
import { stressSelected032, type Stress032 } from "@/domain/eval/incremental-032/stress";
import {
  FROZEN_031_SHA256,
  type AnnualRow032,
  type FeatureAuditRow032,
  type IncrementalClass032,
  type ModelId032,
  type Score032,
  type Verdict032,
} from "@/domain/eval/incremental-032/types";

const ORDER: ModelId032[] = [
  "market_only",
  "market_elo",
  "market_form",
  "market_history",
  "market_schedule",
  "market_movement",
  "market_all",
];

function part(rows: readonly WalkRow030[], p: WalkRow030["partition"]): WalkRow030[] {
  return rows.filter((r) => r.partition === p);
}

function xFam(row: WalkRow030, families: readonly Family030[]): number[] {
  return families.flatMap((f) => row.x[f] ?? []);
}

function scored(
  rows: readonly WalkRow030[],
  getP: (r: WalkRow030) => [number, number, number],
  bins: number,
  marketBrier: number | null,
  marketLl: number | null,
): Score032 {
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

export function verdict032(input: {
  fixture: boolean;
  testN: number;
  selectedClass: IncrementalClass032 | null;
}): Verdict032 {
  if (input.fixture || input.testN < 100) return "INSUFFICIENT_DATA";
  if (input.selectedClass === "BEATS_MARKET") return "EDGE_DEMONSTRATED";
  return "NO_DEMONSTRATED_EDGE";
}

export function fingerprint032(input: {
  verdict: Verdict032;
  featureFp: string;
  datasetSha: string;
  selected: ModelId032 | null;
  testScores: Record<string, Score032>;
  predictionsFp: string;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function predictionsFingerprint(input: {
  rows: readonly WalkRow030[];
  preds: Record<ModelId032, (r: WalkRow030) => [number, number, number]>;
}): string {
  const h = createHash("sha256");
  for (const r of input.rows) {
    h.update(r.event.event_id);
    for (const id of ORDER) {
      h.update(input.preds[id](r).map((x) => x.toFixed(12)).join(","));
    }
  }
  return h.digest("hex");
}

export type Task032Report = {
  experiment_id: string;
  task: "032";
  dataset_version: "TASK_031_BASE";
  dataset_sha256: string;
  observed_sha256: string;
  as_of_policy: "STRICT_AS_OF_T_MINUS_1H";
  baseline: "MARKET_DEVIG";
  fixture_mode: boolean;
  strict_events: number;
  feature_fingerprint: string;
  predictions_fingerprint: string;
  HOLDOUT_STATUS: "EMPTY";
  holdout_2020_plus: 0;
  winner: null;
  promoted_model: null | ModelId032;
  declared_best: false;
  auto_promotion: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  test_used_for_selection: false;
  qualified: boolean;
  verdict: Verdict032;
  selected_on_val: ModelId032 | null;
  classes: Record<string, IncrementalClass032 | "BASELINE">;
  partitions: Record<string, { start: string; end: string; events: number }>;
  scores: Record<string, { VALIDATION: Score032; TEST: Score032; CORPUS_HOLDOUT: Score032 }>;
  holm: { n_tests: number; ids: string[]; raw_p: number[]; adjusted_p: number[]; rejected: boolean[] };
  ci95: Record<string, { low: number; high: number } | null>;
  stress: Stress032 | null;
  annual: AnnualRow032[];
  leakage: { id: string; throws: boolean }[];
  features: FeatureAuditRow032[];
  fingerprint: string;
};

export async function runTask032(input: { skipHeavy?: boolean }): Promise<Task032Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp032Config();
  leakMasanielloProduction(cfg.primary_risk_policy);
  assertTestLocked032(false);
  assertHoldoutLocked032(false);
  const { freeze, events } = freezeStrict027({ skipHeavy });
  if (!skipHeavy && !freeze.fixture && freeze.sha256 !== FROZEN_031_SHA256) {
    throw new ExperimentIntegrityError(`TASK 031 base SHA mismatch ${freeze.sha256}`);
  }
  if (!skipHeavy && freeze.sha256 !== FROZEN_028_SHA256_030) {
    throw new ExperimentIntegrityError("frozen 028/031 SHA drifted");
  }
  const t24 = loadMovementByMatchBook(skipHeavy);
  const rows = walk030({ events, partitions: cfg.corpus_partitions, t24 });
  const train = part(rows, "TRAIN");
  const val = part(rows, "VALIDATION");
  const test = part(rows, "TEST");
  const corpusHold = part(rows, "HOLDOUT");

  const m0Val = scored(val, (r) => r.market, cfg.ece_bins, null, null);
  const m0Test = scored(test, (r) => r.market, cfg.ece_bins, null, null);
  const m0Hold = scored(corpusHold, (r) => r.market, cfg.ece_bins, null, null);

  const weights = new Map<ModelId032, { families: Family030[]; W: ResidualWeights | null }>();
  for (const id of ORDER) {
    const families = cfg.groups[id] as Family030[];
    weights.set(id, {
      families,
      W: families.length === 0 ? null : fitResidual({
        markets: train.map((r) => r.market),
        X: train.map((r) => xFam(r, families)),
        y: train.map((r) => r.actual),
        iters: cfg.logistic_iters,
        lr: cfg.logistic_lr,
        seed: cfg.logistic_seed,
      }),
    });
  }

  const scores: Task032Report["scores"] = {};
  const getP = (id: ModelId032) => {
    const spec = weights.get(id)!;
    return (r: WalkRow030): [number, number, number] =>
      id === "market_only" ? r.market : residualPredict(r.market, xFam(r, spec.families), spec.W);
  };
  for (const id of ORDER) {
    const gp = getP(id);
    scores[id] = {
      VALIDATION: scored(val, gp, cfg.ece_bins, m0Val.brier, m0Val.logloss),
      TEST: scored(test, gp, cfg.ece_bins, m0Test.brier, m0Test.logloss),
      CORPUS_HOLDOUT: scored(corpusHold, gp, cfg.ece_bins, m0Hold.brier, m0Hold.logloss),
    };
  }

  const challengers = ORDER.filter((id) => id !== "market_only");
  let selected: ModelId032 | null = null;
  let bestVal = 0;
  for (const id of challengers) {
    const d = scores[id]!.VALIDATION.delta_brier;
    if (d != null && d < -cfg.val_improve_eps && (selected == null || d < bestVal)) {
      selected = id;
      bestVal = d;
    }
  }

  const rawP: number[] = [];
  for (const id of challengers) {
    const gp = getP(id);
    const diffs = test.map((r) => brier3(r.market, r.actual) - brier3(gp(r), r.actual));
    rawP.push(permutationMeanPOneSidedPositive({ values: diffs, nPerm: cfg.permutation_n, seed: cfg.bootstrap_seed }) ?? 1);
  }
  const holm = holmBonferroni(rawP, cfg.alpha);

  const ci95: Record<string, { low: number; high: number } | null> = {};
  for (const id of challengers) {
    const gp = getP(id);
    const diffs = test.map((r) => brier3(gp(r), r.actual) - brier3(r.market, r.actual));
    const nBoot = id === selected ? cfg.bootstrap_n_selected : cfg.bootstrap_n;
    const ci = blockBootstrapMeanCI({
      values: diffs,
      blockIds: test.map((r) => r.week),
      nBoot,
      seed: cfg.bootstrap_seed,
      alpha: cfg.alpha,
    });
    ci95[id] = ci ? { low: ci.low, high: ci.high } : null;
  }

  const classes: Task032Report["classes"] = { market_only: "BASELINE" };
  for (const id of challengers) {
    const i = challengers.indexOf(id);
    classes[id] = incrementalClass032({
      id,
      test: scores[id]!.TEST,
      holmRejected: holm.rejected[i] === true,
      ci: ci95[id] ?? null,
    });
  }

  let stress: Stress032 | null = null;
  if (selected && test.length) {
    stress = stressSelected032({
      test,
      getP: getP(selected),
      getPMissing: (r) => r.market,
      nBoot: cfg.bootstrap_n_selected,
      seed: cfg.bootstrap_seed,
      alpha: cfg.alpha,
      topFraction: cfg.fragile_top_fraction,
    });
  }

  const leakage = runHostileBattery032();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage battery miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }

  const selectedClass = selected ? (classes[selected] as IncrementalClass032) : null;
  const verdict = verdict032({ fixture: freeze.fixture, testN: test.length, selectedClass });
  const qualified = verdict === "EDGE_DEMONSTRATED" && stress?.fragile !== true;
  const preds = Object.fromEntries(ORDER.map((id) => [id, getP(id)])) as Record<
    ModelId032,
    (r: WalkRow030) => [number, number, number]
  >;
  const predictions_fingerprint = predictionsFingerprint({ rows: test, preds });
  const feature_fingerprint = featureFingerprint032({
    policy: cfg.feature_policy_version,
    groups: cfg.groups,
    reconstruction: "walk030-task-032-g6-all-safe",
  });
  const histRate = train.length ? train.filter((r) => r.history_n >= cfg.history_min_meetings).length / train.length : 0;
  const moveRate = train.length ? train.filter((r) => r.movement.available).length / train.length : 0;
  const features = featureInventory032({
    strictEvents: events.length,
    movementTrainRate: moveRate,
    historyTrainRate: histRate,
    disagreementOverlay: existsSync(join(process.cwd(), "audit", "external", "task-029", "books-t1h.csv")),
  });

  const annual: AnnualRow032[] = cfg.solar_years.map((year) => {
    const n = rows.filter((r) => r.year === year).length;
    if (freeze.fixture || n === 0) {
      return {
        year,
        strict: n,
        decisions: 0,
        bets: 0,
        start: 1000,
        end: null,
        pnl: null,
        roi: null,
        max_dd: null,
        risk_policy: null,
        model: null,
        confidence: null,
        status: "INSUFFICIENT_DATA",
      };
    }
    return {
      year,
      strict: n,
      decisions: qualified ? n : 0,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      risk_policy: qualified ? cfg.primary_risk_policy : null,
      model: qualified ? selected : "MARKET_DEVIG",
      confidence: qualified ? "qualified" : "gate_failed",
      status: qualified ? "VALID" : n > 0 ? "NO_EDGE" : "INSUFFICIENT_DATA",
    };
  });

  const fp = fingerprint032({
    verdict,
    featureFp: feature_fingerprint,
    datasetSha: freeze.sha256,
    selected,
    testScores: Object.fromEntries(ORDER.map((id) => [id, scores[id]!.TEST])),
    predictionsFp: predictions_fingerprint,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "032",
    dataset_version: "TASK_031_BASE",
    dataset_sha256: FROZEN_031_SHA256,
    observed_sha256: freeze.sha256,
    as_of_policy: "STRICT_AS_OF_T_MINUS_1H",
    baseline: "MARKET_DEVIG",
    fixture_mode: freeze.fixture,
    strict_events: events.length,
    feature_fingerprint,
    predictions_fingerprint,
    HOLDOUT_STATUS: "EMPTY",
    holdout_2020_plus: 0,
    winner: null,
    promoted_model: qualified && selected ? selected : null,
    declared_best: false,
    auto_promotion: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    test_used_for_selection: false,
    qualified,
    verdict,
    selected_on_val: selected,
    classes,
    partitions: {
      TRAIN: { ...cfg.corpus_partitions.TRAIN, events: train.length },
      VALIDATION: { ...cfg.corpus_partitions.VALIDATION, events: val.length },
      TEST: { ...cfg.corpus_partitions.TEST, events: test.length },
      HOLDOUT: { ...cfg.corpus_partitions.HOLDOUT, events: corpusHold.length },
    },
    scores,
    holm: {
      n_tests: challengers.length,
      ids: [...challengers],
      raw_p: rawP,
      adjusted_p: holm.adjusted,
      rejected: holm.rejected,
    },
    ci95,
    stress,
    annual,
    leakage,
    features,
    fingerprint: fp,
  };
}

export function loadTask032ReportForUi(): Task032Report | null {
  const p = join(process.cwd(), "artifacts", "task-032-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task032Report;
    if (raw.experiment_id === "exp_032_incremental_edge") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask032(): Promise<Task032Report> {
  return loadTask032ReportForUi() ?? runTask032({ skipHeavy: true });
}
