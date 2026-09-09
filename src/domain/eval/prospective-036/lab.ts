import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { collectOnce036 } from "@/domain/eval/prospective-036/collector";
import { experimentSha036, loadExp036Config, storeRoot036 } from "@/domain/eval/prospective-036/config";
import { eventCoverageRate, sourceHealth036 } from "@/domain/eval/prospective-036/health";
import { runHostileBattery036 } from "@/domain/eval/prospective-036/leakage";
import { getFootballDataOrgToken, getOddsApiKey, resolveLiveAdapters } from "@/domain/eval/prospective-036/sources";
import { datasetFingerprint036, loadStore036 } from "@/domain/eval/prospective-036/store";
import type { LabVerdict036, SourceHealth036 } from "@/domain/eval/prospective-036/types";
import type { OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";

export type Task036Report = {
  experiment_id: string;
  task: "036";
  COLLECTION_STATUS: "READY" | "BLOCKED";
  SOURCE: string;
  SOURCE_STATUS: string;
  COLLECTION_START: string;
  EVENTS_DISCOVERED: number;
  QUOTE_OBSERVATIONS: number;
  STRICT_EVENTS: number;
  STRICT_QUOTES: number;
  EXACT_KICKOFFS: number;
  T72_COVERAGE: number;
  T24_COVERAGE: number;
  T1H_COVERAGE: number;
  T5M_COVERAGE: number;
  LOCKED_DECISIONS: number;
  SETTLED_EVENTS: 0;
  MODEL_READY: false;
  TEST_EVENTS: 0;
  HOLDOUT_EVENTS: 0;
  EDGE: false;
  BETS: 0;
  BANKROLL: "—";
  winner: null;
  auto_promotion: false;
  real_money: false;
  markets: string[];
  bookmakers: string[];
  MARKET_BRIER: null;
  BEST_MODEL_BRIER: null;
  DELTA_BRIER: null;
  SIGNIFICANCE: null;
  CAPITAL_GATE: "CLOSED";
  OBSERVATION_ONLY: true;
  verdict: LabVerdict036;
  FINAL_VERDICT: LabVerdict036;
  blocker: { source: string; error: string; needs: string; why_not_bypassable: string } | null;
  health: SourceHealth036[];
  historical: { dataset: "TASK_031_BASE"; strict_events: 10499; holdout_2020: 0 };
  leakage: { id: string; throws: boolean }[];
  leakage_status: "PASS" | "FAIL";
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  experiment_sha256: string;
  dataset_fingerprint: string;
  fingerprint: string;
};

export function fingerprint036(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function printVerdictBlock036(r: Task036Report): string {
  return [
    "TASK 036 VERDICT:",
    `COLLECTION_STATUS: ${r.COLLECTION_STATUS}`,
    `SOURCE: ${r.SOURCE}`,
    `SOURCE_STATUS: ${r.SOURCE_STATUS}`,
    `COLLECTION_START: ${r.COLLECTION_START}`,
    `EVENTS_DISCOVERED: ${r.EVENTS_DISCOVERED}`,
    `QUOTE_OBSERVATIONS: ${r.QUOTE_OBSERVATIONS}`,
    `STRICT_EVENTS: ${r.STRICT_EVENTS}`,
    `STRICT_QUOTES: ${r.STRICT_QUOTES}`,
    `EXACT_KICKOFFS: ${r.EXACT_KICKOFFS}`,
    `T72_COVERAGE: ${r.T72_COVERAGE}`,
    `T24_COVERAGE: ${r.T24_COVERAGE}`,
    `T1H_COVERAGE: ${r.T1H_COVERAGE}`,
    `T5M_COVERAGE: ${r.T5M_COVERAGE}`,
    `LOCKED_DECISIONS: ${r.LOCKED_DECISIONS}`,
    `SETTLED_EVENTS: ${r.SETTLED_EVENTS}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `TEST_EVENTS: ${r.TEST_EVENTS}`,
    `HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    `EDGE: ${r.EDGE}`,
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

export async function runTask036(input: {
  storeRoot?: string;
  adapters?: OddsSourceAdapter[];
  livePull?: boolean;
}): Promise<Task036Report> {
  const cfg = loadExp036Config();
  const leakage = runHostileBattery036();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }
  const adapters = input.adapters ?? resolveLiveAdapters();
  const store = loadStore036(input.storeRoot ?? storeRoot036());
  const live = input.livePull === true;
  if (live) {
    await collectOnce036({ store, adapters });
  }

  const oddsKey = Boolean(getOddsApiKey());
  const fdTok = Boolean(getFootballDataOrgToken());
  const fixtureAdapters = Boolean(input.adapters);
  const health = adapters.map((a) => sourceHealth036(store, a.id, a.configured()));
  const strictQuotes = store.quotes.filter((q) => q.availability_class === "STRICT");
  const strictEvents = new Set(strictQuotes.map((q) => q.event_id)).size;
  const exactKickoffs = store.events.filter((e) => e.kickoff_at_utc.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(e.kickoff_at_utc)).length;
  const liveOddsOk = health.some((h) => h.source === "the-odds-api" && h.status === "ok" && h.quotes_seen > 0);
  const fixtureReady = fixtureAdapters && strictEvents > 0;
  const ready = liveOddsOk || fixtureReady;
  const primary = health.find((h) => h.source === "the-odds-api") ?? health[0];
  const blocker = ready
    ? null
    : {
        source: "the-odds-api",
        error: oddsKey ? (primary?.last_error ?? "configured but produced 0 STRICT quotes") : "SOURCE_UNAVAILABLE",
        needs: "THE_ODDS_API_KEY (live /odds ISO last_update + commence_time). Optional FOOTBALL_DATA_ORG_TOKEN for kickoff/settlement only.",
        why_not_bypassable:
          "Prospective STRICT requires a real observation clock. football-data.org has utcDate kickoff but no bookmaker publish timestamp on the catalogued free surface. Historical hunt is closed (TASK 035). No synthetic quotes. No user-credential bypass.",
      };

  const verdict: LabVerdict036 = ready ? "PROSPECTIVE_COLLECTION_READY" : "PROSPECTIVE_COLLECTION_BLOCKED";
  const fp = fingerprint036({
    verdict,
    exp: experimentSha036(),
    dataset: datasetFingerprint036(store),
    strictEvents,
    bets: 0,
    winner: null,
    oddsKey,
    fdTok,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "036",
    COLLECTION_STATUS: ready ? "READY" : "BLOCKED",
    SOURCE: adapters.map((a) => a.id).join("+"),
    SOURCE_STATUS: primary?.status ?? "SOURCE_UNAVAILABLE",
    COLLECTION_START: cfg.collection_start,
    EVENTS_DISCOVERED: store.events.length,
    QUOTE_OBSERVATIONS: store.quotes.length,
    STRICT_EVENTS: strictEvents,
    STRICT_QUOTES: strictQuotes.length,
    EXACT_KICKOFFS: exactKickoffs,
    T72_COVERAGE: eventCoverageRate(store, "T-72h"),
    T24_COVERAGE: eventCoverageRate(store, "T-24h"),
    T1H_COVERAGE: eventCoverageRate(store, "T-1h"),
    T5M_COVERAGE: eventCoverageRate(store, "T-5m"),
    LOCKED_DECISIONS: store.decisions.filter((d) => d.state === "LOCKED").length,
    SETTLED_EVENTS: 0,
    MODEL_READY: false,
    TEST_EVENTS: 0,
    HOLDOUT_EVENTS: 0,
    EDGE: false,
    BETS: 0,
    BANKROLL: "—",
    winner: null,
    auto_promotion: false,
    real_money: false,
    markets: [...new Set(store.quotes.map((q) => q.market))].sort(),
    bookmakers: [...new Set(store.quotes.map((q) => q.bookmaker))].sort(),
    MARKET_BRIER: null,
    BEST_MODEL_BRIER: null,
    DELTA_BRIER: null,
    SIGNIFICANCE: null,
    CAPITAL_GATE: "CLOSED",
    OBSERVATION_ONLY: true,
    verdict,
    FINAL_VERDICT: verdict,
    blocker,
    health,
    historical: { dataset: "TASK_031_BASE", strict_events: 10499, holdout_2020: 0 },
    leakage,
    leakage_status: "PASS",
    reproducibility: "NOT_RUN",
    experiment_sha256: experimentSha036(),
    dataset_fingerprint: datasetFingerprint036(store),
    fingerprint: fp,
  };
}

export function loadTask036ReportForUi(): Task036Report | null {
  const p = join(process.cwd(), "artifacts", "task-036-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task036Report;
    if (raw.experiment_id !== "exp_036_prospective_collection") return null;
    return raw;
  } catch {
    return null;
  }
}

export async function loadOrRunTask036(): Promise<Task036Report> {
  return loadTask036ReportForUi() ?? runTask036({ livePull: false });
}

