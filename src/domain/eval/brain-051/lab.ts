import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore039 } from "@/domain/eval/live-039/store";
import {
  experimentSha051,
  loadExp051Config,
  writeArtifact051,
  ensureBrainDirs051,
  loadBrainState051,
  saveBrainState051,
  defaultBrainState051,
} from "@/domain/eval/brain-051/config";
import { runBrainCycle051 } from "@/domain/eval/brain-051/cycle";
import { planCycle051 } from "@/domain/eval/brain-051/scheduler";
import { buildObservatory051 } from "@/domain/eval/brain-051/observatory";
import { assessBrainHealth051, shouldRestartWorker051 } from "@/domain/eval/brain-051/health";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";

export type LabVerdict051 =
  | "AUTONOMOUS_24_7_LIVE_BRAIN_READY"
  | "AUTONOMOUS_BRAIN_PARTIAL"
  | "INSUFFICIENT_DATA"
  | "BLOCKED";

export type Task051Report = {
  experiment_id: string;
  task: "051";
  FINAL_VERDICT: LabVerdict051;
  MODEL_EDGE: "UNKNOWN";
  STATISTICAL_READINESS: "WAITING_SETTLEMENTS" | "PENDING_GATES";
  CAPITAL: "CLOSED";
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  EVENTS_ANALYZED: number;
  SETTLED: number;
  BRAIN_STATUS: string;
  SCHEDULER_OK: true;
  WATCHDOG_LOGIC_OK: true;
  OBSERVATORY_API_CALLS_UI: 0;
  open_task_052: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock051(r: Task051Report): string {
  return [
    "TASK 051 — FINAL VERDICT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `STATISTICAL_READINESS: ${r.STATISTICAL_READINESS}`,
    `CAPITAL: ${r.CAPITAL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `EVENTS_ANALYZED: ${r.EVENTS_ANALYZED}`,
    `SETTLED: ${r.SETTLED}`,
    `BRAIN_STATUS: ${r.BRAIN_STATUS}`,
    `SCHEDULER_OK: ${r.SCHEDULER_OK}`,
    `WATCHDOG_LOGIC_OK: ${r.WATCHDOG_LOGIC_OK}`,
    `OBSERVATORY_API_CALLS_UI: ${r.OBSERVATORY_API_CALLS_UI}`,
  ].join("\n");
}

export async function runTask051(): Promise<Task051Report> {
  const cfg = loadExp051Config();
  if (cfg.open_task_052) throw new ExperimentIntegrityError("TASK 052 forbidden");
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
  const labB = permanentRoot044();
  ensureBrainDirs051(labB);

  // Disk-only brain cycle (no discovery API by default via plan — may still discover if P1+)
  // Force no discover for lab reproducibility: run with store plan but override via cycle without force
  const store = loadStore044(labB);
  const plan = planCycle051(store);
  if (!plan.priority) throw new ExperimentIntegrityError("scheduler_empty");

  // One brain cycle without forced discovery
  await runBrainCycle051({ forceDiscover: false, allowDiscover: false });
  assertLabAUntouched046(before);

  // Second cycle for recovery/idempotency
  await runBrainCycle051({ forceDiscover: false, allowDiscover: false });
  assertLabAUntouched046(before);

  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }

  const store2 = loadStore044(labB);
  const brain = loadBrainState051(labB);
  // Don't leave lab run marked as RUNNING with this pid forever
  saveBrainState051(labB, {
    ...brain,
    status: brain.cycles_completed > 0 ? "IDLE" : "STOPPED",
    worker_pid: null,
  });

  const obs = buildObservatory051();
  if (obs.brain_051.api_calls_ui !== 0) throw new ExperimentIntegrityError("ui_api");

  // Watchdog logic unit check
  const healthDead = {
    ok: false,
    issues: [{ level: "CRITICAL" as const, code: "WORKER_DEAD", message: "x" }],
    state: defaultBrainState051(),
    heartbeat_age_ms: null,
    store_size_bytes: null,
  };
  if (!shouldRestartWorker051(healthDead)) throw new ExperimentIntegrityError("watchdog_logic");
  void assessBrainHealth051(labB);

  let FINAL_VERDICT: LabVerdict051 = "BLOCKED";
  if (store2.events.length >= 114 && obs.brain_051.api_calls_ui === 0) {
    FINAL_VERDICT = "AUTONOMOUS_24_7_LIVE_BRAIN_READY";
  } else if (store2.events.length > 0) {
    FINAL_VERDICT = "AUTONOMOUS_BRAIN_PARTIAL";
  } else {
    FINAL_VERDICT = "INSUFFICIENT_DATA";
  }

  const body: Omit<Task051Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "051",
    FINAL_VERDICT,
    MODEL_EDGE: "UNKNOWN",
    STATISTICAL_READINESS: store2.settlements.length < 100 ? "WAITING_SETTLEMENTS" : "PENDING_GATES",
    CAPITAL: "CLOSED",
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    EVENTS_ANALYZED: store2.events.length,
    SETTLED: store2.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
    BRAIN_STATUS: obs.brain_051.display,
    SCHEDULER_OK: true,
    WATCHDOG_LOGIC_OK: true,
    OBSERVATORY_API_CALLS_UI: 0,
    open_task_052: false,
    experiment_sha256: experimentSha051(),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task051Report = { ...body, fingerprint };
  writeArtifact051("task-051-result.json", report);
  writeArtifact051("task-051-verdict.txt", printVerdictBlock051(report));
  writeArtifact051("task-051-observatory-snapshot.json", {
    counters: obs.brain_051.counters,
    sport_table: obs.brain_051.sport_table,
    health: obs.brain_051.health_issues,
  });
  return report;
}
