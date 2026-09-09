import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";
import { eventCoverageRate039 } from "@/domain/eval/live-039/asof";
import { experimentSha039, loadExp039Config, storeRoot039 } from "@/domain/eval/live-039/config";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import {
  complete1x2Events039,
  liveHealth039,
  matchExactCount039,
  settledVerified039,
  strictEvents039,
  strictQuotes039,
} from "@/domain/eval/live-039/health";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { revealOnce039 } from "@/domain/eval/live-039/settle";
import { createLiveOddsAdapter039, getOddsApiKey } from "@/domain/eval/live-039/sources";
import { datasetFingerprint039 } from "@/domain/eval/live-039/store";
import type { CollectionStatus039, LabVerdict039, Manifest039 } from "@/domain/eval/live-039/types";

export type Task039Report = {
  experiment_id: string;
  task: "039";
  COLLECTION_STATUS: CollectionStatus039;
  SOURCE_STATUS: string;
  API_KEY_CONFIGURED: boolean;
  EVENTS_DISCOVERED: number;
  QUOTE_OBSERVATIONS: number;
  STRICT_EVENTS: number;
  STRICT_QUOTES: number;
  MATCH_EXACT: number;
  T72_COVERAGE: number;
  T24_COVERAGE: number;
  T1H_COVERAGE: number;
  T5M_COVERAGE: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: number;
  UNSETTLED_EVENTS: number;
  TEST_EVENTS: 0;
  HOLDOUT_EVENTS: 0;
  MODEL_READY: boolean;
  QUALIFIED_FOR_DIAGNOSTIC: boolean;
  MARKET_BRIER: null;
  BEST_MODEL: null;
  DELTA_BRIER: null;
  CI_95: null;
  HOLM: null;
  SIGNIFICANT: false;
  BETS: 0;
  BANKROLL: "—";
  winner: null;
  auto_promotion: false;
  real_money: false;
  EXECUTION_COST: "UNKNOWN";
  CLV: "CLV_UNAVAILABLE";
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict039;
  residual_blocker: string;
  open_task_040: false;
  health: ReturnType<typeof liveHealth039>;
  manifest: Manifest039;
  leakage: { id: string; throws: boolean }[];
  experiment_sha256: string;
  dataset_fingerprint: string;
  fingerprint: string;
};

