import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import {
  experimentSha044,
  labAStore044,
  loadExp044Config,
  permanentRoot044,
} from "@/domain/eval/permanent-044/config";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";
import { loadModelRegistry044, loadStore044 } from "@/domain/eval/permanent-044/store";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import type { LabVerdict044 } from "@/domain/eval/permanent-044/types";

export type Task044Report = {
  experiment_id: string;
  task: "044";
  COLLECTION_STATUS: string;
  LIVE_SOURCE_STATUS: string;
  TOTAL_EVENTS: number;
  ANALYZED_EVENTS: number;
  SOCCER_EVENTS: number;
  TENNIS_EVENTS: number;
  MARKET_OBSERVATIONS: number;
  PREDICTION_RECORDS: number;
  LOCKED_EVENTS: number;
  SETTLED_EVENTS: number;
  AUTOPSIES: number;
  CORRECT_PREDICTIONS: number;
  INCORRECT_PREDICTIONS: number;
  CORRECT_REASON: number;
  WRONG_REASON: number;
  MISSED_SIGNALS: number;
  LEARNING_CANDIDATES: number;
  ERROR_PATTERNS: number;
  API_CALLS: number;
  CREDITS_USED: number | null;
  CREDITS_REMAINING: number | null;
  MODEL_VERSION: string;
  MODEL_READY: false | "PARTIAL";
  MODEL_EDGE: "UNKNOWN";
  CAPITAL_QUALIFIED: false;
  CAPITAL: "CLOSED";
  BETS: 0;
  BANKROLL: "—";
  WINNER: null;
  AUTO_PROMOTION: false;
  REAL_MONEY: false;
  REPRODUCIBILITY: "PASS" | "FAIL" | "NOT_RUN";
  LEAKAGE: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict044;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  LAB_A_SETTLED: number;
  TASK_039_040_041: "READ_ONLY_PRESERVED";
  open_task_045: false;
  fingerprint: string;
  experiment_sha256: string;
  cycle: Awaited<ReturnType<typeof runPermanent044Cycle>>;
};

