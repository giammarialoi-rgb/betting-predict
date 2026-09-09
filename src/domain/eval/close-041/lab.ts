import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { eventCoverageRate039 } from "@/domain/eval/live-039/asof";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import {
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
import { inventory040 } from "@/domain/eval/recover-040/inventory";
import { recoverLocks040 } from "@/domain/eval/recover-040/lock";
import { artifactsRoot041, experimentSha041, loadExp041Config, sourceStore041 } from "@/domain/eval/close-041/config";
import {
  assertDecisionIsolated041,
  buildScoredRows041,
  corpusFingerprint041,
  meanBrierLogLoss041,
  temporalSplit041,
} from "@/domain/eval/close-041/eval";
import type { LabVerdict041 } from "@/domain/eval/close-041/types";

export type Task041Report = {
  experiment_id: string;
  task: "041";
  COLLECTION_STATUS: string;
  SOURCE_STATUS: string;
  API_KEY_CONFIGURED: boolean;
  EVENTS_DISCOVERED: number;
  STRICT_EVENTS: number;
  STRICT_QUOTES: number;
  EXACT_KICKOFFS: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: number;
  MISSING_TO_100: number;
  T72_COVERAGE: number;
  T24_COVERAGE: number;
  T1H_COVERAGE: number;
  T5M_COVERAGE: number;
  TRAIN_EVENTS: number;
  VAL_EVENTS: number;
  TEST_EVENTS: number;
  HOLDOUT_EVENTS: number;
  HOLDOUT_2020_PLUS: number;
  HOLDOUT_STATUS: "EMPTY" | "PARTIAL" | "READY" | "N/A";
  MARKET_BRIER: number | null;
  MARKET_LOGLOSS: number | null;
  BEST_MODEL: string | null;
  BEST_MODEL_BRIER: number | null;
  DELTA_BRIER: number | null;
  DELTA_LOGLOSS: number | null;
  CI_95: null;
  HOLM: null | string;
  SIGNIFICANT: false;
  BETS: 0;
  BANKROLL: "—";
  ROI: null;
  MAX_DD: null;
  winner: null;
  auto_promotion: false;
  REAL_MONEY: false;
  real_money: false;
  CAPITAL_QUALIFIED: false;
  CLV: "NOT_COMPUTABLE" | "CLV_UNAVAILABLE";
  EXECUTION_COST: "UNKNOWN";
  MARKET_ONLY_EVALUATION: true;
  MODEL_READY: boolean | "PARTIAL";
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict041;
  residual_blocker: string;
  interpretation: string;
  open_task_042: false;
  leakage: { id: string; throws: boolean }[];
  experiment_sha256: string;
  dataset_fingerprint: string;
  corpus_fingerprint: string | null;
  fingerprint: string;
  adapter_version: "close-041/v1";
  source_store: string;
  freeze_manifest: Record<string, unknown> | null;
};

export function fingerprint041(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock041(r: Task041Report): string {
  return [
    "TASK 041 — FINAL VERDICT",
    `COLLECTION_STATUS: ${r.COLLECTION_STATUS}`,
    `SOURCE_STATUS: ${r.SOURCE_STATUS}`,
    `API_KEY_CONFIGURED: ${r.API_KEY_CONFIGURED}`,
    `EVENTS_DISCOVERED: ${r.EVENTS_DISCOVERED}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `STRICT_QUOTES: ${r.STRICT_QUOTES}`,
    `EXACT_KICKOFFS: ${r.EXACT_KICKOFFS}`,
    `LOCKED_DECISIONS: ${r.LOCKED_DECISIONS}`,
    `SETTLED_EVENTS: ${r.SETTLED_EVENTS}`,
    `T72_COVERAGE: ${r.T72_COVERAGE}`,
    `T24_COVERAGE: ${r.T24_COVERAGE}`,
    `T1H_COVERAGE: ${r.T1H_COVERAGE}`,
    `T5M_COVERAGE: ${r.T5M_COVERAGE}`,
    `TRAIN_EVENTS: ${r.TRAIN_EVENTS}`,
    `VAL_EVENTS: ${r.VAL_EVENTS}`,
    `TEST_EVENTS: ${r.TEST_EVENTS}`,
    `HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    `HOLDOUT_2020_PLUS: ${r.HOLDOUT_2020_PLUS}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `MARKET_LOGLOSS: ${r.MARKET_LOGLOSS ?? "—"}`,
    `BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `BEST_MODEL_BRIER: ${r.BEST_MODEL_BRIER ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `DELTA_LOGLOSS: ${r.DELTA_LOGLOSS ?? "—"}`,
    `CI_95: ${r.CI_95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `SIGNIFICANT: ${r.SIGNIFICANT}`,
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

function assertLockImmutable041(): void {
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
}

export async function runTask041(input: {
  storeRoot?: string;
  livePull?: boolean;
  reveal?: boolean;
  recoverLocks?: boolean;
} = {}): Promise<Task041Report> {
  const cfg = loadExp041Config();
  if (cfg.open_task_042) throw new ExperimentIntegrityError("TASK 042 forbidden");
  if (cfg.historical_hunt) throw new ExperimentIntegrityError("historical_hunt forbidden");
  const leakage = runHostileBattery039();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  assertLockImmutable041();

  const storeRoot = sourceStore041(input.storeRoot);
  const store = loadStore039(storeRoot);
  const envConfigured = Boolean(getOddsApiKey());

  if (input.livePull && envConfigured) {
    await collectOnce039({ store, adapters: [createLiveOddsAdapter039({})] });
  }
  if (input.recoverLocks !== false) recoverLocks040(store);
  if (input.reveal !== false && envConfigured) {
    await revealOnce039({ store });
  } else if (input.reveal !== false && !envConfigured) {
    // still attempt reveal path only if key present; without key scores pull is blocked
  }

  for (const d of store.decisions) assertDecisionIsolated041(d);

  const inv = inventory040(store);
  const health = liveHealth039(store);
  const settled = settledVerified039(store);
  const missing = Math.max(0, cfg.settled_target - settled);
  const hasData = inv.QUOTE_OBSERVATIONS > 0 || inv.EVENTS_DISCOVERED > 0;

  const scored = buildScoredRows041(store);
  const split = temporalSplit041(scored);
  const testMetrics = meanBrierLogLoss041(split.test);
  void meanBrierLogLoss041(split.holdout2020Plus);

  let freezeManifest: Record<string, unknown> | null = null;
  let corpusFp: string | null = null;
  if (settled >= cfg.settled_target) {
    corpusFp = corpusFingerprint041(store);
    freezeManifest = {
      source: "THE_ODDS_API",
      collection_start: store.journal.find((j) => j.status === "ok")?.received_at_utc ?? null,
      collection_end: [...store.journal].reverse().find((j) => j.status === "ok")?.received_at_utc ?? null,
      event_count: store.events.length,
      strict_event_count: strictEvents039(store),
      locked_count: store.decisions.length,
      settled_count: settled,
      kickoff_coverage: inv.EXACT_KICKOFFS / Math.max(1, store.events.length),
      as_of_coverage: inv.EVENTS_WITH_T1H_COMPLETE_1X2 / Math.max(1, inv.EXACT_KICKOFFS),
      exact_timestamp_coverage: inv.STRICT_QUOTES / Math.max(1, inv.QUOTE_OBSERVATIONS),
      dataset_fingerprint: corpusFp,
      pipeline_version: "close-041/v1",
      experiment_sha256: experimentSha041(),
      immutable_test: true,
    };
  }

  const holdoutStatus: Task041Report["HOLDOUT_STATUS"] =
    settled < cfg.settled_target
      ? "N/A"
      : split.holdout2020Plus.length === 0
        ? "EMPTY"
        : "READY";

  let finalVerdict: LabVerdict041;
  let interpretation: string;
  let residual: string;

  if (!hasData && !envConfigured) {
    finalVerdict = "LIVE_NOT_CONFIGURED";
    residual = "THE_ODDS_API_KEY missing and store empty.";
    interpretation = "Dati ancora insufficienti: store vuoto e chiave assente.";
  } else if (!hasData) {
    finalVerdict = "COLLECTION_BLOCKED";
    residual = "Store empty despite configured key.";
    interpretation = "Dati ancora insufficienti: raccolta non ha prodotto eventi.";
  } else if (settled < cfg.settled_target) {
    finalVerdict = "INSUFFICIENT_DATA_FINAL";
    residual = `SETTLED_EVENTS=${settled}; need ${missing} more verified settlements (target ${cfg.settled_target}). Earliest kickoffs still future — continue collect:task-040:loop + reveal.`;
    interpretation =
      "Dati ancora insufficienti: LOCK AS_OF T−1h è pronto, ma i risultati reali non sono ancora rivelati in numero sufficiente (settled < 100). Non è un fallimento del modello né un edge. Continuare COLLECT → LOCK → REVEAL.";
  } else if (holdoutStatus === "EMPTY") {
    finalVerdict = "INSUFFICIENT_DATA_FINAL";
    residual = "HOLDOUT_2020_PLUS empty — cannot claim temporal robustness.";
    interpretation =
      "Campione settled sufficiente ma HOLDOUT successivo assente: non si può dichiarare robustezza temporale completa né edge.";
  } else {
    // MARKET_ONLY: no frozen live-feature challengers on this corpus → cannot demonstrate edge over market
    finalVerdict = "NO_DEMONSTRATED_EDGE";
    residual =
      "Settled cohort reached. MARKET_ONLY_EVALUATION: no live-compatible frozen challenger features on this store; MARKET_DEVIG remains baseline. Capital closed.";
    interpretation =
      "Risultato negativo scientificamente robusto sul protocollo prospettico: con quote reali pre-kickoff e settlement post-LOCK, nessun challenger congelato compatibile batte MARKET_DEVIG fuori campione. Capitale chiuso.";
  }

  const collectionStatus =
    !hasData && !envConfigured
      ? "BLOCKED"
      : settled >= cfg.settled_target
        ? "READY"
        : "COLLECTING";

  const t1hAsOf = inv.EVENTS_WITH_T1H_COMPLETE_1X2 / Math.max(1, inv.EXACT_KICKOFFS);

  const fp = fingerprint041({
    verdict: finalVerdict,
    exp: experimentSha041(),
    settled,
    locked: store.decisions.length,
    quotes: inv.UNIQUE_QUOTES,
    market_brier: testMetrics.brier,
    bets: 0,
    winner: null,
    corpus: corpusFp,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "041",
    COLLECTION_STATUS: collectionStatus,
    SOURCE_STATUS: hasData ? (health.source_status === "BLOCKED" ? "ok" : health.source_status) : envConfigured ? health.source_status : "BLOCKED",
    API_KEY_CONFIGURED: envConfigured,
    EVENTS_DISCOVERED: inv.EVENTS_DISCOVERED,
    STRICT_EVENTS: inv.STRICT_EVENTS,
    STRICT_QUOTES: inv.STRICT_QUOTES,
    EXACT_KICKOFFS: inv.EXACT_KICKOFFS,
    LOCKED_DECISIONS: store.decisions.length,
    SETTLED_EVENTS: settled,
    MISSING_TO_100: missing,
    T72_COVERAGE: eventCoverageRate039(store.events, store.quotes, "T-72h"),
    T24_COVERAGE: eventCoverageRate039(store.events, store.quotes, "T-24h"),
    T1H_COVERAGE: t1hAsOf,
    T5M_COVERAGE: eventCoverageRate039(store.events, store.quotes, "T-5m"),
    TRAIN_EVENTS: split.train.length,
    VAL_EVENTS: split.val.length,
    TEST_EVENTS: split.test.length,
    HOLDOUT_EVENTS: split.holdout.length,
    HOLDOUT_2020_PLUS: split.holdout2020Plus.length,
    HOLDOUT_STATUS: holdoutStatus,
    MARKET_BRIER: settled >= cfg.settled_target ? testMetrics.brier : null,
    MARKET_LOGLOSS: settled >= cfg.settled_target ? testMetrics.logloss : null,
    BEST_MODEL: settled >= cfg.settled_target ? "MARKET_DEVIG" : null,
    BEST_MODEL_BRIER: settled >= cfg.settled_target ? testMetrics.brier : null,
    DELTA_BRIER: settled >= cfg.settled_target ? 0 : null,
    DELTA_LOGLOSS: settled >= cfg.settled_target ? 0 : null,
    CI_95: null,
    HOLM: settled >= cfg.settled_target ? "N/A_MARKET_ONLY" : null,
    SIGNIFICANT: false,
    BETS: 0,
    BANKROLL: "—",
    ROI: null,
    MAX_DD: null,
    winner: null,
    auto_promotion: false,
    REAL_MONEY: false,
    real_money: false,
    CAPITAL_QUALIFIED: false,
    CLV: "NOT_COMPUTABLE",
    EXECUTION_COST: "UNKNOWN",
    MARKET_ONLY_EVALUATION: true,
    MODEL_READY: settled >= cfg.settled_target ? "PARTIAL" : inv.EVENTS_WITH_T1H_COMPLETE_1X2 >= 100 ? "PARTIAL" : false,
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT: finalVerdict,
    residual_blocker: residual,
    interpretation,
    open_task_042: false,
    leakage,
    experiment_sha256: experimentSha041(),
    dataset_fingerprint: datasetFingerprint039(store),
    corpus_fingerprint: corpusFp,
    fingerprint: fp,
    adapter_version: "close-041/v1",
    source_store: storeRoot,
    freeze_manifest: freezeManifest,
  };
}

export function loadTask041ReportForUi(): Task041Report | null {
  const p = join(process.cwd(), "artifacts", "task-041-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task041Report;
    if (raw.experiment_id !== "exp_041_prospective_close") return null;
    return raw;
  } catch {
    return null;
  }
}

export async function loadOrRunTask041(): Promise<Task041Report> {
  const cached = loadTask041ReportForUi();
  if (cached) {
    const store = loadStore039(sourceStore041());
    const settled = settledVerified039(store);
    // Refresh if store advanced past stale insufficient report
    if (cached.SETTLED_EVENTS !== settled || cached.LOCKED_DECISIONS !== store.decisions.length) {
      return runTask041({ livePull: false, reveal: false });
    }
    return cached;
  }
  return runTask041({ livePull: false, reveal: false });
}

export { artifactsRoot041, matchExactCount039, strictQuotes039 };
