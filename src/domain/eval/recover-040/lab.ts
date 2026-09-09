import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { experimentSha040, loadExp040Config, sourceStore040 } from "@/domain/eval/recover-040/config";
import { coverageField040, inventory040 } from "@/domain/eval/recover-040/inventory";
import { recoverLocks040 } from "@/domain/eval/recover-040/lock";
import type { LabVerdict040, RecoverTable040 } from "@/domain/eval/recover-040/types";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { getOddsApiKey } from "@/domain/eval/live-039/sources";
import { liveHealth039, settledVerified039 } from "@/domain/eval/live-039/health";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { revealOnce039 } from "@/domain/eval/live-039/settle";
import { WINDOWS_039 } from "@/domain/eval/live-039/types";
import type { LockedDecisionRow040 } from "@/domain/eval/recover-040/lock";

export type Task040Report = {
  experiment_id: string;
  task: "040";
  COLLECTION_STATUS: string;
  SOURCE_STATUS: string;
  API_KEY_CONFIGURED: boolean;
  EVENTS_DISCOVERED: number;
  EVENTS_RECONSTRUCTED: number;
  QUOTE_OBSERVATIONS: number;
  UNIQUE_QUOTES: number;
  EXACT_KICKOFFS: number;
  MATCH_EXACT: number;
  T72_COVERAGE: number;
  T48_COVERAGE: number;
  T24_COVERAGE: number;
  T12_COVERAGE: number;
  T6_COVERAGE: number;
  T3_COVERAGE: number;
  T1H_COVERAGE: number;
  T30M_COVERAGE: number;
  T15M_COVERAGE: number;
  T5M_COVERAGE: number;
  T1M_COVERAGE: number;
  STRICT_EVENTS: number;
  STRICT_QUOTES: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: number;
  TEST_EVENTS: number;
  HOLDOUT_EVENTS: number;
  HOLDOUT_2020_PLUS: number;
  HOLDOUT_STATUS: "EMPTY" | "PARTIAL" | "READY";
  MODEL_READY: boolean | "PARTIAL";
  MARKET_ONLY_EVALUATION: boolean;
  MARKET_BRIER: number | null;
  MARKET_LOGLOSS: number | null;
  BEST_MODEL: string | null;
  DELTA_BRIER: number | null;
  CI_95: null;
  HOLM: null;
  SIGNIFICANT: false;
  CAPITAL_QUALIFIED: false;
  BETS: 0;
  BANKROLL: "—";
  ROI: null;
  MAX_DD: null;
  winner: null;
  auto_promotion: false;
  REAL_MONEY: false;
  real_money: false;
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict040;
  residual_blocker: string;
  open_task_041: false;
  recover_table: RecoverTable040;
  locked_rows: LockedDecisionRow040[];
  leakage: { id: string; throws: boolean }[];
  experiment_sha256: string;
  dataset_fingerprint: string;
  fingerprint: string;
  adapter_version: "recover-040/v1";
  source_store: string;
};