export function fingerprint039(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock039(r: Task039Report): string {
  return [
    "TASK 039 — FINAL VERDICT",
    `COLLECTION_STATUS: ${r.COLLECTION_STATUS}`,
    `SOURCE_STATUS: ${r.SOURCE_STATUS}`,
    `API_KEY_CONFIGURED: ${r.API_KEY_CONFIGURED}`,
    `EVENTS_DISCOVERED: ${r.EVENTS_DISCOVERED}`,
    `QUOTE_OBSERVATIONS: ${r.QUOTE_OBSERVATIONS}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `STRICT_QUOTES: ${r.STRICT_QUOTES}`,
    `MATCH_EXACT: ${r.MATCH_EXACT}`,
    `T72_COVERAGE: ${r.T72_COVERAGE}`,
    `T24_COVERAGE: ${r.T24_COVERAGE}`,
    `T1H_COVERAGE: ${r.T1H_COVERAGE}`,
    `T5M_COVERAGE: ${r.T5M_COVERAGE}`,
    `LOCKED_DECISIONS: ${r.LOCKED_DECISIONS}`,
    `SETTLED_EVENTS: ${r.SETTLED_EVENTS}`,
    `TEST_EVENTS: ${r.TEST_EVENTS}`,
    `HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `CI_95: ${r.CI_95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `SIGNIFICANT: ${r.SIGNIFICANT}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `WINNER: ${r.winner}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REAL_MONEY: ${r.real_money}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `LEAKAGE: ${r.leakage_status}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}

function verdict039(input: {
  configured: boolean;
  sourceOk: boolean;
  qualified: boolean;
}): LabVerdict039 {
  if (!input.configured) return "LIVE_NOT_CONFIGURED";
  if (!input.sourceOk) return "SOURCE_UNAVAILABLE";
  if (input.qualified) return "DIAGNOSTIC_READY";
  return "COLLECTING";
}

export async function runTask039(input: {
  storeRoot?: string;
  adapters?: OddsSourceAdapter[];
  livePull?: boolean;
  reveal?: boolean;
} = {}): Promise<Task039Report> {
  const cfg = loadExp039Config();
  if (cfg.open_task_040) throw new ExperimentIntegrityError("TASK 040 forbidden");
  const leakage = runHostileBattery039();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  const store = loadStore039(input.storeRoot ?? storeRoot039());
  const envConfigured = Boolean(getOddsApiKey());
  const adapters = input.adapters ?? [createLiveOddsAdapter039({})];
  const configured = envConfigured || (Boolean(input.adapters) && adapters.some((a) => a.configured()));
  const hasPersistedLive =
    store.quotes.length > 0 || store.events.length > 0 || store.journal.some((j) => j.status === "ok");
  if (input.livePull === true && configured) {
    await collectOnce039({ store, adapters });
    if (input.reveal !== false) await revealOnce039({ store });
  }
  const health = liveHealth039(store);
  const strictE = strictEvents039(store);
  const strictQ = strictQuotes039(store).length;
  const matchExact = matchExactCount039(store);
  const complete = complete1x2Events039(store);
  const settled = settledVerified039(store);
  const qualified = strictE >= 100 && matchExact >= 100 && complete >= 100 && settled >= 100;
  const sourceOk =
    hasPersistedLive ||
    (configured &&
      (store.journal.some((j) => j.status === "ok") || (Boolean(input.adapters) && adapters.some((a) => a.configured()))));
  const collectionStatus: CollectionStatus039 = hasPersistedLive
    ? "COLLECTING"
    : !configured
      ? "BLOCKED"
      : !sourceOk && store.journal.some((j) => j.status === "error" || j.status === "SOURCE_UNAVAILABLE")
        ? "SOURCE_UNAVAILABLE"
        : configured && !envConfigured && Boolean(input.adapters)
          ? "COLLECTING"
          : health.collector_status === "BLOCKED" && configured
            ? "READY"
            : health.collector_status;
  const finalVerdict = hasPersistedLive
    ? verdict039({ configured: true, sourceOk: true, qualified })
    : verdict039({
        configured,
        sourceOk: configured && (sourceOk || collectionStatus !== "SOURCE_UNAVAILABLE"),
        qualified,
      });
  const journalOk = store.journal.filter((j) => j.status === "ok");
  const manifest: Manifest039 = {
    dataset_sha256: datasetFingerprint039(store),
    source: "THE_ODDS_API",
    collection_start: journalOk[0]?.received_at_utc ?? null,
    collection_end: journalOk.at(-1)?.received_at_utc ?? null,
    events_discovered: store.events.length,
    events_with_kickoff: store.events.filter((e) => e.kickoff_status === "OK").length,
    events_with_quotes: new Set(store.quotes.map((q) => q.event_id)).size,
    strict_events: strictE,
    strict_quotes: strictQ,
    t72_coverage: eventCoverageRate039(store.events, store.quotes, "T-72h"),
    t24_coverage: eventCoverageRate039(store.events, store.quotes, "T-24h"),
    t1h_coverage: eventCoverageRate039(store.events, store.quotes, "T-1h"),
    t5m_coverage: eventCoverageRate039(store.events, store.quotes, "T-5m"),
    settled_events: settled,
    unsettled_events: store.settlements.filter((s) => s.outcome === "UNSETTLED").length,
  };
  const fp = fingerprint039({
    verdict: finalVerdict,
    exp: experimentSha039(),
    live: manifest.dataset_sha256,
    strict: strictE,
    bets: 0,
    winner: null,
    configured,
  });
  return {
    experiment_id: cfg.experiment_id,
    task: "039",
    COLLECTION_STATUS: !configured && !hasPersistedLive ? "BLOCKED" : collectionStatus,
    SOURCE_STATUS: hasPersistedLive ? health.source_status === "BLOCKED" ? "ok" : health.source_status : configured ? health.source_status : "BLOCKED",
    API_KEY_CONFIGURED: envConfigured || (Boolean(input.adapters) && configured),
    EVENTS_DISCOVERED: store.events.length,
    QUOTE_OBSERVATIONS: store.quotes.length,
    STRICT_EVENTS: strictE,
    STRICT_QUOTES: strictQ,
    MATCH_EXACT: matchExact,
    T72_COVERAGE: manifest.t72_coverage,
    T24_COVERAGE: manifest.t24_coverage,
    T1H_COVERAGE: manifest.t1h_coverage,
    T5M_COVERAGE: manifest.t5m_coverage,
    LOCKED_DECISIONS: store.decisions.length,
    SETTLED_EVENTS: settled,
    UNSETTLED_EVENTS: manifest.unsettled_events,
    TEST_EVENTS: 0,
    HOLDOUT_EVENTS: 0,
    MODEL_READY: qualified,
    QUALIFIED_FOR_DIAGNOSTIC: qualified,
    MARKET_BRIER: null,
    BEST_MODEL: null,
    DELTA_BRIER: null,
    CI_95: null,
    HOLM: null,
    SIGNIFICANT: false,
    BETS: 0,
    BANKROLL: "—",
    winner: null,
    auto_promotion: false,
    real_money: false,
    EXECUTION_COST: "UNKNOWN",
    CLV: "CLV_UNAVAILABLE",
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT:
      !envConfigured && !input.adapters && !hasPersistedLive ? "LIVE_NOT_CONFIGURED" : finalVerdict,
    residual_blocker:
      !configured && !hasPersistedLive
        ? "THE_ODDS_API_KEY=<user must provide>"
        : qualified
          ? "Diagnostic cohort reached; capital remains closed until TEST+HOLDOUT+significance+cost."
          : hasPersistedLive
            ? "Persisted live store present. Continue COLLECT → LOCK → REVEAL until STRICT settled >= 100."
            : "Live pipeline ready. Continue COLLECT → LOCK → REVEAL until STRICT settled >= 100.",
    open_task_040: false,
    health,
    manifest,
    leakage,
    experiment_sha256: experimentSha039(),
    dataset_fingerprint: manifest.dataset_sha256,
    fingerprint: fp,
  };
}

export function loadTask039ReportForUi(): Task039Report | null {
  const p = join(process.cwd(), "artifacts", "task-039-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task039Report;
    if (raw.experiment_id !== "exp_039_prospective_live") return null;
    return raw;
  } catch {
    return null;
  }
}

/** Stale LIVE_NOT_CONFIGURED artifacts must not mask a populated live store. */
export function isStale039UiReport(report: Task039Report | null, storeEvents: number, storeQuotes: number): boolean {
  if (!report) return false;
  if (report.FINAL_VERDICT === "LIVE_NOT_CONFIGURED" && (storeEvents > 0 || storeQuotes > 0)) return true;
  if (report.QUOTE_OBSERVATIONS === 0 && storeQuotes > 0) return true;
  if (report.EVENTS_DISCOVERED === 0 && storeEvents > 0) return true;
  return false;
}

export async function loadOrRunTask039(): Promise<Task039Report> {
  const store = loadStore039(storeRoot039());
  const cached = loadTask039ReportForUi();
  if (cached && !isStale039UiReport(cached, store.events.length, store.quotes.length)) return cached;
  return runTask039({ livePull: false });
}
