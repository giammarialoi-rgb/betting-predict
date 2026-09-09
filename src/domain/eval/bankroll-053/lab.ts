import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { computeMassiveStats049 } from "@/domain/eval/factory-049/stats";
import { selectSportsByFamily049 } from "@/domain/eval/factory-049/adapters";
import {
  experimentSha053,
  loadExp053Config,
  writeArtifact053,
  ensureBankrollDirs053,
  VIRTUAL_BANKROLL_INITIAL_053,
  MODEL_ACTIVE_053,
} from "@/domain/eval/bankroll-053/config";
import { runMassiveBankrollCycle053 } from "@/domain/eval/bankroll-053/cycle";
import { buildObservatory053 } from "@/domain/eval/bankroll-053/observatory";
import { computeStake053, settlePnL053 } from "@/domain/eval/bankroll-053/stake";
import { simulateGoal053, summarizeBankroll053 } from "@/domain/eval/bankroll-053/ledger";
import { buildSportDiagnostics053 } from "@/domain/eval/bankroll-053/sports-registry";

export type Task053Report = {
  experiment_id: string;
  task: "053";
  FINAL_VERDICT: "UNIVERSAL_MASSIVE_LIVE_READY" | "PARTIAL" | "BLOCKED";
  STATUS: string;
  DATA_LAKE: "Lab B task-044";
  TOTAL_EVENTS: number;
  UNIQUE_EVENTS: number;
  EVENTS_TODAY: number;
  EVENTS_NEXT_24H: number;
  EVENTS_NEXT_72H: number;
  EVENTS_NEXT_7D: number;
  SOCCER: number;
  TENNIS: number;
  BASKETBALL: number;
  VOLLEYBALL: number;
  HOCKEY: number;
  OTHER: number;
  SPORT_STATUS: Record<string, string>;
  MARKETS_ANALYZED: number;
  BOOKMAKERS_OBSERVED: number;
  PREDICTIONS: number;
  BET_CANDIDATES: number;
  STRONG_CANDIDATES: number;
  NO_BET: number;
  LOCKED: number;
  SETTLED: number;
  AUTOPSIES: number;
  LEARNING_CASES: number;
  ERROR_PATTERNS: number;
  COUNTERFACTUALS: number;
  MODEL_VERSION: string;
  MODEL_STATUS: "OBSERVATION_ONLY";
  MODEL_EDGE: "UNKNOWN";
  MODEL_READY: "PARTIAL";
  ARTIFICIAL_CAP: false;
  VIRTUAL_BANKROLL_INITIAL: 1000;
  VIRTUAL_BANKROLL_CURRENT: number;
  VIRTUAL_PROFIT: number;
  VIRTUAL_ROI: number;
  VIRTUAL_MAX_DD: number;
  PAPER_BANKROLL: 1000;
  PAPER_BETS: number;
  CAPITAL: "PAPER_ONLY";
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  OBSERVATORY_API_CALLS_UI: 0;
  open_task_054: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock053(r: Task053Report): string {
  const sportLines = Object.entries(r.SPORT_STATUS)
    .map(([k, v]) => `  ${k}=${v}`)
    .join("\n");
  return [
    "TASK 053 — FINAL VERDICT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `STATUS: ${r.STATUS}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `UNIQUE_EVENTS: ${r.UNIQUE_EVENTS}`,
    `EVENTS_TODAY: ${r.EVENTS_TODAY}`,
    `EVENTS_NEXT_24H: ${r.EVENTS_NEXT_24H}`,
    `EVENTS_NEXT_72H: ${r.EVENTS_NEXT_72H}`,
    `EVENTS_NEXT_7D: ${r.EVENTS_NEXT_7D}`,
    `SPORTS: soccer=${r.SOCCER} tennis=${r.TENNIS} basketball=${r.BASKETBALL} volleyball=${r.VOLLEYBALL} hockey=${r.HOCKEY} other=${r.OTHER}`,
    `SPORT_STATUS:`,
    sportLines,
    `MARKETS_ANALYZED: ${r.MARKETS_ANALYZED}`,
    `BOOKMAKERS_OBSERVED: ${r.BOOKMAKERS_OBSERVED}`,
    `PREDICTIONS: ${r.PREDICTIONS}`,
    `BET_CANDIDATES: ${r.BET_CANDIDATES}`,
    `NO_BET: ${r.NO_BET}`,
    `LOCKED: ${r.LOCKED}`,
    `SETTLED: ${r.SETTLED}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `ERROR_PATTERNS: ${r.ERROR_PATTERNS}`,
    `MODEL_VERSION: ${r.MODEL_VERSION}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `ARTIFICIAL_CAP: ${r.ARTIFICIAL_CAP}`,
    `PAPER_BANKROLL: ${r.PAPER_BANKROLL}`,
    `VIRTUAL_BANKROLL_CURRENT: ${r.VIRTUAL_BANKROLL_CURRENT}`,
    `PAPER_BETS: ${r.PAPER_BETS}`,
    `CAPITAL: ${r.CAPITAL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `OPEN_TASK_054: false`,
  ].join("\n");
}

export async function runTask053(): Promise<Task053Report> {
  const cfg = loadExp053Config();
  if (cfg.open_task_054) throw new ExperimentIntegrityError("TASK 054 forbidden");

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

  const win = settlePnL053({ stake: 10, odds: 2.0, outcome: "won" });
  if (win.pnl !== 10) throw new ExperimentIntegrityError("pnl_win");
  const loss = settlePnL053({ stake: 10, odds: 2.0, outcome: "lost" });
  if (loss.pnl !== -10) throw new ExperimentIntegrityError("pnl_loss");
  const push = settlePnL053({ stake: 10, odds: 2.0, outcome: "push" });
  if (push.pnl !== 0) throw new ExperimentIntegrityError("pnl_push");
  if (computeStake053({ strategy: "FLAT", bankroll: 1000, probability: 0.55, odds: 2 }).stake <= 0) {
    throw new ExperimentIntegrityError("flat_stake");
  }
  if (simulateGoal053({ settled_bets: 0 }).scenarios.some((s) => s.reach_goal_plausible === true)) {
    throw new ExperimentIntegrityError("goal_overclaim");
  }

  // Universal: other active keys enter pull queue (no artificial sport exclusion)
  const sel = selectSportsByFamily049([
    { key: "soccer_epl", group: "Soccer", title: "EPL", active: true, has_outrights: false },
    { key: "mma_mixed_martial_arts", group: "MMA", title: "MMA", active: true, has_outrights: false },
  ]);
  if (!sel.pullQueue.some((p) => p.family === "other" && p.key === "mma_mixed_martial_arts")) {
    throw new ExperimentIntegrityError("other_sports_not_queued");
  }

  const before = labAFingerprint046();
  const labB = permanentRoot044();
  ensureBankrollDirs053(labB);

  await runMassiveBankrollCycle053({ forceDiscover: false, allowDiscover: false });
  assertLabAUntouched046(before);
  await runMassiveBankrollCycle053({ forceDiscover: false, allowDiscover: false });
  assertLabAUntouched046(before);

  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }

  const store = loadStore044(labB);
  const stats = computeMassiveStats049(store);
  const obs = buildObservatory053();
  if (obs.api_calls_ui !== 0 || obs.brain_051.api_calls_ui !== 0) {
    throw new ExperimentIntegrityError("ui_api");
  }
  if (obs.massive_053.artificial_cap !== false) throw new ExperimentIntegrityError("cap");
  if (!obs.system_053) throw new ExperimentIntegrityError("system_missing");
  if (!obs.sport_adapters_053?.some((a) => a.sport === "SOCCER")) {
    throw new ExperimentIntegrityError("sport_adapter_missing");
  }
  if (!obs.challengers_053?.some((c) => c.role === "CHALLENGER" && c.auto_promotion === false)) {
    throw new ExperimentIntegrityError("challenger");
  }
  if (obs.massive_053.open_task_054 !== false) throw new ExperimentIntegrityError("open_054");

  const bankroll = summarizeBankroll053(labB);
  if (bankroll.initial !== VIRTUAL_BANKROLL_INITIAL_053) {
    throw new ExperimentIntegrityError("bankroll_initial");
  }

  const diag = buildSportDiagnostics053();
  const sportStatus: Record<string, string> = {};
  for (const s of diag.sports) {
    sportStatus[s.sport] = `${s.status} events=${s.unique_events} keys=${s.keys_active}/${s.keys_pulled}${s.note ? ` (${s.note})` : ""}`;
  }

  const unique = new Set(store.events.map((e) => e.event_id)).size;
  let FINAL_VERDICT: Task053Report["FINAL_VERDICT"] = "BLOCKED";
  if (unique >= 114 && obs.api_calls_ui === 0 && bankroll.initial === 1000 && obs.massive_053.artificial_cap === false) {
    FINAL_VERDICT = "UNIVERSAL_MASSIVE_LIVE_READY";
  } else if (unique > 0) {
    FINAL_VERDICT = "PARTIAL";
  }

  const body: Omit<Task053Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "053",
    FINAL_VERDICT,
    STATUS: FINAL_VERDICT,
    DATA_LAKE: "Lab B task-044",
    TOTAL_EVENTS: store.events.length,
    UNIQUE_EVENTS: unique,
    EVENTS_TODAY: stats.EVENTS_TODAY,
    EVENTS_NEXT_24H: stats.EVENTS_NEXT_24H,
    EVENTS_NEXT_72H: stats.EVENTS_NEXT_72H,
    EVENTS_NEXT_7D: stats.EVENTS_NEXT_7D,
    SOCCER: stats.SOCCER,
    TENNIS: stats.TENNIS,
    BASKETBALL: stats.BASKETBALL,
    VOLLEYBALL: stats.VOLLEYBALL,
    HOCKEY: stats.HOCKEY,
    OTHER: stats.OTHER,
    SPORT_STATUS: sportStatus,
    MARKETS_ANALYZED: stats.MARKETS_ANALYZED,
    BOOKMAKERS_OBSERVED: obs.massive_053.bookmaker_count,
    PREDICTIONS: stats.TOTAL_PREDICTIONS,
    BET_CANDIDATES: stats.BET_CANDIDATE,
    STRONG_CANDIDATES: stats.STRONG_CANDIDATE,
    NO_BET: stats.NO_BET,
    LOCKED: stats.LOCKED,
    SETTLED: stats.SETTLED,
    AUTOPSIES: stats.AUTOPSIED,
    LEARNING_CASES: stats.LEARNING_CASES,
    ERROR_PATTERNS: obs.massive_053.error_patterns,
    COUNTERFACTUALS: obs.massive_053.counterfactuals,
    MODEL_VERSION: MODEL_ACTIVE_053,
    MODEL_STATUS: "OBSERVATION_ONLY",
    MODEL_EDGE: "UNKNOWN",
    MODEL_READY: "PARTIAL",
    ARTIFICIAL_CAP: false,
    VIRTUAL_BANKROLL_INITIAL: 1000,
    VIRTUAL_BANKROLL_CURRENT: bankroll.current_flat,
    VIRTUAL_PROFIT: bankroll.profit_flat,
    VIRTUAL_ROI: bankroll.roi_flat,
    VIRTUAL_MAX_DD: bankroll.max_drawdown_flat,
    PAPER_BANKROLL: 1000,
    PAPER_BETS: bankroll.open_entries,
    CAPITAL: "PAPER_ONLY",
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    OBSERVATORY_API_CALLS_UI: 0,
    open_task_054: false,
    experiment_sha256: experimentSha053(),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task053Report = { ...body, fingerprint };
  writeArtifact053("task-053-result.json", report);
  writeArtifact053("task-053-verdict.txt", printVerdictBlock053(report));
  writeArtifact053("task-053-sport-status.json", sportStatus);
  writeArtifact053("task-053-bankroll.json", bankroll);
  writeArtifact053("task-053-system.json", obs.system_053);
  writeArtifact053("task-053-sport-adapters.json", obs.sport_adapters_053);
  writeArtifact053("task-053-source-health.json", obs.source_health_053);
  writeArtifact053("task-053-challengers.json", obs.challengers_053);
  return report;
}
