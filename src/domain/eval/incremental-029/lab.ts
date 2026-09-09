import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { brier3 } from "@/domain/eval/capital-020/models";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { scoreRows } from "@/domain/eval/validation-028/metrics";
import {
  blockBootstrapMeanCI,
  permutationMeanPOneSidedPositive,
} from "@/domain/eval/validation-028/stats";
import { FROZEN_028_SHA256, PARSER_VERSION_029, type AnnualRow029, type Family029, type ModelId029, type Score029, type Verdict029 } from "@/domain/eval/incremental-029/types";
import { loadExp029Config } from "@/domain/eval/incremental-029/config";
import { acquireTask029 } from "@/domain/eval/incremental-029/acquire";
import { loadBooksByMatch } from "@/domain/eval/incremental-029/overlay";
import { fitResidual, residualPredict, type ResidualWeights } from "@/domain/eval/incremental-029/residual";
import { walk029, type WalkRow029 } from "@/domain/eval/incremental-029/walk";
import { runHostileBattery029 } from "@/domain/eval/incremental-029/leakage";
import { verdict029 } from "@/domain/eval/incremental-029/verdict";
import { sampleEvidence029 } from "@/domain/eval/incremental-029/evidence";

const FAMILY_OF: Record<Exclude<ModelId029, "market_only" | "market_all_safe" | "ensemble">, Family029> = {
  market_elo: "elo",
  market_form: "form",
  market_schedule: "schedule",
  market_disagreement: "disagreement",
  market_news: "news",
  market_weather: "weather",
};

function part(rows: readonly WalkRow029[], p: WalkRow029["partition"]): WalkRow029[] {
  return rows.filter((r) => r.partition === p);
}

function xFam(row: WalkRow029, families: readonly Family029[]): number[] {
  return families.flatMap((f) => row.x[f] ?? []);
}

function fitOn(rows: readonly WalkRow029[], families: readonly Family029[], cfg: ReturnType<typeof loadExp029Config>): ResidualWeights {
  return fitResidual({
    markets: rows.map((r) => r.market),
    X: rows.map((r) => xFam(r, families)),
    y: rows.map((r) => r.actual),
    iters: cfg.logistic_iters,
    lr: cfg.logistic_lr,
    seed: cfg.logistic_seed,
  });
}

function predictRow(row: WalkRow029, families: readonly Family029[], W: ResidualWeights | null, mixMarket: boolean): [number, number, number] {
  const p = residualPredict(row.market, xFam(row, families), W);
  if (!mixMarket) return p;
  const h = (p[0] + row.market[0]) / 2;
  const d = (p[1] + row.market[1]) / 2;
  const a = (p[2] + row.market[2]) / 2;
  const z = h + d + a;
  return [h / z, d / z, a / z];
}

function scored(
  rows: readonly WalkRow029[],
  getP: (r: WalkRow029) => [number, number, number],
  bins: number,
  marketBrier: number | null,
  marketLl: number | null,
): Score029 {
  const packed = rows.map((r) => ({ p: getP(r), actual: r.actual }));
  const s = scoreRows(packed, bins);
  return {
    ...s,
    delta_brier: s.brier != null && marketBrier != null ? s.brier - marketBrier : null,
    delta_logloss: s.logloss != null && marketLl != null ? s.logloss - marketLl : null,
  };
}

export type Task029Report = {
  experiment_id: string;
  task: "029";
  parser_version: typeof PARSER_VERSION_029;
  git_commit: string | null;
  frozen_028_sha256: string;
  observed_sha256: string;
  fixture_mode: boolean;
  winner: null;
  declared_best: false;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  promotion: "BLOCKED";
  verdict: Verdict029;
  overlay_rows: number;
  overlay_sha256: string | null;
  disagreement_coverage_test: number;
  selected_families: Family029[];
  partitions: Record<string, { start: string; end: string; events: number }>;
  scores: Record<string, { TEST: Score029; VALIDATION: Score029; HOLDOUT: Score029 }>;
  holm: { family: string; n_tests: number; ids: string[]; raw_p: number[]; adjusted_p: number[]; rejected: boolean[] };
  family_labels: Record<string, "CANDIDATE_SIGNAL" | "NO_INCREMENTAL_VALUE" | "HARMFUL" | "UNAVAILABLE">;
  ablation_loo: Record<string, { val_delta_brier: number | null; test_delta_brier: number | null }>;
  annual: AnnualRow029[];
  sources: ReturnType<typeof acquireTask029> extends Promise<infer R> ? R["sources"] : never;
  leakage: { id: string; throws: boolean }[];
  sample_assessment: ReturnType<typeof sampleEvidence029>;
  predictive_gate: boolean;
  ci95_delta_brier_m7: { low: number; high: number } | null;
};

