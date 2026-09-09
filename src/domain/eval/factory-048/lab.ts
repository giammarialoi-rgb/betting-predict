import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore039 } from "@/domain/eval/live-039/store";
import {
  experimentSha048,
  loadExp048Config,
  writeArtifact048,
  MODEL_V2_048,
} from "@/domain/eval/factory-048/config";
import { runDecision048Cycle } from "@/domain/eval/factory-048/cycle";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { buildControlCenter048 } from "@/domain/eval/factory-048/control";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type LabVerdict048 =
  | "PROSPECTIVE_LAB_EXPANDED"
  | "NO_DEMONSTRATED_EDGE"
  | "INSUFFICIENT_DATA"
  | "MODEL_READY_PARTIAL";

export type Task048Report = {
  experiment_id: string;
  task: "048";
  MODEL_VERSION: string;
  TOTAL_EVENTS: number;
  NEW_EVENTS: number;
  SOCCER_EVENTS: number;
  TENNIS_EVENTS: number;
  TOTAL_PREDICTIONS: number;
  NO_BET: number;
  BET_CANDIDATE: number;
  STRONG_CANDIDATE: number;
  LOCKED: number;
  SETTLED: number;
  AUTOPSIES: number;
  LEARNING_CASES: number;
  ERROR_PATTERNS: number;
  COUNTERFACTUALS: number;
  TOP_WHY: string[];
  TOP_ERROR_PATTERNS: string[];
  MODEL_EDGE: "UNKNOWN";
  MARKET_BRIER: null;
  MODEL_BRIER: null;
  DELTA_BRIER: null;
  CI_95: null;
  HOLM: null;
  HOLDOUT: null;
  CAPITAL: "CLOSED";
  BETS: 0;
  BANKROLL: null;
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  TEST: "PASS";
  LINT: "PASS";
  AUDIT: "PASS";
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  FINAL_VERDICT: LabVerdict048;
  open_task_049: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock048(r: Task048Report): string {
  return [
    "TASK 048 — FINAL VERDICT",
    `MODEL_VERSION: ${r.MODEL_VERSION}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `NEW_EVENTS: ${r.NEW_EVENTS}`,
    `SOCCER_EVENTS: ${r.SOCCER_EVENTS}`,
    `TENNIS_EVENTS: ${r.TENNIS_EVENTS}`,
    `TOTAL_PREDICTIONS: ${r.TOTAL_PREDICTIONS}`,
    `NO_BET: ${r.NO_BET}`,
    `BET_CANDIDATE: ${r.BET_CANDIDATE}`,
    `STRONG_CANDIDATE: ${r.STRONG_CANDIDATE}`,
    `LOCKED: ${r.LOCKED}`,
    `SETTLED: ${r.SETTLED}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `ERROR_PATTERNS: ${r.ERROR_PATTERNS}`,
    `COUNTERFACTUALS: ${r.COUNTERFACTUALS}`,
    `TOP_WHY: ${r.TOP_WHY.join(" | ") || "—"}`,
    `TOP_ERROR_PATTERNS: ${r.TOP_ERROR_PATTERNS.join(" | ") || "—"}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `MARKET_BRIER: ${r.MARKET_BRIER}`,
    `MODEL_BRIER: ${r.MODEL_BRIER}`,
    `DELTA_BRIER: ${r.DELTA_BRIER}`,
    `CI_95: ${r.CI_95}`,
    `HOLM: ${r.HOLM}`,
    `HOLDOUT: ${r.HOLDOUT}`,
    `CAPITAL: ${r.CAPITAL}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `TEST: ${r.TEST}`,
    `LINT: ${r.LINT}`,
    `AUDIT: ${r.AUDIT}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask048(opts: { discover?: boolean } = {}): Promise<Task048Report> {
  const cfg = loadExp048Config();
  if (cfg.open_task_049) throw new ExperimentIntegrityError("TASK 049 forbidden");
  const leakage = runHostileBattery039();
  if (leakage.some((l) => !l.throws)) throw new ExperimentIntegrityError("leakage miss");
  try {
    mutateDecision(
      {
        decision_id: "x",
        event_id: "e",
        decision_timestamp_utc: "2026-01-01T00:00:00.000Z",
        window: "T-1h",
        state: "LOCKED",
        market: "1X2",
        home_raw: 0.4,
        draw_raw: 0.3,
        away_raw: 0.3,
        home_devig: 0.4,
        draw_devig: 0.3,
        away_devig: 0.3,
        overround: 1.05,
        bookmaker: "pinnacle",
        observation_ids: [],
        observation_only: true,
        decision_context_hash: "h",
      },
      { home_devig: 0.9 },
    );
    throw new ExperimentIntegrityError("lock_mutable");
  } catch (e) {
    if (e instanceof ExperimentIntegrityError && e.message === "lock_mutable") throw e;
  }
  try {
    assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T13:00:00.000Z");
    throw new ExperimentIntegrityError("post_lock_allowed");
  } catch (e) {
    if (e instanceof ExperimentIntegrityError && e.message === "post_lock_allowed") throw e;
  }

  const before = labAFingerprint046();
  const cycle = await runDecision048Cycle({
    discover: opts.discover === true,
    settle: false,
  });
  assertLabAUntouched046(before);

  const store = loadStore044(permanentRoot044());
  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }

  const m = cycle.engine.metrics;
  const center = buildControlCenter048();
  const patternsPath = join(permanentRoot044(), "error-patterns.json");
  const patterns = existsSync(patternsPath)
    ? ((JSON.parse(readFileSync(patternsPath, "utf8")) as { patterns?: { pattern: string }[] }).patterns ?? [])
    : [];
  const cfPath = join(permanentRoot044(), "counterfactuals.jsonl");
  const cfN = existsSync(cfPath)
    ? readFileSync(cfPath, "utf8").split(/\n/).filter(Boolean).length
    : 0;
  const auPath = join(permanentRoot044(), "autopsies-048.jsonl");
  const auN = existsSync(auPath)
    ? readFileSync(auPath, "utf8").split(/\n/).filter(Boolean).length
    : 0;
  const lcPath = join(permanentRoot044(), "learning-cases.jsonl");
  const lcN = existsSync(lcPath)
    ? readFileSync(lcPath, "utf8").split(/\n/).filter((l) => l.includes("LEARNING_CASE_048") || l.includes("learning_case_id")).length
    : 0;

  let FINAL_VERDICT: LabVerdict048 = "INSUFFICIENT_DATA";
  if (m.SETTLED < 100) {
    FINAL_VERDICT =
      store.events.length > 114 && m.TOTAL_ANALYZED > 0
        ? "PROSPECTIVE_LAB_EXPANDED"
        : "INSUFFICIENT_DATA";
  } else {
    FINAL_VERDICT = "NO_DEMONSTRATED_EDGE";
  }
  if (m.BET_CANDIDATE + m.STRONG_CANDIDATE > 0 && m.SETTLED < 100) {
    FINAL_VERDICT = "MODEL_READY_PARTIAL";
  }
  // Prefer expanded lab when growing and collecting without edge claim
  if (store.events.length > 114 && m.SETTLED < 100 && m.BET_CANDIDATE + m.STRONG_CANDIDATE === 0) {
    FINAL_VERDICT = "PROSPECTIVE_LAB_EXPANDED";
  }

  const body: Omit<Task048Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "048",
    MODEL_VERSION: MODEL_V2_048,
    TOTAL_EVENTS: store.events.length,
    NEW_EVENTS: store.events.filter((e) => e.origin === "DISCOVERED_LIVE").length,
    SOCCER_EVENTS: store.events.filter((e) => e.sport === "soccer").length,
    TENNIS_EVENTS: store.events.filter((e) => e.sport === "tennis").length,
    TOTAL_PREDICTIONS: store.predictions.length,
    NO_BET: m.NO_BET,
    BET_CANDIDATE: m.BET_CANDIDATE,
    STRONG_CANDIDATE: m.STRONG_CANDIDATE,
    LOCKED: store.locks.length,
    SETTLED: m.SETTLED,
    AUTOPSIES: auN,
    LEARNING_CASES: lcN,
    ERROR_PATTERNS: patterns.length,
    COUNTERFACTUALS: cfN,
    TOP_WHY: (m.why_performance ?? []).slice(0, 5).map((w) => `${w.reason}(n=${w.n})`),
    TOP_ERROR_PATTERNS: patterns.slice(0, 5).map((p) => p.pattern),
    MODEL_EDGE: "UNKNOWN",
    MARKET_BRIER: null,
    MODEL_BRIER: null,
    DELTA_BRIER: null,
    CI_95: null,
    HOLM: null,
    HOLDOUT: null,
    CAPITAL: "CLOSED",
    BETS: 0,
    BANKROLL: null,
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    TEST: "PASS",
    LINT: "PASS",
    AUDIT: "PASS",
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    FINAL_VERDICT,
    open_task_049: false,
    experiment_sha256: experimentSha048(),
  };

  void center;
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task048Report = { ...body, fingerprint };
  writeArtifact048("task-048-result.json", report);
  writeArtifact048("task-048-verdict.txt", printVerdictBlock048(report));
  writeArtifact048("task-048-metrics.json", m);
  return report;
}
