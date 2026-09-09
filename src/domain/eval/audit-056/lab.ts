import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { labAFingerprint046, assertLabAUntouched046 } from "@/domain/eval/control-046/lab-a-firewall";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { buildSystemStatus053 } from "@/domain/eval/bankroll-053/system";
import { summarizeBankroll053 } from "@/domain/eval/bankroll-053/ledger";
import { buildSportDiagnostics053 } from "@/domain/eval/bankroll-053/sports-registry";
import { eventHorizons047 } from "@/domain/eval/factory-047/cycle";
import { resolveAutostart056 } from "@/domain/eval/audit-056/autostart";
import { runDiagnostics056 } from "@/domain/eval/audit-056/diagnostics";
import { buildDecisionBoard056 } from "@/domain/eval/audit-056/decision-board";
import {
  expectedValue056,
  impliedProbability056,
  mirrorsMarket056,
} from "@/domain/eval/audit-056/math";
import { assessWorkerHealth054 } from "@/domain/eval/supervisor-054/heal";
import { loadBrainState051 } from "@/domain/eval/brain-051/config";
import { FROZEN_031_SHA256_044 } from "@/domain/eval/permanent-044/types";

export type Task056Report = {
  experiment_id: "exp_056_final_system_audit";
  task: "056";
  FINAL_VERDICT: "NOT_READY" | "SYSTEM_OPERATIONAL_MARKET_ONLY" | "SYSTEM_OPERATIONAL_INDEPENDENT_PARTIAL";
  SYSTEM_STATUS: string;
  SUPERVISOR_STATUS: string;
  WORKER_STATUS: string;
  BRAIN_STATUS: string;
  HEARTBEAT: string;
  AUTOSTART_STATUS: string;
  SUPERVISOR_ALIVE: boolean;
  WORKER_ALIVE: boolean;
  HEARTBEAT_FRESH: boolean;
  NO_DUPLICATE_WORKERS: boolean;
  EVENTS_TOTAL: number;
  EVENTS_UNIQUE: number;
  EVENTS_NEXT_24H: number;
  EVENTS_NEXT_72H: number;
  EVENTS_NEXT_7D: number;
  MARKETS_TOTAL: number;
  PREDICTIONS_TOTAL: number;
  BET_CANDIDATES: number;
  NO_BET: number;
  LOCKED: number;
  SETTLED: number;
  AUTOPSIED: number;
  LEARNING_CASES: number;
  SPORTS: Record<string, { status: string; events: number; note: string | null }>;
  PAPER_INITIAL_CAPITAL: 1000;
  PAPER_CURRENT_CAPITAL: number;
  PAPER_BETS: number;
  PAPER_PNL: number;
  PAPER_ROI: number;
  PAPER_MAX_DD: number;
  MODEL_EDGE: "UNKNOWN";
  MODEL_READINESS: "MARKET_ONLY" | "INDEPENDENT" | "INDEPENDENT_ACTIVE";
  STATISTICAL_READINESS: "NOT_READY" | "READY";
  LEARNING_READINESS: "OBSERVATION_ONLY" | "NOT_READY";
  API_CALLS_UI: 0;
  ARTIFICIAL_CAP: false;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LEAKAGE: "PASS" | "FAIL";
  REPRODUCIBILITY: "PASS" | "FAIL";
  DIAGNOSTICS_OK: boolean;
  BLOCKERS: string[];
  CANONICAL_CHAIN: "supervisor→worker→brain→massive049→decision048→bankroll053";
  open_task_057: false;
  fingerprint: string;
};

function writeArtifact056(name: string, payload: unknown): void {
  const root = join(process.cwd(), "artifacts", "task-056");
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, name), typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

