import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { artifactStore043, experimentSha043, loadExp043Config, sourceStore043 } from "@/domain/eval/live-043/config";
import { runLive043Cycle } from "@/domain/eval/live-043/cycle";
import { loadStore043, loadModelRegistry043 } from "@/domain/eval/live-043/store";
import type { LabVerdict043 } from "@/domain/eval/live-043/types";

export type Task043Report = {
  experiment_id: string;
  task: "043";
  TOTAL_EVENTS: number;
  SOCCER_EVENTS: number;
  TENNIS_EVENTS: number;
  ANALYZED_EVENTS: number;
  STRICT_EVENTS: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: number;
  CANDIDATES: number;
  STRONG_CANDIDATES: number;
  MODEL_VERSION: string;
  MARKET_BRIER: number | null;
  MODEL_BRIER: number | null;
  DELTA_BRIER: number | null;
  CI_95: null;
  HOLM: null;
  AUTOPSIES: number;
  LEARNING_CANDIDATES: number;
  API_CALLS: number;
  CREDITS_USED: number | null;
  CREDITS_REMAINING: number | null;
  MODEL_READY: boolean | "PARTIAL";
  CAPITAL_QUALIFIED: false;
  BETS: 0;
  BANKROLL: "—";
  winner: null;
  auto_promotion: false;
  REAL_MONEY: false;
  real_money: false;
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict043;
  COLLECTOR_STATUS: string;
  residual_blocker: string;
  open_task_044: false;
  fingerprint: string;
  experiment_sha256: string;
  cycle: Awaited<ReturnType<typeof runLive043Cycle>>;
};

export function fingerprint043(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock043(r: Task043Report): string {
  return [
    "TASK 043 — FINAL VERDICT",
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `SOCCER_EVENTS: ${r.SOCCER_EVENTS}`,
    `TENNIS_EVENTS: ${r.TENNIS_EVENTS}`,
    `ANALYZED_EVENTS: ${r.ANALYZED_EVENTS}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `LOCKED_DECISIONS: ${r.LOCKED_DECISIONS}`,
    `SETTLED_EVENTS: ${r.SETTLED_EVENTS}`,
    `CANDIDATES: ${r.CANDIDATES}`,
    `STRONG_CANDIDATES: ${r.STRONG_CANDIDATES}`,
    `MODEL_VERSION: ${r.MODEL_VERSION}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `MODEL_BRIER: ${r.MODEL_BRIER ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `CI_95: ${r.CI_95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CANDIDATES: ${r.LEARNING_CANDIDATES}`,
    `API_CALLS: ${r.API_CALLS}`,
    `CREDITS_USED: ${r.CREDITS_USED ?? "—"}`,
    `CREDITS_REMAINING: ${r.CREDITS_REMAINING ?? "—"}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `CAPITAL_QUALIFIED: ${r.CAPITAL_QUALIFIED}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `WINNER: ${r.winner}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `LEAKAGE: ${r.leakage_status}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

export async function runTask043(input: {
  sourceRoot?: string;
  artifactRoot?: string;
  runCollector042?: boolean;
} = {}): Promise<Task043Report> {
  const cfg = loadExp043Config();
  if (cfg.open_task_044) throw new ExperimentIntegrityError("TASK 044 forbidden");
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

  const cycle = await runLive043Cycle({
    sourceRoot: input.sourceRoot,
    artifactRoot: input.artifactRoot,
    runCollector042: input.runCollector042 === true,
  });

  const src = loadStore039(sourceStore043(input.sourceRoot));
  const art = loadStore043(input.artifactRoot ?? artifactStore043());
  const credit = loadCreditState042(sourceStore043(input.sourceRoot));
  const coll = resolveDisplayedStatus042(sourceStore043(input.sourceRoot));
  const reg = loadModelRegistry043(input.artifactRoot ?? artifactStore043());

  const settled = src.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  let verdict: LabVerdict043 = "LIVE_BUILD_READY";
  if (art.catalog.length > 0 && settled < 100) verdict = "LIVE_COLLECTING";
  if (art.catalog.length === 0) verdict = "INSUFFICIENT_DATA";
  if (settled >= 100) verdict = "NO_DEMONSTRATED_EDGE";

  const fp = fingerprint043({
    verdict,
    exp: experimentSha043(),
    catalog: art.catalog.length,
    locked: src.decisions.length,
    settled,
    model: reg.current_version,
    bets: 0,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "043",
    TOTAL_EVENTS: art.catalog.length,
    SOCCER_EVENTS: cycle.soccerEvents,
    TENNIS_EVENTS: cycle.tennisEvents,
    ANALYZED_EVENTS: cycle.analyzed,
    STRICT_EVENTS: new Set(src.quotes.filter((q) => q.temporal_class === "STRICT").map((q) => q.event_id)).size,
    LOCKED_DECISIONS: src.decisions.length,
    SETTLED_EVENTS: settled,
    CANDIDATES: cycle.candidates,
    STRONG_CANDIDATES: cycle.strong,
    MODEL_VERSION: reg.current_version,
    MARKET_BRIER: null,
    MODEL_BRIER: null,
    DELTA_BRIER: null,
    CI_95: null,
    HOLM: null,
    AUTOPSIES: art.autopsies.length,
    LEARNING_CANDIDATES: art.autopsies.filter((a) => a.learning_candidate).length,
    API_CALLS: credit.requests,
    CREDITS_USED: credit.observedUsed ?? credit.estimatedUsed,
    CREDITS_REMAINING: remainingCredits042(credit),
    MODEL_READY: "PARTIAL",
    CAPITAL_QUALIFIED: false,
    BETS: 0,
    BANKROLL: "—",
    winner: null,
    auto_promotion: false,
    REAL_MONEY: false,
    real_money: false,
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT: verdict,
    COLLECTOR_STATUS: coll.status,
    residual_blocker:
      settled < 100
        ? `Total live lab online. SETTLED=${settled}/100. MODEL_v1=MARKET_ONLY. Capital closed.`
        : "Settled cohort reached; MARKET_ONLY cannot demonstrate edge over MARKET_DEVIG.",
    open_task_044: false,
    fingerprint: fp,
    experiment_sha256: experimentSha043(),
    cycle,
  };
}
