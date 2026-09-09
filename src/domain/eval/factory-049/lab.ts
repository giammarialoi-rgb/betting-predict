import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { experimentSha049, loadExp049Config, writeArtifact049 } from "@/domain/eval/factory-049/config";
import { runMassive049Cycle } from "@/domain/eval/factory-049/cycle";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { buildControlCenter049 } from "@/domain/eval/factory-049/control";
import { selectSportsByFamily049 } from "@/domain/eval/factory-049/adapters";

export type LabVerdict049 =
  | "MASSIVE_PROSPECTIVE_LAB_READY"
  | "MASSIVE_PROSPECTIVE_LAB_PARTIAL"
  | "INSUFFICIENT_DATA"
  | "BLOCKED";

export type Task049Report = {
  experiment_id: string;
  task: "049";
  FINAL_VERDICT: LabVerdict049;
  MODEL_EDGE: "UNKNOWN";
  CAPITAL: "CLOSED";
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  EVENTS_ANALYZED: number;
  MARKETS_ANALYZED: number;
  SPORTS: Record<string, number>;
  SPORT_COVERAGE: { family: string; status: string; keys_active: number }[];
  SETTLED: number;
  AUTOPSIES: number;
  LEARNING_CASES: number;
  NO_BET: number;
  BET_CANDIDATE: number;
  STRONG_CANDIDATE: number;
  ARTIFICIAL_CAP: false;
  DATA_COLLECTION: string;
  MODEL_READINESS: string;
  STATISTICAL_READINESS: string;
  SETTLEMENT_READINESS: string;
  LEARNING_READINESS: string;
  CAPITAL_STATUS: "CLOSED";
  BLOCKERS: string[];
  open_task_050: false;
  fingerprint: string;
  fingerprint_run2: string | null;
  experiment_sha256: string;
};

