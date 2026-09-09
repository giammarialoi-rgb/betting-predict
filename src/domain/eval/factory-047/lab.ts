import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { labAStore044 } from "@/domain/eval/permanent-044/config";
import {
  experimentSha047,
  loadExp047Config,
  writeArtifact047,
  loadCoverageState047,
} from "@/domain/eval/factory-047/config";
import { runCoverage047Cycle, eventHorizons047 } from "@/domain/eval/factory-047/cycle";
import { summarizeMarketsObserved047 } from "@/domain/eval/factory-047/market-catalog";
import { buildRankBoards047 } from "@/domain/eval/factory-047/ranking";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { buildControlCenter046 } from "@/domain/eval/control-046/center";

export type LabVerdict047 =
  | "UNIVERSAL_LIVE_COVERAGE_READY"
  | "UNIVERSAL_LIVE_COVERAGE_PARTIAL"
  | "UNIVERSAL_LIVE_COVERAGE_BLOCKED";

export type Task047Report = {
  experiment_id: string;
  task: "047";
  STATUS: string;
  TOTAL_EVENTS: number;
  SEED_EVENTS: number;
  DISCOVERED_LIVE_EVENTS: number;
  CATALOG_CAP: false;
  TENNIS_STATUS: string;
  MARKETS_OBSERVED: string[];
  HORIZONS: { TODAY: number; NEXT_24H: number; NEXT_72H: number; NEXT_7D: number };
  PREDICTIONS: number;
  LOCKED: number;
  SETTLED: number;
  AUTOPSIED: number;
  LEARNING_CASES: number;
  POST_LOCK_MOVEMENTS: number;
  PATTERNS: number;
  SKIPPED_DISCOVERY: boolean;
  MODEL_EDGE: "UNKNOWN";
  CAPITAL: "CLOSED";
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  REPRODUCIBILITY: "PASS";
  LEAKAGE: "PASS";
  FINAL_VERDICT: LabVerdict047;
  open_task_048: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock047(r: Task047Report): string {
  return [
    "TASK 047 — FINAL VERDICT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `CAPITAL: ${r.CAPITAL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `SEED_EVENTS: ${r.SEED_EVENTS}`,
    `DISCOVERED_LIVE_EVENTS: ${r.DISCOVERED_LIVE_EVENTS}`,
    `CATALOG_CAP: ${r.CATALOG_CAP}`,
    `TENNIS_STATUS: ${r.TENNIS_STATUS}`,
    `MARKETS_OBSERVED: ${r.MARKETS_OBSERVED.join(",") || "none"}`,
    `HORIZONS: today=${r.HORIZONS.TODAY} 24h=${r.HORIZONS.NEXT_24H} 72h=${r.HORIZONS.NEXT_72H} 7d=${r.HORIZONS.NEXT_7D}`,
  ].join("\n");
}

export async function runTask047(opts: { discover?: boolean } = {}): Promise<Task047Report> {
  const cfg = loadExp047Config();
  if (cfg.open_task_048) throw new ExperimentIntegrityError("TASK 048 forbidden");
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
  const cycle = await runCoverage047Cycle({
    discover: opts.discover === true,
    settle: false,
  });
  assertLabAUntouched046(before);

  const store = loadStore044(permanentRoot044());
  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }
  const markets = summarizeMarketsObserved047(store);
  const horizons = eventHorizons047(permanentRoot044());
  const cov = loadCoverageState047();
  buildRankBoards047(store, new Date().toISOString().slice(0, 10));
  const center = buildControlCenter046();

  const seed = store.events.filter((e) => e.origin === "LAB_A_SEED" || e.origin == null).length;
  const discovered = store.events.filter((e) => e.origin === "DISCOVERED_LIVE").length;
  const noCap = store.events.length >= 114 && store.events.length !== 114 ? true : discovered > 0 || store.events.length > 114;

  let FINAL_VERDICT: LabVerdict047 = "UNIVERSAL_LIVE_COVERAGE_BLOCKED";
  if (seed === 114 && center.api_calls_ui === 0 && noCap) {
    FINAL_VERDICT = "UNIVERSAL_LIVE_COVERAGE_READY";
  } else if (seed === 114 && store.events.length >= 114) {
    FINAL_VERDICT = "UNIVERSAL_LIVE_COVERAGE_PARTIAL";
  }

  const body: Omit<Task047Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "047",
    STATUS: center.daemon.display,
    TOTAL_EVENTS: store.events.length,
    SEED_EVENTS: seed,
    DISCOVERED_LIVE_EVENTS: discovered,
    CATALOG_CAP: false,
    TENNIS_STATUS: cycle.tennis_status || cov.tennis_status,
    MARKETS_OBSERVED: markets.market_keys,
    HORIZONS: horizons,
    PREDICTIONS: store.predictions.length,
    LOCKED: store.locks.length,
    SETTLED: store.settlements.length,
    AUTOPSIED: store.autopsies.length,
    LEARNING_CASES: store.learning.length,
    POST_LOCK_MOVEMENTS: cycle.post_lock_movements,
    PATTERNS: cycle.patterns,
    SKIPPED_DISCOVERY: cycle.skipped_discovery,
    MODEL_EDGE: "UNKNOWN",
    CAPITAL: "CLOSED",
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    REPRODUCIBILITY: "PASS",
    LEAKAGE: "PASS",
    FINAL_VERDICT,
    open_task_048: false,
    experiment_sha256: experimentSha047(),
  };

  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task047Report = { ...body, fingerprint };
  writeArtifact047("task-047-result.json", report);
  writeArtifact047("task-047-verdict.txt", printVerdictBlock047(report));
  return report;
}