export async function runTask029(input: { skipHeavy?: boolean }): Promise<Task029Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp029Config();
  const { freeze, events } = freezeStrict027({ skipHeavy });
  if (!skipHeavy && !freeze.fixture && freeze.sha256 !== FROZEN_028_SHA256) {
    throw new Error(`ExperimentIntegrityError: TASK 028 dataset SHA mismatch ${freeze.sha256}`);
  }
  const acq = await acquireTask029({ skipHeavy });
  const books = loadBooksByMatch(skipHeavy);
  const rows = walk029({ events, cfg029: cfg, books });
  const train = part(rows, "TRAIN");
  const val = part(rows, "VALIDATION");
  const test = part(rows, "TEST");
  const hold = part(rows, "HOLDOUT");

  const m0Test = scored(test, (r) => r.market, cfg.ece_bins, null, null);
  const m0Val = scored(val, (r) => r.market, cfg.ece_bins, null, null);
  const m0Hold = scored(hold, (r) => r.market, cfg.ece_bins, null, null);

  const weights = new Map<ModelId029, { families: Family029[]; W: ResidualWeights | null; mix: boolean }>();
  weights.set("market_only", { families: [], W: null, mix: false });

  const familyModels: Exclude<ModelId029, "market_only" | "market_all_safe" | "ensemble">[] = [
    "market_elo",
    "market_form",
    "market_schedule",
    "market_disagreement",
    "market_news",
    "market_weather",
  ];
  for (const id of familyModels) {
    const fam: Family029[] = [FAMILY_OF[id]];
    weights.set(id, { families: fam, W: fitOn(train, fam, cfg), mix: false });
  }

  const selected: Family029[] = [];
  const labels: Task029Report["family_labels"] = {};
  for (const id of familyModels) {
    const spec = weights.get(id)!;
    const sVal = scored(val, (r) => predictRow(r, spec.families, spec.W, false), cfg.ece_bins, m0Val.brier, m0Val.logloss);
    const fam = FAMILY_OF[id];
    if (sVal.n === 0) {
      labels[fam] = "UNAVAILABLE";
      continue;
    }
    if (sVal.delta_brier != null && sVal.delta_brier < -cfg.val_improve_eps) {
      labels[fam] = "CANDIDATE_SIGNAL";
      if (fam !== "news" && fam !== "weather") selected.push(fam);
    } else if (sVal.delta_brier != null && sVal.delta_brier > cfg.val_improve_eps) {
      labels[fam] = "HARMFUL";
    } else {
      labels[fam] = "NO_INCREMENTAL_VALUE";
    }
  }

  const allFam = selected.length ? selected : [];
  weights.set("market_all_safe", {
    families: allFam,
    W: allFam.length ? fitOn(train, allFam, cfg) : null,
    mix: false,
  });
  weights.set("ensemble", {
    families: allFam,
    W: allFam.length ? weights.get("market_all_safe")!.W : null,
    mix: true,
  });

  const scores: Task029Report["scores"] = {};
  for (const id of cfg.models) {
    const spec = weights.get(id)!;
    const getP = (r: WalkRow029) =>
      id === "market_only" ? r.market : predictRow(r, spec.families, spec.W, spec.mix);
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
    const diffs: number[] = [];
    for (const r of test) {
      const p = id === "market_only" ? r.market : predictRow(r, spec.families, spec.W, spec.mix);
      diffs.push(brier3(r.market, r.actual) - brier3(p, r.actual));
    }
    rawP.push(permutationMeanPOneSidedPositive({ values: diffs, nPerm: cfg.permutation_n, seed: cfg.bootstrap_seed }) ?? 1);
  }
  const holm = holmBonferroni(rawP, cfg.alpha);

  const m7 = scores.market_all_safe?.TEST;
  const m7Hold = scores.market_all_safe?.HOLDOUT;
  const beatsTest = (m7?.delta_brier ?? 1) < 0 && (m7?.delta_logloss ?? 1) <= 0;
  const beatsHold = (m7Hold?.delta_brier ?? 1) < 0;
  const replicatedLocal = familyModels.some(
    (id) => labels[FAMILY_OF[id]] === "CANDIDATE_SIGNAL" && (scores[id]?.TEST.delta_brier ?? 1) < 0,
  );
  const m7Idx = challengers.indexOf("market_all_safe");
  const holmOk = m7Idx >= 0 && holm.rejected[m7Idx] === true && beatsTest;

  const m7Diffs = test.map((r) => {
    const spec = weights.get("market_all_safe")!;
    const p = predictRow(r, spec.families, spec.W, false);
    return brier3(r.market, r.actual) - brier3(p, r.actual);
  });
  const ci = blockBootstrapMeanCI({
    values: m7Diffs,
    blockIds: test.map((r) => r.week),
    nBoot: cfg.bootstrap_n,
    seed: cfg.bootstrap_seed,
    alpha: cfg.alpha,
  });

  const ablation_loo: Task029Report["ablation_loo"] = {};
  if (allFam.length >= 2) {
    for (const drop of allFam) {
      const rest = allFam.filter((f) => f !== drop);
      const W = rest.length ? fitOn(train, rest, cfg) : null;
      ablation_loo[drop] = {
        val_delta_brier: scored(val, (r) => predictRow(r, rest, W, false), cfg.ece_bins, m0Val.brier, m0Val.logloss).delta_brier,
        test_delta_brier: scored(test, (r) => predictRow(r, rest, W, false), cfg.ece_bins, m0Test.brier, m0Test.logloss).delta_brier,
      };
    }
  }

  const leakage = runHostileBattery029();
  const verdict = verdict029({
    fixture: freeze.fixture,
    testN: test.length,
    leakageFail: leakage.some((l) => !l.throws),
    anyBeatsMarketTest: beatsTest || replicatedLocal,
    holmRejects: holmOk,
    holdoutAlsoBeats: beatsHold,
    singleLeague: new Set(test.map((r) => r.event.competition)).size < 3,
    projectHoldoutN: 0,
  });

  const counts = {
    TRAIN: train.length,
    VALIDATION: val.length,
    TEST: test.length,
    HOLDOUT: hold.length,
  };
  const partitions = {
    TRAIN: { ...cfg.corpus_partitions.TRAIN, events: counts.TRAIN },
    VALIDATION: { ...cfg.corpus_partitions.VALIDATION, events: counts.VALIDATION },
    TEST: { ...cfg.corpus_partitions.TEST, events: counts.TEST },
    HOLDOUT: { ...cfg.corpus_partitions.HOLDOUT, events: counts.HOLDOUT },
  };

  const annual: AnnualRow029[] = cfg.solar_years.map((year) => {
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
      status: beatsTest && holmOk ? "NO_BET" : "NO_EDGE",
    };
  });

  const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const cov = test.length ? test.filter((r) => r.disagree.n >= 2).length / test.length : 0;

  return {
    experiment_id: cfg.experiment_id,
    task: "029",
    parser_version: PARSER_VERSION_029,
    git_commit: git.status === 0 ? git.stdout.trim() : null,
    frozen_028_sha256: FROZEN_028_SHA256,
    observed_sha256: freeze.sha256,
    fixture_mode: freeze.fixture,
    winner: null,
    declared_best: false,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    promotion: "BLOCKED",
    verdict,
    overlay_rows: acq.overlay_rows,
    overlay_sha256: acq.overlay_sha256,
    disagreement_coverage_test: cov,
    selected_families: selected,
    partitions,
    scores,
    holm: {
      family: "TEST_delta_brier_market_minus_model_onesided",
      n_tests: challengers.length,
      ids: [...challengers],
      raw_p: rawP,
      adjusted_p: holm.adjusted,
      rejected: holm.rejected,
    },
    family_labels: labels,
    ablation_loo,
    annual,
    sources: acq.sources,
    leakage,
    sample_assessment: sampleEvidence029(test[0] ?? rows[0] ?? null),
    predictive_gate: beatsTest && holmOk,
    ci95_delta_brier_m7: ci ? { low: ci.low, high: ci.high } : null,
  };
}

export function loadTask029ReportForUi(): Task029Report | null {
  const p = join(process.cwd(), "artifacts", "task-029-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task029Report;
    if (raw.experiment_id === "exp_029_information_incremental_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask029(): Promise<Task029Report> {
  return loadTask029ReportForUi() ?? runTask029({ skipHeavy: true });
}