export function fingerprint040(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock040(r: Task040Report): string {
  return [
    "TASK 040 — FINAL VERDICT",
    `COLLECTION_STATUS: ${r.COLLECTION_STATUS}`,
    `SOURCE_STATUS: ${r.SOURCE_STATUS}`,
    `API_KEY_CONFIGURED: ${r.API_KEY_CONFIGURED}`,
    `EVENTS_DISCOVERED: ${r.EVENTS_DISCOVERED}`,
    `EVENTS_RECONSTRUCTED: ${r.EVENTS_RECONSTRUCTED}`,
    `QUOTE_OBSERVATIONS: ${r.QUOTE_OBSERVATIONS}`,
    `UNIQUE_QUOTES: ${r.UNIQUE_QUOTES}`,
    `EXACT_KICKOFFS: ${r.EXACT_KICKOFFS}`,
    `MATCH_EXACT: ${r.MATCH_EXACT}`,
    `T72_COVERAGE: ${r.T72_COVERAGE}`,
    `T48_COVERAGE: ${r.T48_COVERAGE}`,
    `T24_COVERAGE: ${r.T24_COVERAGE}`,
    `T12_COVERAGE: ${r.T12_COVERAGE}`,
    `T6_COVERAGE: ${r.T6_COVERAGE}`,
    `T3_COVERAGE: ${r.T3_COVERAGE}`,
    `T1H_COVERAGE: ${r.T1H_COVERAGE}`,
    `T30M_COVERAGE: ${r.T30M_COVERAGE}`,
    `T15M_COVERAGE: ${r.T15M_COVERAGE}`,
    `T5M_COVERAGE: ${r.T5M_COVERAGE}`,
    `T1M_COVERAGE: ${r.T1M_COVERAGE}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `STRICT_QUOTES: ${r.STRICT_QUOTES}`,
    `LOCKED_DECISIONS: ${r.LOCKED_DECISIONS}`,
    `SETTLED_EVENTS: ${r.SETTLED_EVENTS}`,
    `TEST_EVENTS: ${r.TEST_EVENTS}`,
    `HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    `HOLDOUT_2020_PLUS: ${r.HOLDOUT_2020_PLUS}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `MARKET_LOGLOSS: ${r.MARKET_LOGLOSS ?? "—"}`,
    `BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `CI_95: ${r.CI_95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `SIGNIFICANT: ${r.SIGNIFICANT}`,
    `CAPITAL_QUALIFIED: ${r.CAPITAL_QUALIFIED}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `ROI: ${r.ROI ?? "—"}`,
    `MAX_DD: ${r.MAX_DD ?? "—"}`,
    `WINNER: ${r.winner}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `LEAKAGE: ${r.leakage_status}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

function temporalSplit040(kickoffs: string[]): {
  train: number;
  val: number;
  test: number;
  holdout: number;
  holdout2020: number;
} {
  const sorted = [...kickoffs]
    .map((k) => ({ k, ms: parseExactUtcMs(k) }))
    .filter((x): x is { k: string; ms: number } => x.ms != null)
    .sort((a, b) => a.ms - b.ms);
  const n = sorted.length;
  if (n < 100) {
    return { train: 0, val: 0, test: 0, holdout: 0, holdout2020: 0 };
  }
  const trainN = Math.floor(n * 0.5);
  const valN = Math.floor(n * 0.2);
  const testN = Math.floor(n * 0.15);
  const holdoutN = n - trainN - valN - testN;
  const holdoutSlice = sorted.slice(trainN + valN + testN);
  const holdout2020 = holdoutSlice.filter((x) => new Date(x.ms).getUTCFullYear() >= 2020).length;
  return { train: trainN, val: valN, test: testN, holdout: holdoutN, holdout2020 };
}

function verdict040(input: {
  quotes: number;
  locked: number;
  settled: number;
  configured: boolean;
}): LabVerdict040 {
  if (input.quotes === 0 && !input.configured) return "LIVE_NOT_CONFIGURED";
  if (input.quotes === 0) return "COLLECTION_BLOCKED";
  if (input.settled < 100) return "INSUFFICIENT_DATA";
  return "NO_DEMONSTRATED_EDGE";
}

export async function runTask040(input: {
  storeRoot?: string;
  reveal?: boolean;
  recoverLocks?: boolean;
} = {}): Promise<Task040Report> {
  const cfg = loadExp040Config();
  if (cfg.open_task_041) throw new ExperimentIntegrityError("TASK 041 forbidden");
  if (cfg.historical_hunt) throw new ExperimentIntegrityError("historical_hunt forbidden");
  const leakage = runHostileBattery039();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  // Prove LOCK immutability
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
      { home_devig: 0.99 },
    );
    throw new ExperimentIntegrityError("lock_mutable");
  } catch (e) {
    if (e instanceof ExperimentIntegrityError && e.message === "lock_mutable") throw e;
  }

  const storeRoot = sourceStore040(input.storeRoot);
  const store = loadStore039(storeRoot);
  const envConfigured = Boolean(getOddsApiKey());
  const lockResult = input.recoverLocks !== false ? recoverLocks040(store) : { locked: 0, rows: [], decisions: store.decisions };
  if (input.reveal) await revealOnce039({ store });

  const inv = inventory040(store);
  const health = liveHealth039(store);
  const settled = settledVerified039(store);
  const lockedRows = lockResult.rows.length
    ? lockResult.rows
    : recoverLocks040(store).rows;
  const kickoffs = store.events
    .filter((e) => store.decisions.some((d) => d.event_id === e.event_id) && e.commence_time)
    .map((e) => e.commence_time!);
  const split = temporalSplit040(kickoffs);
  const modelReady: boolean | "PARTIAL" =
    settled >= 100 && inv.EVENTS_WITH_T1H_COMPLETE_1X2 >= 100 ? true : inv.EVENTS_WITH_T1H_COMPLETE_1X2 >= 100 ? "PARTIAL" : false;
  const finalVerdict = verdict040({
    quotes: inv.QUOTE_OBSERVATIONS,
    locked: lockedRows.length,
    settled,
    configured: envConfigured,
  });
  const collectionStatus =
    inv.QUOTE_OBSERVATIONS > 0 ? "COLLECTING" : envConfigured ? "READY" : "BLOCKED";
  const holdoutStatus: "EMPTY" | "PARTIAL" | "READY" =
    split.holdout2020 === 0 ? "EMPTY" : settled >= 100 ? "READY" : "PARTIAL";

  const fp = fingerprint040({
    verdict: finalVerdict,
    exp: experimentSha040(),
    quotes: inv.UNIQUE_QUOTES,
    locked: lockedRows.length,
    settled,
    bets: 0,
    winner: null,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "040",
    COLLECTION_STATUS: collectionStatus,
    SOURCE_STATUS: inv.QUOTE_OBSERVATIONS > 0 ? "ok" : health.source_status,
    API_KEY_CONFIGURED: envConfigured,
    EVENTS_DISCOVERED: inv.EVENTS_DISCOVERED,
    EVENTS_RECONSTRUCTED: inv.EVENTS_RECONSTRUCTED,
    QUOTE_OBSERVATIONS: inv.QUOTE_OBSERVATIONS,
    UNIQUE_QUOTES: inv.UNIQUE_QUOTES,
    EXACT_KICKOFFS: inv.EXACT_KICKOFFS,
    MATCH_EXACT: inv.MATCH_EXACT,
    T72_COVERAGE: coverageField040(inv, "T-72h"),
    T48_COVERAGE: coverageField040(inv, "T-48h"),
    T24_COVERAGE: coverageField040(inv, "T-24h"),
    T12_COVERAGE: coverageField040(inv, "T-12h"),
    T6_COVERAGE: coverageField040(inv, "T-6h"),
    T3_COVERAGE: coverageField040(inv, "T-3h"),
    T1H_COVERAGE: inv.EVENTS_WITH_T1H_COMPLETE_1X2 / Math.max(1, inv.EXACT_KICKOFFS),
    T30M_COVERAGE: coverageField040(inv, "T-30m"),
    T15M_COVERAGE: coverageField040(inv, "T-15m"),
    T5M_COVERAGE: coverageField040(inv, "T-5m"),
    T1M_COVERAGE: coverageField040(inv, "T-1m"),
    STRICT_EVENTS: inv.STRICT_EVENTS,
    STRICT_QUOTES: inv.STRICT_QUOTES,
    LOCKED_DECISIONS: lockedRows.length,
    SETTLED_EVENTS: settled,
    TEST_EVENTS: split.test,
    HOLDOUT_EVENTS: split.holdout,
    HOLDOUT_2020_PLUS: split.holdout2020,
    HOLDOUT_STATUS: holdoutStatus,
    MODEL_READY: modelReady,
    MARKET_ONLY_EVALUATION: true,
    MARKET_BRIER: null,
    MARKET_LOGLOSS: null,
    BEST_MODEL: "MARKET_DEVIG",
    DELTA_BRIER: null,
    CI_95: null,
    HOLM: null,
    SIGNIFICANT: false,
    CAPITAL_QUALIFIED: false,
    BETS: 0,
    BANKROLL: "—",
    ROI: null,
    MAX_DD: null,
    winner: null,
    auto_promotion: false,
    REAL_MONEY: false,
    real_money: false,
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT: finalVerdict,
    residual_blocker:
      settled < 100
        ? `Live store recovered (${inv.QUOTE_OBSERVATIONS} quotes, ${lockedRows.length} AS_OF locks). Settled ${settled}/100 — wait REVEAL after kickoff.`
        : "Settled cohort present but capital/edge gates closed.",
    open_task_041: false,
    recover_table: { ...inv.recoverTable, LOCKED_DECISIONS: lockedRows.length, SETTLED_EVENTS: settled },
    locked_rows: lockedRows,
    leakage,
    experiment_sha256: experimentSha040(),
    dataset_fingerprint: createHash("sha256")
      .update(JSON.stringify({ q: inv.UNIQUE_QUOTES, e: inv.EVENTS_DISCOVERED, l: lockedRows.length }))
      .digest("hex"),
    fingerprint: fp,
    adapter_version: "recover-040/v1",
    source_store: storeRoot,
  };
}

export { WINDOWS_039 };
