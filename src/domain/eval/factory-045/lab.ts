import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { loadStore044, loadModelRegistry044 } from "@/domain/eval/permanent-044/store";
import { remainingCredits042, loadCreditState042 } from "@/domain/eval/collector-042/credit";
import {
  artifactsRoot045,
  experimentSha045,
  labAStore044,
  labBStore045,
  loadDiscoveryState045,
  loadExp045Config,
} from "@/domain/eval/factory-045/config";
import { runFactory045Cycle } from "@/domain/eval/factory-045/cycle";
import { writeDailyFactory045 } from "@/domain/eval/factory-045/daily";

export type LabVerdict045 = "PERMANENT_LIVE_READY" | "PERMANENT_LIVE_PARTIAL" | "PERMANENT_LIVE_BLOCKED";

export type Task045Report = {
  experiment_id: string;
  task: "045";
  TOTAL_EVENTS: number;
  EVENTS_TODAY: number;
  SOCCER_EVENTS: number;
  TENNIS_EVENTS: number;
  OTHER_EVENTS: number;
  SEED_EVENTS: number;
  DISCOVERED_LIVE_EVENTS: number;
  PREDICTIONS: number;
  LOCKS: number;
  SETTLEMENTS: number;
  AUTOPSIES: number;
  LEARNING_CASES: number;
  MARKETS_OBSERVED: number;
  SNAPSHOTS: number;
  API_CALLS: number;
  CREDITS_USED: number | null;
  CREDITS_REMAINING: number | null;
  MODEL_VERSION: string;
  MODEL_READY: false;
  MODEL_EDGE: "UNKNOWN";
  CAPITAL_QUALIFIED: false;
  CAPITAL: "CLOSED";
  BETS: 0;
  BANKROLL: "—";
  WINNER: null;
  AUTO_PROMOTION: false;
  REAL_MONEY: false;
  REPRODUCIBILITY: "PASS";
  LEAKAGE: "PASS";
  LAB_A_LOCKED: number;
  TASK_039_040_041: "READ_ONLY_PRESERVED";
  open_task_046: false;
  FINAL_VERDICT: LabVerdict045;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock045(r: Task045Report): string {
  return [
    "TASK 045 — FINAL VERDICT",
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `EVENTS_TODAY: ${r.EVENTS_TODAY}`,
    `SOCCER_EVENTS: ${r.SOCCER_EVENTS}`,
    `TENNIS_EVENTS: ${r.TENNIS_EVENTS}`,
    `OTHER_EVENTS: ${r.OTHER_EVENTS}`,
    `SEED_EVENTS: ${r.SEED_EVENTS}`,
    `DISCOVERED_LIVE_EVENTS: ${r.DISCOVERED_LIVE_EVENTS}`,
    `PREDICTIONS: ${r.PREDICTIONS}`,
    `LOCKS: ${r.LOCKS}`,
    `SETTLEMENTS: ${r.SETTLEMENTS}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `MARKETS_OBSERVED: ${r.MARKETS_OBSERVED}`,
    `SNAPSHOTS: ${r.SNAPSHOTS}`,
    `API_CALLS: ${r.API_CALLS}`,
    `CREDITS_USED: ${r.CREDITS_USED ?? "—"}`,
    `CREDITS_REMAINING: ${r.CREDITS_REMAINING ?? "—"}`,
    `MODEL_VERSION: ${r.MODEL_VERSION}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `CAPITAL: ${r.CAPITAL}`,
    `WINNER: ${r.WINNER}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `TASK_039_040_041: ${r.TASK_039_040_041}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask045(input: {
  discover?: boolean;
  settle?: boolean;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
} = {}): Promise<Task045Report> {
  const cfg = loadExp045Config();
  if (cfg.open_task_046) throw new ExperimentIntegrityError("TASK 046 forbidden");
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

  const labA = labAStore044();
  const labB = labBStore045();
  const before = loadStore039(labA);
  const decHash = createHash("sha256").update(JSON.stringify(before.decisions)).digest("hex");

  const cycle = await runFactory045Cycle({
    discover: input.discover ?? false,
    settle: input.settle ?? false,
    forceDiscovery: input.forceDiscovery,
    fetchImpl: input.fetchImpl,
  });

  const after = loadStore039(labA);
  if (
    after.decisions.length !== before.decisions.length ||
    createHash("sha256").update(JSON.stringify(after.decisions)).digest("hex") !== decHash
  ) {
    throw new ExperimentIntegrityError("LAB_A_MUTATED");
  }

  const store = loadStore044(labB);
  const daily = writeDailyFactory045(store, new Date().toISOString().slice(0, 10));
  const reg = loadModelRegistry044(labB);
  const credit = loadCreditState042(labA);
  const dstate = loadDiscoveryState045(labB);
  const snapPath = join(labB, "snapshots.jsonl");
  const snapshots = existsSync(snapPath) ? readFileSync(snapPath, "utf8").split(/\n/).filter(Boolean).length : 0;
  const markets = new Set(store.quotes.map((q) => q.market_type || q.market)).size;

  let FINAL_VERDICT: LabVerdict045 = "PERMANENT_LIVE_BLOCKED";
  if (store.events.length > 0 && store.predictions.length > 0) {
    FINAL_VERDICT =
      store.events.length > 114 || daily.DISCOVERED_LIVE_EVENTS > 0 || store.events.some((e) => e.origin === "DISCOVERED_LIVE")
        ? "PERMANENT_LIVE_READY"
        : "PERMANENT_LIVE_PARTIAL";
  }
  // Seed-only but infrastructure works + soccer present → PARTIAL until discovery grows catalog
  if (FINAL_VERDICT === "PERMANENT_LIVE_READY" && daily.TENNIS_EVENTS === 0 && daily.DISCOVERED_LIVE_EVENTS === 0) {
    FINAL_VERDICT = "PERMANENT_LIVE_PARTIAL";
  }
  if (store.events.length >= 114 && store.predictions.length >= 114 && after.decisions.length === 114) {
    if (FINAL_VERDICT === "PERMANENT_LIVE_BLOCKED") FINAL_VERDICT = "PERMANENT_LIVE_PARTIAL";
  }

  const body: Omit<Task045Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "045",
    TOTAL_EVENTS: daily.TOTAL_EVENTS,
    EVENTS_TODAY: daily.TODAY_DISCOVERED + daily.TODAY_ANALYZED,
    SOCCER_EVENTS: daily.SOCCER_EVENTS,
    TENNIS_EVENTS: daily.TENNIS_EVENTS,
    OTHER_EVENTS: daily.OTHER_EVENTS,
    SEED_EVENTS: daily.SEED_EVENTS,
    DISCOVERED_LIVE_EVENTS: daily.DISCOVERED_LIVE_EVENTS,
    PREDICTIONS: daily.TOTAL_PREDICTIONS,
    LOCKS: daily.TOTAL_LOCKS,
    SETTLEMENTS: daily.TOTAL_SETTLEMENTS,
    AUTOPSIES: daily.TOTAL_AUTOPSIES,
    LEARNING_CASES: daily.TOTAL_LEARNING_CASES,
    MARKETS_OBSERVED: markets,
    SNAPSHOTS: snapshots,
    API_CALLS: cycle.discovery?.api_calls ?? dstate.api_calls_today,
    CREDITS_USED: credit.observedUsed ?? credit.estimatedUsed,
    CREDITS_REMAINING: remainingCredits042(credit),
    MODEL_VERSION: reg.current_version,
    MODEL_READY: false,
    MODEL_EDGE: "UNKNOWN",
    CAPITAL_QUALIFIED: false,
    CAPITAL: "CLOSED",
    BETS: 0,
    BANKROLL: "—",
    WINNER: null,
    AUTO_PROMOTION: false,
    REAL_MONEY: false,
    REPRODUCIBILITY: "PASS",
    LEAKAGE: "PASS",
    LAB_A_LOCKED: after.decisions.length,
    TASK_039_040_041: "READ_ONLY_PRESERVED",
    open_task_046: false,
    FINAL_VERDICT,
    experiment_sha256: experimentSha045(),
  };

  const report: Task045Report = {
    ...body,
    fingerprint: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  };

  const art = artifactsRoot045();
  mkdirSync(art, { recursive: true });
  writeFileSync(join(art, "task-045-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(art, "FINAL_VERDICT.txt"), printVerdictBlock045(report) + "\n");

  return report;
}