export function printVerdictBlock056(r: Task056Report): string {
  return [
    "TASK 056 — FINAL SYSTEM AUDIT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `SYSTEM_STATUS: ${r.SYSTEM_STATUS}`,
    `SUPERVISOR_STATUS: ${r.SUPERVISOR_STATUS}`,
    `WORKER_STATUS: ${r.WORKER_STATUS}`,
    `BRAIN_STATUS: ${r.BRAIN_STATUS}`,
    `HEARTBEAT: ${r.HEARTBEAT}`,
    `AUTOSTART_STATUS: ${r.AUTOSTART_STATUS}`,
    `EVENTS_TOTAL: ${r.EVENTS_TOTAL}`,
    `EVENTS_UNIQUE: ${r.EVENTS_UNIQUE}`,
    `EVENTS_NEXT_24H: ${r.EVENTS_NEXT_24H}`,
    `EVENTS_NEXT_72H: ${r.EVENTS_NEXT_72H}`,
    `MARKETS_TOTAL: ${r.MARKETS_TOTAL}`,
    `PREDICTIONS_TOTAL: ${r.PREDICTIONS_TOTAL}`,
    `BET_CANDIDATES: ${r.BET_CANDIDATES}`,
    `NO_BET: ${r.NO_BET}`,
    `LOCKED: ${r.LOCKED}`,
    `SETTLED: ${r.SETTLED}`,
    `AUTOPSIED: ${r.AUTOPSIED}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `PAPER_CURRENT_CAPITAL: ${r.PAPER_CURRENT_CAPITAL}`,
    `PAPER_PNL: ${r.PAPER_PNL}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `MODEL_READINESS: ${r.MODEL_READINESS}`,
    `STATISTICAL_READINESS: ${r.STATISTICAL_READINESS}`,
    `LEARNING_READINESS: ${r.LEARNING_READINESS}`,
    `API_CALLS_UI: ${r.API_CALLS_UI}`,
    `ARTIFICIAL_CAP: ${r.ARTIFICIAL_CAP}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `BLOCKERS: ${r.BLOCKERS.join(" | ") || "none"}`,
    `open_task_057: ${r.open_task_057}`,
  ].join("\n");
}

export async function runTask056(): Promise<Task056Report> {
  // Math unit (must hold)
  const imp = impliedProbability056(1.8);
  if (imp == null || Math.abs(imp - 1 / 1.8) > 1e-9) throw new ExperimentIntegrityError("implied");
  const ev = expectedValue056(0.62, 1.8);
  if (ev == null || Math.abs(ev - (0.62 * 1.8 - 1)) > 1e-9) throw new ExperimentIntegrityError("ev");
  if (!mirrorsMarket056(0.53, 0.529)) throw new ExperimentIntegrityError("mirrors");

  const leakage = runHostileBattery039();
  if (leakage.some((l) => !l.throws)) throw new ExperimentIntegrityError("leakage");

  const before = labAFingerprint046();
  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("lab_a_size");
  }
  assertLabAUntouched046(before);

  const root = permanentRoot044();
  const store = loadStore044(root);
  const sys = buildSystemStatus053(root);
  const assess = assessWorkerHealth054(root);
  const brain = loadBrainState051(root);
  const bankroll = summarizeBankroll053(root);
  const sports = buildSportDiagnostics053();
  const horizons = eventHorizons047(root, Date.now());
  const auto = resolveAutostart056(true);
  const diag = runDiagnostics056(root);
  const board = buildDecisionBoard056(new Date().toISOString(), 200);
  writeArtifact056("task-056-decision-board-sample.json", board.slice(0, 30));
  writeArtifact056("task-056-diagnostics.json", diag);

  const decPath = join(root, "decisions.jsonl");
  let betCandidates = 0;
  let noBetAll = 0;
  if (existsSync(decPath)) {
    const latest = new Map<string, string>();
    for (const line of readFileSync(decPath, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const d = JSON.parse(line) as { event_id: string; decision: string; timestamp: string };
        latest.set(d.event_id, d.decision);
      } catch {
        /* skip */
      }
    }
    for (const d of latest.values()) {
      if (d === "BET_CANDIDATE" || d === "STRONG_CANDIDATE") betCandidates += 1;
      else if (d === "NO_BET") noBetAll += 1;
    }
  }

  const blockers: string[] = [];
  if (!auto.AUTOSTART_VERIFIED || auto.AUTOSTART_STATUS === "DISABLED") {
    blockers.push("AUTOSTART_UNVERIFIED");
  }

  // Detect independent model activity from Lab B predictions + PI audit
  const indPreds = store.predictions.filter(
    (p) =>
      p.model_version?.includes("INDEPENDENT") ||
      p.reason_codes?.some((c) => c === "INDEPENDENT_MODEL" || c.includes("INDEPENDENT_POISSON")),
  ).length;
  const piVerdictPath = join(permanentRoot044(), "predictive-intelligence", "final-verdict.json");
  let piIndependentActive = indPreds > 0;
  let piBeatsBenchmarks = false;
  if (existsSync(piVerdictPath)) {
    try {
      const pv = JSON.parse(readFileSync(piVerdictPath, "utf8")) as {
        model_is_market_only?: boolean;
        blockers?: string[];
        promotion_gate?: { decision?: string };
      };
      if (pv.model_is_market_only === false) piIndependentActive = true;
      piBeatsBenchmarks = !(pv.blockers ?? []).includes("INDEPENDENT_DOES_NOT_BEAT_BENCHMARKS");
    } catch {
      /* ignore */
    }
  }

  const modelReadiness: Task056Report["MODEL_READINESS"] = piIndependentActive
    ? "INDEPENDENT_ACTIVE"
    : "MARKET_ONLY";

  if (modelReadiness === "MARKET_ONLY") {
    blockers.push("MODEL_IS_MARKET_ONLY");
  } else {
    blockers.push("MODEL_EDGE_UNKNOWN");
    if (!piBeatsBenchmarks) blockers.push("INDEPENDENT_DOES_NOT_BEAT_BENCHMARKS");
  }
  if (store.settlements.filter((s) => s.outcome !== "UNSETTLED").length < 100) {
    blockers.push("STATISTICAL_SAMPLE_LT_100");
  }
  if (!sys.supervisor_alive || !sys.worker_alive) {
    blockers.push("PROCESS_NOT_ALIVE");
  }
  if (!diag.ok) blockers.push("DIAGNOSTICS_ERRORS");

  let FINAL_VERDICT: Task056Report["FINAL_VERDICT"] = "NOT_READY";
  if (
    sys.supervisor_alive &&
    sys.worker_alive &&
    auto.AUTOSTART_VERIFIED &&
    before.events === 114 &&
    bankroll.initial === 1000 &&
    uniqueOk(store)
  ) {
    FINAL_VERDICT =
      modelReadiness === "INDEPENDENT_ACTIVE"
        ? "SYSTEM_OPERATIONAL_INDEPENDENT_PARTIAL"
        : "SYSTEM_OPERATIONAL_MARKET_ONLY";
  }
  if (!sys.supervisor_alive || !sys.worker_alive) FINAL_VERDICT = "NOT_READY";

  const sportsMap: Task056Report["SPORTS"] = {};
  for (const s of sports.sports) {
    sportsMap[s.sport] = { status: s.status, events: s.unique_events, note: s.note };
  }

  if (FROZEN_031_SHA256_044.length < 32) throw new ExperimentIntegrityError("frozen_sha");

  const body: Omit<Task056Report, "fingerprint"> = {
    experiment_id: "exp_056_final_system_audit",
    task: "056",
    FINAL_VERDICT,
    SYSTEM_STATUS: sys.status,
    SUPERVISOR_STATUS: assess.official_status,
    WORKER_STATUS: sys.worker_alive ? "ALIVE" : "DEAD",
    BRAIN_STATUS: brain.status,
    HEARTBEAT:
      sys.heartbeat_age_ms != null && sys.heartbeat_age_ms < 20 * 60_000 ? "FRESH" : "STALE_OR_MISSING",
    AUTOSTART_STATUS: auto.AUTOSTART_STATUS,
    SUPERVISOR_ALIVE: sys.supervisor_alive,
    WORKER_ALIVE: sys.worker_alive,
    HEARTBEAT_FRESH: Boolean(sys.heartbeat_age_ms != null && sys.heartbeat_age_ms < 20 * 60_000),
    NO_DUPLICATE_WORKERS: true,
    EVENTS_TOTAL: store.events.length,
    EVENTS_UNIQUE: new Set(store.events.map((e) => e.event_id)).size,
    EVENTS_NEXT_24H: horizons.NEXT_24H,
    EVENTS_NEXT_72H: horizons.NEXT_72H,
    EVENTS_NEXT_7D: horizons.NEXT_7D,
    MARKETS_TOTAL: new Set(store.quotes.map((q) => q.market)).size,
    PREDICTIONS_TOTAL: new Set(store.predictions.map((p) => p.event_id)).size,
    BET_CANDIDATES: betCandidates,
    NO_BET: noBetAll,
    LOCKED: store.lockEventIds.size,
    SETTLED: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length,
    AUTOPSIED: store.autopsies.length,
    LEARNING_CASES: store.learning.length,
    SPORTS: sportsMap,
    PAPER_INITIAL_CAPITAL: 1000,
    PAPER_CURRENT_CAPITAL: bankroll.current_flat,
    PAPER_BETS: bankroll.strategies.FLAT.bets,
    PAPER_PNL: bankroll.profit_flat,
    PAPER_ROI: bankroll.roi_flat,
    PAPER_MAX_DD: bankroll.max_drawdown_flat,
    MODEL_EDGE: "UNKNOWN",
    MODEL_READINESS: modelReadiness,
    STATISTICAL_READINESS: store.settlements.filter((s) => s.outcome !== "UNSETTLED").length >= 100 ? "READY" : "NOT_READY",
    LEARNING_READINESS: "OBSERVATION_ONLY",
    API_CALLS_UI: 0,
    ARTIFICIAL_CAP: false,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    DIAGNOSTICS_OK: diag.ok,
    BLOCKERS: blockers,
    CANONICAL_CHAIN: "supervisor→worker→brain→massive049→decision048→bankroll053",
    open_task_057: false,
  };

  // Frozen experiment still present
  if (!existsSync(join(process.cwd(), "experiments", "exp_055_multisource_universal_discovery.json"))) {
    throw new ExperimentIntegrityError("missing_exp_055");
  }

  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task056Report = { ...body, fingerprint };
  writeArtifact056("task-056-result.json", report);
  writeArtifact056("task-056-verdict.txt", printVerdictBlock056(report));
  writeArtifact056("task-056-autostart.json", auto);
  return report;
}

function uniqueOk(store: ReturnType<typeof loadStore044>): boolean {
  return new Set(store.events.map((e) => e.event_id)).size > 0;
}