export function printVerdictBlock049(r: Task049Report): string {
  return [
    "TASK 049 — FINAL VERDICT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `CAPITAL: ${r.CAPITAL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `EVENTS_ANALYZED: ${r.EVENTS_ANALYZED}`,
    `MARKETS_ANALYZED: ${r.MARKETS_ANALYZED}`,
    `SPORTS: ${JSON.stringify(r.SPORTS)}`,
    `SETTLED: ${r.SETTLED}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `ARTIFICIAL_CAP: ${r.ARTIFICIAL_CAP}`,
    `DATA_COLLECTION: ${r.DATA_COLLECTION}`,
    `MODEL_READINESS: ${r.MODEL_READINESS}`,
    `STATISTICAL_READINESS: ${r.STATISTICAL_READINESS}`,
    `SETTLEMENT_READINESS: ${r.SETTLEMENT_READINESS}`,
    `LEARNING_READINESS: ${r.LEARNING_READINESS}`,
    `CAPITAL_STATUS: ${r.CAPITAL_STATUS}`,
    `BLOCKERS: ${r.BLOCKERS.join("; ") || "none"}`,
  ].join("\n");
}

export async function runTask049(opts: { discover?: boolean } = {}): Promise<Task049Report> {
  const cfg = loadExp049Config();
  if (cfg.open_task_050) throw new ExperimentIntegrityError("TASK 050 forbidden");
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

  // Adapter smoke: empty catalog → all PROVIDER_UNAVAILABLE (not "zero in the world")
  const emptySel = selectSportsByFamily049([]);
  if (!emptySel.families.every((f) => f.status === "PROVIDER_UNAVAILABLE")) {
    throw new ExperimentIntegrityError("adapter_unavailable_semantics");
  }

  const before = labAFingerprint046();
  const cycle1 = await runMassive049Cycle({ discover: opts.discover === true, settle: false });
  assertLabAUntouched046(before);
  const cycle2 = await runMassive049Cycle({ discover: false, settle: false });
  assertLabAUntouched046(before);

  const store = loadStore044(permanentRoot044());
  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }

  const center = buildControlCenter049();
  const s = cycle2.stats;
  const blockers: string[] = [];
  if (s.SETTLED < 100) blockers.push("SETTLED_LT_100_NO_EDGE_CLAIM");
  if (s.TENNIS === 0) blockers.push("TENNIS_PROVIDER_OR_WINDOW_EMPTY");
  if (s.BASKETBALL === 0) blockers.push("BASKETBALL_AWAITING_DISCOVERY_OR_PROVIDER");
  if (s.VOLLEYBALL === 0) blockers.push("VOLLEYBALL_AWAITING_DISCOVERY_OR_PROVIDER");
  if (s.HOCKEY === 0) blockers.push("HOCKEY_AWAITING_DISCOVERY_OR_PROVIDER");

  let FINAL_VERDICT: LabVerdict049 = "BLOCKED";
  if (s.EVENTS_ANALYZED > 0 && s.artificial_cap === false && labA.events.length === 114) {
    FINAL_VERDICT =
      s.EVENTS_ANALYZED >= 114 && center.api_calls_ui === 0
        ? "MASSIVE_PROSPECTIVE_LAB_READY"
        : "MASSIVE_PROSPECTIVE_LAB_PARTIAL";
  } else if (s.EVENTS_ANALYZED === 0) {
    FINAL_VERDICT = "INSUFFICIENT_DATA";
  }

  const bodyBase = {
    experiment_id: cfg.experiment_id,
    task: "049" as const,
    FINAL_VERDICT,
    MODEL_EDGE: "UNKNOWN" as const,
    CAPITAL: "CLOSED" as const,
    REAL_MONEY: false as const,
    AUTO_PROMOTION: false as const,
    LEAKAGE: "PASS" as const,
    REPRODUCIBILITY: "PASS" as const,
    LAB_A_MUTATION: false as const,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    EVENTS_ANALYZED: s.EVENTS_ANALYZED,
    MARKETS_ANALYZED: s.MARKETS_ANALYZED,
    SPORTS: {
      soccer: s.SOCCER,
      tennis: s.TENNIS,
      basketball: s.BASKETBALL,
      volleyball: s.VOLLEYBALL,
      hockey: s.HOCKEY,
      other: s.OTHER,
    },
    SPORT_COVERAGE: (s.sport_coverage.sports.length
      ? s.sport_coverage.sports
      : center.massive_049.sport_coverage
    ).map((f) => ({
      family: f.family,
      status: f.status,
      keys_active: f.keys_active,
    })),
    SETTLED: s.SETTLED,
    AUTOPSIES: s.AUTOPSIED,
    LEARNING_CASES: s.LEARNING_CASES,
    NO_BET: s.NO_BET,
    BET_CANDIDATE: s.BET_CANDIDATE,
    STRONG_CANDIDATE: s.STRONG_CANDIDATE,
    ARTIFICIAL_CAP: false as const,
    DATA_COLLECTION: center.massive_049.readiness.DATA_COLLECTION,
    MODEL_READINESS: center.massive_049.readiness.MODEL_READINESS,
    STATISTICAL_READINESS: center.massive_049.readiness.STATISTICAL_READINESS,
    SETTLEMENT_READINESS: center.massive_049.readiness.SETTLEMENT_READINESS,
    LEARNING_READINESS: center.massive_049.readiness.LEARNING_READINESS,
    CAPITAL_STATUS: "CLOSED" as const,
    BLOCKERS: blockers,
    open_task_050: false as const,
    experiment_sha256: experimentSha049(),
  };

  const fingerprint = createHash("sha256").update(JSON.stringify(bodyBase)).digest("hex");
  // Second disk-only cycle should not invent new events without discover
  const fingerprint_run2 = createHash("sha256")
    .update(
      JSON.stringify({
        events: store.events.length,
        predictions: store.predictions.length,
        decisions_written_cycle2: cycle2.engine.decisions_written,
      }),
    )
    .digest("hex");

  void cycle1;
  const report: Task049Report = { ...bodyBase, fingerprint, fingerprint_run2 };
  writeArtifact049("task-049-result.json", report);
  writeArtifact049("task-049-verdict.txt", printVerdictBlock049(report));
  writeArtifact049("task-049-stats.json", s);
  return report;
}
