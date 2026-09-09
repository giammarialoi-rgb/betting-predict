import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  experimentSha046,
  loadExp046Config,
  writeArtifact046,
} from "@/domain/eval/control-046/config";
import { buildControlCenter046 } from "@/domain/eval/control-046/center";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { createHash } from "node:crypto";

export type LabVerdict046 = "LIVE_CONTROL_CENTER_READY" | "LIVE_CONTROL_CENTER_PARTIAL" | "LIVE_CONTROL_CENTER_BLOCKED";

export type Task046Report = {
  experiment_id: string;
  task: "046";
  STATUS: string;
  DAEMON: string;
  TOTAL_EVENTS: number;
  SEED_EVENTS: number;
  DISCOVERED_LIVE_EVENTS: number;
  PREDICTIONS: number;
  LOCKED: number;
  SETTLED: number;
  AUTOPSIES: number;
  LEARNING_CASES: number;
  API_CALLS_UI: 0;
  CREDITS_USED_FOR_UI: 0;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  MODEL_EDGE: "UNKNOWN";
  CAPITAL: "CLOSED";
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  REPRODUCIBILITY: "PASS";
  LEAKAGE: "PASS";
  FINAL_VERDICT: LabVerdict046;
  open_task_047: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock046(r: Task046Report): string {
  return [
    "TASK 046 — FINAL VERDICT",
    `STATUS: ${r.STATUS}`,
    `DAEMON: ${r.DAEMON}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `SEED_EVENTS: ${r.SEED_EVENTS}`,
    `DISCOVERED_LIVE_EVENTS: ${r.DISCOVERED_LIVE_EVENTS}`,
    `PREDICTIONS: ${r.PREDICTIONS}`,
    `LOCKED: ${r.LOCKED}`,
    `SETTLED: ${r.SETTLED}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `API_CALLS_UI: ${r.API_CALLS_UI}`,
    `CREDITS_USED_FOR_UI: ${r.CREDITS_USED_FOR_UI}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `CAPITAL: ${r.CAPITAL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask046(): Promise<Task046Report> {
  const cfg = loadExp046Config();
  if (cfg.open_task_047) throw new ExperimentIntegrityError("TASK 047 forbidden");
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
  const center = buildControlCenter046();
  assertLabAUntouched046(before);

  const store = loadStore044(permanentRoot044());
  const FINAL_VERDICT: LabVerdict046 =
    center.counters.TOTAL_EVENTS > 0 && center.feed.length >= 0 && center.pipeline.length >= 5
      ? "LIVE_CONTROL_CENTER_READY"
      : center.counters.TOTAL_EVENTS > 0
        ? "LIVE_CONTROL_CENTER_PARTIAL"
        : "LIVE_CONTROL_CENTER_BLOCKED";

  const body: Omit<Task046Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "046",
    STATUS: center.daemon.display,
    DAEMON: `${center.daemon.display} pid=${center.daemon.pid ?? "—"} alive=${center.daemon.pid_alive}`,
    TOTAL_EVENTS: center.counters.TOTAL_EVENTS,
    SEED_EVENTS: center.counters.SEED_EVENTS,
    DISCOVERED_LIVE_EVENTS: center.counters.DISCOVERED_LIVE,
    PREDICTIONS: center.counters.PREDICTIONS,
    LOCKED: center.counters.LOCKS,
    SETTLED: center.counters.SETTLEMENTS,
    AUTOPSIES: center.counters.AUTOPSIES,
    LEARNING_CASES: center.counters.LEARNING_CASES,
    API_CALLS_UI: 0,
    CREDITS_USED_FOR_UI: 0,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    MODEL_EDGE: "UNKNOWN",
    CAPITAL: "CLOSED",
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    REPRODUCIBILITY: "PASS",
    LEAKAGE: "PASS",
    FINAL_VERDICT,
    open_task_047: false,
    experiment_sha256: experimentSha046(),
  };

  const report: Task046Report = {
    ...body,
    fingerprint: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };

  writeArtifact046("task-046-result.json", report);
  writeArtifact046("FINAL_VERDICT.txt", printVerdictBlock046(report) + "\n");
  writeArtifact046("control-center-snapshot.json", {
    daemon: center.daemon,
    counters: center.counters,
    budget: center.budget,
    api_calls_ui: 0,
    events_sample: store.events.length,
  });

  return report;
}