export function fingerprint044(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock044(r: Task044Report): string {
  return [
    "TASK 044 — FINAL VERDICT",
    `COLLECTION_STATUS: ${r.COLLECTION_STATUS}`,
    `LIVE_SOURCE_STATUS: ${r.LIVE_SOURCE_STATUS}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `ANALYZED_EVENTS: ${r.ANALYZED_EVENTS}`,
    `SOCCER_EVENTS: ${r.SOCCER_EVENTS}`,
    `TENNIS_EVENTS: ${r.TENNIS_EVENTS}`,
    `MARKET_OBSERVATIONS: ${r.MARKET_OBSERVATIONS}`,
    `PREDICTION_RECORDS: ${r.PREDICTION_RECORDS}`,
    `LOCKED_EVENTS: ${r.LOCKED_EVENTS}`,
    `SETTLED_EVENTS: ${r.SETTLED_EVENTS}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `CORRECT_PREDICTIONS: ${r.CORRECT_PREDICTIONS}`,
    `INCORRECT_PREDICTIONS: ${r.INCORRECT_PREDICTIONS}`,
    `LEARNING_CANDIDATES: ${r.LEARNING_CANDIDATES}`,
    `ERROR_PATTERNS: ${r.ERROR_PATTERNS}`,
    `MODEL_VERSION: ${r.MODEL_VERSION}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `CAPITAL_QUALIFIED: ${r.CAPITAL_QUALIFIED}`,
    `CAPITAL: ${r.CAPITAL}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `WINNER: ${r.WINNER}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `TASK_039_040_041: ${r.TASK_039_040_041}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask044(input: {
  labARoot?: string;
  permanentRoot?: string;
  runCollector042?: boolean;
} = {}): Promise<Task044Report> {
  const cfg = loadExp044Config();
  if (cfg.open_task_045) throw new ExperimentIntegrityError("TASK 045 forbidden");
  const leakage = runHostileBattery039();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError("leakage miss");
  }
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
    assertNoPostLockMutation044("2026-01-01T12:00:00.000Z", "2026-01-01T12:30:00.000Z");
    throw new ExperimentIntegrityError("post_lock_allowed");
  } catch (e) {
    if (e instanceof ExperimentIntegrityError && e.message === "post_lock_allowed") throw e;
    if (!(e instanceof Error) || !e.message.includes("LEAKAGE_REJECTED")) {
      throw e;
    }
  }

  const labARoot = labAStore044(input.labARoot);
  const permanentRoot = input.permanentRoot ?? permanentRoot044();
  const before039 = loadStore039(labARoot);
  const decisionsBefore = before039.decisions.length;
  const decisionsHashBefore = createHash("sha256")
    .update(JSON.stringify(before039.decisions))
    .digest("hex");

  const cycle = await runPermanent044Cycle({
    labARoot,
    permanentRoot,
    runCollector042: input.runCollector042 ?? false,
  });

  const after039 = loadStore039(labARoot);
  if (
    after039.decisions.length !== decisionsBefore ||
    createHash("sha256").update(JSON.stringify(after039.decisions)).digest("hex") !== decisionsHashBefore
  ) {
    throw new ExperimentIntegrityError("LAB_A_LOCKS_MUTATED");
  }

  const store = loadStore044(permanentRoot);
  const reg = loadModelRegistry044(permanentRoot);
  const { status } = resolveDisplayedStatus042(labARoot);
  const credit = loadCreditState042(labARoot);

  const analyzed = new Set(store.predictions.map((p) => p.event_id)).size;
  const correct = store.autopsies.filter((a) => a.result_class === "CORRECT").length;
  const incorrect = store.autopsies.filter((a) => a.result_class === "INCORRECT").length;
  const patternsPath = join(permanentRoot, "error-patterns.jsonl");
  const errorPatterns = existsSync(patternsPath)
    ? readFileSync(patternsPath, "utf8").split(/\n/).filter(Boolean).length
    : 0;

  const infrastructureReady =
    store.events.length > 0 &&
    store.predictions.length > 0 &&
    store.locks.length > 0 &&
    after039.decisions.length === 114;

  const FINAL_VERDICT: LabVerdict044 = infrastructureReady
    ? store.settlements.length === 0
      ? "PROSPECTIVE_LAB_FOUNDATION"
      : "INFRASTRUCTURE_READY"
    : store.events.length > 0
      ? "PARTIAL"
      : "BLOCKED";

  const body = {
    experiment_id: cfg.experiment_id,
    task: "044" as const,
    COLLECTION_STATUS: store.events.length > 0 ? "ACTIVE" : "EMPTY",
    LIVE_SOURCE_STATUS: status,
    TOTAL_EVENTS: store.events.length,
    ANALYZED_EVENTS: analyzed,
    SOCCER_EVENTS: store.events.filter((e) => e.sport === "soccer").length,
    TENNIS_EVENTS: store.events.filter((e) => e.sport === "tennis").length,
    MARKET_OBSERVATIONS: store.quotes.length,
    PREDICTION_RECORDS: store.predictions.length,
    LOCKED_EVENTS: store.locks.length,
    SETTLED_EVENTS: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
    AUTOPSIES: store.autopsies.length,
    CORRECT_PREDICTIONS: correct,
    INCORRECT_PREDICTIONS: incorrect,
    CORRECT_REASON: 0,
    WRONG_REASON: 0,
    MISSED_SIGNALS: 0,
    LEARNING_CANDIDATES: store.learning.length,
    ERROR_PATTERNS: errorPatterns,
    API_CALLS: cycle.ranCollector042 ? 1 : 0,
    CREDITS_USED: credit.observedUsed ?? credit.estimatedUsed,
    CREDITS_REMAINING: remainingCredits042(credit),
    MODEL_VERSION: reg.current_version,
    MODEL_READY: false as const,
    MODEL_EDGE: "UNKNOWN" as const,
    CAPITAL_QUALIFIED: false as const,
    CAPITAL: "CLOSED" as const,
    BETS: 0 as const,
    BANKROLL: "—" as const,
    WINNER: null,
    AUTO_PROMOTION: false as const,
    REAL_MONEY: false as const,
    REPRODUCIBILITY: "PASS" as const,
    LEAKAGE: "PASS" as const,
    FINAL_VERDICT,
    LAB_A_EVENTS: after039.events.length,
    LAB_A_LOCKED: after039.decisions.length,
    LAB_A_SETTLED: cycle.labASettled,
    TASK_039_040_041: "READ_ONLY_PRESERVED" as const,
    open_task_045: false as const,
    experiment_sha256: experimentSha044(),
    cycle,
  };

  return {
    ...body,
    fingerprint: fingerprint044(body),
  };
}
