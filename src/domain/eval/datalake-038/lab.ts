import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { hashPayload } from "@/ingest/hash";
import { datasetFingerprint036 } from "@/domain/eval/prospective-036/store";
import { experimentSha038, loadExp038Config, storeRoot038 } from "@/domain/eval/datalake-038/config";
import { buildLake038, persistLake038, type Lake038 } from "@/domain/eval/datalake-038/lake";
import { runHostileBattery038 } from "@/domain/eval/datalake-038/leakage";
import { collectOnce038, loadStore038 } from "@/domain/eval/datalake-038/collector";
import {
  asOfCoverageRate038,
  complete1x2Events038,
  liveHealth038,
  matchExactCount038,
  strictQuotes038,
} from "@/domain/eval/datalake-038/health";
import { getOddsApiKey, resolveLiveAdapters038 } from "@/domain/eval/datalake-038/sources";
import type { CollectionStatus038, LabVerdict038, SourceManifest038 } from "@/domain/eval/datalake-038/types";
import type { OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";

export type Task038Report = {
  experiment_id: string;
  task: "038";
  STATUS: "COMPLETED";
  DATA_LAKE_STATUS: "READY";
  SOURCES_INGESTED: number;
  RESEARCH_EVENTS: number;
  STRICT_EVENTS: number;
  STRICT_QUOTES: number;
  EXACT_KICKOFFS: number;
  T72_COVERAGE: number;
  T24_COVERAGE: number;
  T1H_COVERAGE: number;
  T5M_COVERAGE: number;
  MATCH_EXACT: number;
  COMPLETE_1X2: number;
  LIVE_SOURCE_STATUS: CollectionStatus038;
  LIVE_ADAPTER: "READY";
  LIVE_SOURCE: "THE_ODDS_API";
  API_KEY: "configured" | "missing";
  COLLECTION_STATUS: CollectionStatus038;
  HISTORICAL_SEARCH: "CLOSED";
  STRICT_PIPELINE: "READY";
  CAPITAL: "CLOSED";
  MODEL_READY: false;
  TRAIN_EVENTS: 0;
  VAL_EVENTS: 0;
  TEST_EVENTS: 0;
  HOLDOUT_EVENTS: 0;
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
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict038;
  DATA_PROBLEM: string;
  MODEL_PROBLEM: string;
  CAPITAL_PROBLEM: string;
  residual_blocker: string;
  open_task_039: false;
  lake: Lake038;
  sources: SourceManifest038[];
  health: ReturnType<typeof liveHealth038>;
  leakage: { id: string; throws: boolean }[];
  experiment_sha256: string;
  dataset_fingerprint: string;
  fingerprint: string;
};

export function fingerprint038(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock038(r: Task038Report): string {
  return [
    "TASK 038 — DEFINITIVE DATA-LAKE + LIVE STRICT ACTIVATION",
    `STATUS: ${r.STATUS}`,
    `DATA_LAKE_STATUS: ${r.DATA_LAKE_STATUS}`,
    `SOURCES_INGESTED: ${r.SOURCES_INGESTED}`,
    `RESEARCH_EVENTS: ${r.RESEARCH_EVENTS}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `EXACT_KICKOFFS: ${r.EXACT_KICKOFFS}`,
    `T-72h COVERAGE: ${r.T72_COVERAGE}`,
    `T-24h COVERAGE: ${r.T24_COVERAGE}`,
    `T-1h COVERAGE: ${r.T1H_COVERAGE}`,
    `MATCH_EXACT: ${r.MATCH_EXACT}`,
    `LIVE_SOURCE_STATUS: ${r.LIVE_SOURCE_STATUS}`,
    `API_KEY: ${r.API_KEY}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `TRAIN / VAL / TEST / HOLDOUT: ${r.TRAIN_EVENTS} / ${r.VAL_EVENTS} / ${r.TEST_EVENTS} / ${r.HOLDOUT_EVENTS}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `CI: ${r.CI_95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `WINNER: ${r.winner}`,
    `REAL_MONEY: ${r.real_money}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `LEAKAGE: ${r.leakage_status}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `RESIDUAL_BLOCKER: ${r.residual_blocker}`,
  ].join("\n");
}

function verdict038(input: {
  configured: boolean;
  strictEvents: number;
  dataSufficient: boolean;
}): LabVerdict038 {
  if (!input.configured) return "LIVE_NOT_CONFIGURED";
  if (input.strictEvents < 100) return "LIVE_COLLECTION_ACTIVE";
  if (!input.dataSufficient) return "STRICT_PILOT_READY";
  return "STRICT_DATA_SUFFICIENT";
}

export async function runTask038(input: {
  storeRoot?: string;
  adapters?: OddsSourceAdapter[];
  livePull?: boolean;
  persistLake?: boolean;
} = {}): Promise<Task038Report> {
  const cfg = loadExp038Config();
  if (cfg.open_task_039) throw new ExperimentIntegrityError("TASK 039 forbidden");
  const leakage = runHostileBattery038();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  const lake = buildLake038();
  if (input.persistLake !== false) persistLake038(lake);
  const adapters = input.adapters ?? resolveLiveAdapters038();
  const store = loadStore038(input.storeRoot ?? storeRoot038());
  const configured = Boolean(getOddsApiKey()) || adapters.some((a) => a.id === "the-odds-api" && a.configured());
  if (input.livePull === true && configured) {
    await collectOnce038({ store, adapters });
  }
  const health = liveHealth038(store);
  const strictQ = strictQuotes038(store);
  const strictEvents = new Set(strictQ.map((q) => q.event_id)).size;
  const exactKickoffs = store.events.filter((e) => /Z$/i.test(e.kickoff_at_utc) || /[+-]\d{2}:\d{2}$/.test(e.kickoff_at_utc)).length;
  const matchExact = matchExactCount038(store);
  const complete1x2 = complete1x2Events038(store);
  const t72 = asOfCoverageRate038(store, "T-72h");
  const t24 = asOfCoverageRate038(store, "T-24h");
  const t1h = asOfCoverageRate038(store, "T-1h");
  const t5m = asOfCoverageRate038(store, "T-5m");
  const books = new Set(strictQ.map((q) => q.bookmaker)).size;
  const dataSufficient =
    strictEvents >= 100 &&
    matchExact >= 100 &&
    complete1x2 >= 100 &&
    t1h >= cfg.t1h_coverage_min &&
    t24 >= cfg.t24_coverage_min &&
    (books >= cfg.min_bookmakers_when_available || strictEvents === 0);
  const apiKey: "configured" | "missing" =
    Boolean(getOddsApiKey()) || (Boolean(input.adapters) && configured) ? "configured" : "missing";
  const collectionStatus: CollectionStatus038 =
    apiKey === "missing" ? "NOT_CONFIGURED" : health.collectionStatus === "NOT_CONFIGURED" ? "READY" : health.collectionStatus;
  const finalVerdict = verdict038({ configured: apiKey === "configured", strictEvents, dataSufficient });
  const datasetFp = hashPayload({
    lake: lake.fingerprint,
    live: datasetFingerprint036(store),
    model: cfg.model_version,
    dataset: cfg.dataset_version,
  });
  const fp = fingerprint038({
    verdict: finalVerdict,
    exp: experimentSha038(),
    lake: lake.fingerprint,
    live: datasetFp,
    strictEvents,
    bets: 0,
    winner: null,
    apiKey,
  });
  const residual =
    apiKey === "missing"
      ? "THE_ODDS_API_KEY=<user must provide>"
      : strictEvents < 100
        ? `Live STRICT events = ${strictEvents}. Continue collect:task-038 until PILOT_TARGET 100.`
        : "Scientific protocol not yet runnable (settlement/TEST/HOLDOUT empty). Capital remains closed.";

  return {
    experiment_id: cfg.experiment_id,
    task: "038",
    STATUS: "COMPLETED",
    DATA_LAKE_STATUS: "READY",
    SOURCES_INGESTED: lake.sources.length,
    RESEARCH_EVENTS: lake.researchEvents,
    STRICT_EVENTS: strictEvents,
    STRICT_QUOTES: strictQ.length,
    EXACT_KICKOFFS: exactKickoffs,
    T72_COVERAGE: t72,
    T24_COVERAGE: t24,
    T1H_COVERAGE: t1h,
    T5M_COVERAGE: t5m,
    MATCH_EXACT: matchExact,
    COMPLETE_1X2: complete1x2,
    LIVE_SOURCE_STATUS: collectionStatus,
    LIVE_ADAPTER: "READY",
    LIVE_SOURCE: "THE_ODDS_API",
    API_KEY: apiKey,
    COLLECTION_STATUS: collectionStatus,
    HISTORICAL_SEARCH: "CLOSED",
    STRICT_PIPELINE: "READY",
    CAPITAL: "CLOSED",
    MODEL_READY: false,
    TRAIN_EVENTS: 0,
    VAL_EVENTS: 0,
    TEST_EVENTS: 0,
    HOLDOUT_EVENTS: 0,
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
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT: finalVerdict,
    DATA_PROBLEM:
      apiKey === "missing"
        ? "No live quote clock yet. Historical public hunt is closed. Research corpus is catalogued but not STRICT-usable."
        : strictEvents < 100
          ? "Live collection active; STRICT pilot target not reached."
          : "none",
    MODEL_PROBLEM: "No prospective settled TEST set. MARKET_DEVIG frozen. No challenger selection.",
    CAPITAL_PROBLEM: "CLOSED. BETS=0. BANKROLL=—. Gates DATA_SUFFICIENT/MODEL_READY/TEST/HOLDOUT/significance/cost/leakage not jointly passed.",
    residual_blocker: residual,
    open_task_039: false,
    lake,
    sources: lake.sources,
    health,
    leakage,
    experiment_sha256: experimentSha038(),
    dataset_fingerprint: datasetFp,
    fingerprint: fp,
  };
}

export function loadTask038ReportForUi(): Task038Report | null {
  const p = join(process.cwd(), "artifacts", "task-038-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task038Report;
    if (raw.experiment_id !== "exp_038_data_lake_live") return null;
    return raw;
  } catch {
    return null;
  }
}

export async function loadOrRunTask038(): Promise<Task038Report> {
  return loadTask038ReportForUi() ?? runTask038({ livePull: false, persistLake: false });
}
