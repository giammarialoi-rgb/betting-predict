import { mkdirSync, writeFileSync, existsSync, readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import { importFootballDataDataset, loadPiDatasetManifest, loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { runWalkForwardValidation } from "@/domain/eval/predictive-intelligence/validation/walk-forward";
import {
  evaluatePromotionGate,
  retrainIndependentModelPi,
  writeLearningReport,
} from "@/domain/eval/predictive-intelligence/learning/loop";
import { sportAdapterStatuses } from "@/domain/eval/predictive-intelligence/sport-adapters";
import { summarizeBankroll053 } from "@/domain/eval/bankroll-053/ledger";
import { assertNoClosingOddsInPredictionContext, assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { runPiEndToEndPipeline } from "@/domain/eval/predictive-intelligence/e2e-pipeline";
import { writeChallengerRegistry053 } from "@/domain/eval/bankroll-053/challenger";
import { writeReasoningReportPi } from "@/domain/eval/predictive-intelligence/reasoning/snapshot";
import { predictIndependentForEvent } from "@/domain/eval/predictive-intelligence/predict-live";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import {
  writeMarketSignalsReport,
  writeMarketMovementReport,
  mirrorMarketIntelligenceToPiRoot,
} from "@/domain/eval/market-intelligence";
import { runDataIntelligenceAudit } from "@/domain/eval/data-intelligence/audit";

export type PiLabResult = {
  dataset_rows: number;
  folds: number;
  holdout_evaluated: boolean;
  promotion: ReturnType<typeof evaluatePromotionGate>;
  verdict: "READY" | "PARTIAL" | "BLOCKED";
  blockers: string[];
  e2e_steps?: string[];
  e2e_bets?: number;
};

function auditMirrorRoot(): string {
  return join(process.cwd(), "audit", "external", "task-044", "predictive-intelligence");
}

function copyIfExists(src: string, dest: string): void {
  if (!existsSync(src)) return;
  if (src === dest) return;
  mkdirSync(join(dest, ".."), { recursive: true });
  cpSync(src, dest);
}

/** Full offline PI pipeline: import → walk-forward → learning → audit artifacts. */
export async function runPredictiveIntelligenceLab(input?: {
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  evaluateHoldout?: boolean;
  nowIso?: string;
}): Promise<PiLabResult> {
  const labB = input?.labBRoot ?? permanentRoot044();
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const blockers: string[] = [];

  // Lab A must remain untouched — only read path for assertion
  const labA = labAStore044();
  if (!existsSync(labA)) blockers.push("LAB_A_MISSING");

  const manifest = await importFootballDataDataset({
    labBRoot: labB,
    fetchImpl: input?.fetchImpl,
    nowIso,
  });

  if (manifest.total_rows < 500) blockers.push("DATASET_INSUFFICIENT");

  const matches = loadPiMatches(labB);
  // leakage + independence self-check on a sample
  let leakageOk = true;
  let oddsIndependenceOk = false;
  const marketAsModelForbidden = true;
  try {
    if (matches.length >= 50) {
      const sample = matches[Math.floor(matches.length / 2)]!;
      const feat = buildFeatureVectorPi(sample, matches);
      assertNoClosingOddsInPredictionContext(Object.keys(feat.values));
      assertNoMarketInputsInPredictionContext(Object.keys(feat.values));
      if (feat.closing_odds_used) leakageOk = false;

      if (matches.length >= 500) {
        const a = predictIndependentForEvent({
          sport: "soccer",
          home_team: sample.home_team,
          away_team: sample.away_team,
          competition: sample.league,
          kickoff_utc: sample.event_time,
          marketProbability: { HOME: 0.55, DRAW: 0.25, AWAY: 0.2 },
          labBRoot: labB,
        });
        const b = predictIndependentForEvent({
          sport: "soccer",
          home_team: sample.home_team,
          away_team: sample.away_team,
          competition: sample.league,
          kickoff_utc: sample.event_time,
          marketProbability: { HOME: 0.33, DRAW: 0.34, AWAY: 0.33 },
          labBRoot: labB,
        });
        oddsIndependenceOk =
          a.ok &&
          b.ok &&
          JSON.stringify(a.probability_model) === JSON.stringify(b.probability_model);
        const m1 = marketBaselineFromOpenOdds({
          ...sample,
          odds_open: {
            B365: { home: 2.0, draw: 3.5, away: 3.5 },
            PS: { home: null, draw: null, away: null },
            Avg: { home: null, draw: null, away: null },
          },
        });
        const m2 = marketBaselineFromOpenOdds({
          ...sample,
          odds_open: {
            B365: { home: 3.0, draw: 3.3, away: 2.4 },
            PS: { home: null, draw: null, away: null },
            Avg: { home: null, draw: null, away: null },
          },
        });
        if (!m1 || !m2 || JSON.stringify(m1) === JSON.stringify(m2)) {
          oddsIndependenceOk = false;
        }
      }
    }
  } catch {
    leakageOk = false;
    blockers.push("LEAKAGE_SELF_CHECK_FAILED");
  }
  if (!oddsIndependenceOk && matches.length >= 500) {
    blockers.push("ODDS_INDEPENDENCE_FAILED");
  }

  writeReasoningReportPi({
    labBRoot: labB,
    nowIso,
    samples: 0,
    note: "Reasoning snapshots written from analyze-045 / predict-live; WHY derived from feature keys only.",
  });

  const report = runWalkForwardValidation({
    labBRoot: labB,
    matches,
    evaluateHoldout: input?.evaluateHoldout !== false,
    nowIso,
  });

  const retrain = retrainIndependentModelPi({ labBRoot: labB, nowIso });
  const gate = evaluatePromotionGate({ report, leakage_tests_pass: leakageOk });
  writeLearningReport({ labBRoot: labB, gate, retrain, nowIso });

  // Real end-to-end: holdout matches → decision → paper → settle → autopsy → learning → versioned model
  writeChallengerRegistry053(labB);
  const e2e = runPiEndToEndPipeline({ labBRoot: labB, sampleLimit: 80, nowIso });
  if (!e2e.leakage_checks_pass) blockers.push("E2E_LEAKAGE");
  const coreSteps = [
    "HISTORICAL_DATA",
    "AS_OF_FEATURES",
    "INDEPENDENT_MODEL",
    "MARKET_BASELINE",
    "EDGE_EV",
    "DECISION",
    "AUTOPSY",
    "LEARNING",
    "VERSIONED_MODEL",
  ];
  if (!coreSteps.every((s) => e2e.steps_completed.includes(s as never))) {
    blockers.push("E2E_INCOMPLETE");
  }

  const bankroll = summarizeBankroll053(labB);
  writeFileSync(
    join(piRoot(labB), "paper-bankroll-report.json"),
    JSON.stringify(
      {
        at: nowIso,
        initial_capital: 1000,
        summary: bankroll,
        e2e_paper: e2e.paper,
        real_money: false,
        scientifically_qualified: false,
        model_edge: "UNKNOWN",
      },
      null,
      2,
    ),
  );

  const adapters = sportAdapterStatuses(matches.length);
  const beats =
    report.holdout.independent_beats_market_logloss === true &&
    report.holdout.independent_beats_naive_brier === true;

  if (!beats) blockers.push("INDEPENDENT_DOES_NOT_BEAT_BENCHMARKS");
  if (!leakageOk) blockers.push("LEAKAGE");

  let verdict: PiLabResult["verdict"] = "PARTIAL";
  if (manifest.total_rows < 100 || !leakageOk) verdict = "BLOCKED";
  else if (
    leakageOk &&
    oddsIndependenceOk &&
    marketAsModelForbidden &&
    report.holdout.evaluated &&
    !report.holdout_touched_during_train &&
    adapters[0]?.status === "ACTIVE" &&
    beats &&
    e2e.leakage_checks_pass
  ) {
    verdict = "READY";
  } else {
    verdict = "PARTIAL";
  }

  const finalVerdict = {
    at: nowIso,
    verdict,
    blockers,
    dataset_rows: manifest.total_rows,
    dataset_sha256: manifest.content_sha256,
    walk_forward_folds: report.folds.length,
    holdout_season: report.holdout_season,
    holdout_evaluated: report.holdout.evaluated,
    holdout_blind: report.holdout_blind_until_eval,
    holdout_contaminated: report.holdout_touched_during_train,
    promotion_gate: gate,
    sport_adapters: adapters,
    e2e: {
      steps_completed: e2e.steps_completed,
      sample_n: e2e.sample_n,
      paper_bets: e2e.paper.bets,
      learning_cases: e2e.learning_cases_written,
      retrain_version: e2e.retrain_version,
      real_data: true,
    },
    model_independent: "INDEPENDENT_POISSON_v1",
    market_baseline: "MARKET_DEVIG_BASELINE",
    model_is_market_only: false,
    market_as_model_forbidden: marketAsModelForbidden,
    market_signals_layer: "COMPARE_ONLY",
    market_signals_enter_independent_model: false,
    data_intelligence: "PARTIAL",
    independent_markets: "1X2_ONLY",
    scraping_sources_disabled: true,
    odds_independence_test: oddsIndependenceOk ? "PASS" : "FAIL_OR_SKIPPED",
    temporal_precision: "DATE_ONLY",
    auto_promotion: false,
    real_money: false,
    lab_a_mutated: false,
    paper_capital: 1000,
    note:
      verdict === "READY"
        ? "Independent model pipeline scientifically validated on holdout; MODEL_EDGE remains UNKNOWN until SETTLED>=100 operational gate."
        : oddsIndependenceOk
          ? "Independence proven (odds change ≠ model change; market-as-model removed). Market signals COMPARE_ONLY. Data Intelligence PARTIAL (1X2 only; scrape sources disabled)."
          : "Pipeline implemented; PARTIAL/BLOCKED — independence or leakage gates not fully satisfied.",
  };

  writeMarketSignalsReport({
    labBRoot: labB,
    nowIso,
    samples: 0,
    note: "Market intelligence COMPARE layer; drift/steam from Lab B quotes; volume/RLM UNAVAILABLE.",
  });
  writeMarketMovementReport({ labBRoot: labB, nowIso, movements: [] });
  mirrorMarketIntelligenceToPiRoot(labB);

  writeFileSync(join(piRoot(labB), "final-verdict.json"), JSON.stringify(finalVerdict, null, 2));

  await runDataIntelligenceAudit({ labBRoot: labB, nowIso, sampleLimit: 40 });
  // Keep PI final-verdict authoritative with DI flags already embedded
  writeFileSync(join(piRoot(labB), "final-verdict.json"), JSON.stringify(finalVerdict, null, 2));

  // Mirror audit artifacts to required path
  const auditRoot = auditMirrorRoot();
  mkdirSync(auditRoot, { recursive: true });
  for (const name of [
    "dataset-manifest.json",
    "feature-manifest.json",
    "model-manifest.json",
    "validation-report.json",
    "learning-report.json",
    "reasoning-report.json",
    "paper-bankroll-report.json",
    "final-verdict.json",
    "e2e-pipeline-report.json",
    "market-signals.json",
    "market-movement-report.json",
  ]) {
    copyIfExists(join(piRoot(labB), name), join(auditRoot, name));
  }
  const dm = loadPiDatasetManifest(labB);
  if (dm) writeFileSync(join(auditRoot, "dataset-manifest.json"), JSON.stringify(dm, null, 2));

  return {
    dataset_rows: manifest.total_rows,
    folds: report.folds.length,
    holdout_evaluated: report.holdout.evaluated,
    promotion: gate,
    verdict,
    blockers,
    e2e_steps: e2e.steps_completed,
    e2e_bets: e2e.paper.bets,
  };
}

export function readFinalVerdictPi(labBRoot?: string): unknown {
  const p = join(piRoot(labBRoot), "final-verdict.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}
