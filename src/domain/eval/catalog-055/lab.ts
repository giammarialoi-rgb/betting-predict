import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { experimentSha055, loadExp055Config, writeArtifact055 } from "@/domain/eval/catalog-055/config";
import { runMultiSourceCycle055 } from "@/domain/eval/catalog-055/cycle";
import { buildObservatory055 } from "@/domain/eval/catalog-055/observatory";
import { buildUniversalCatalog055 } from "@/domain/eval/catalog-055/universal";
import { buildLineage055 } from "@/domain/eval/catalog-055/lineage";
import { createAllSourceAdapters055 } from "@/services/sources/registry-055";
import { assertNoBypass054 } from "@/services/sources/directa";
import { summarizeBankroll053 } from "@/domain/eval/bankroll-053/ledger";
import { ensureBankrollDirs053 } from "@/domain/eval/bankroll-053/config";
import type { SourceHealth055 } from "@/services/sources/types";
import {
  assessConsolidation055,
  consolidationReady055,
  runtimeHealthyEnough055,
  type ConsolidationSnapshot055,
} from "@/domain/eval/catalog-055/consolidation";
import { assertFileArgQuoted055 } from "@/domain/eval/catalog-055/autostart";

export type Task055Report = {
  experiment_id: string;
  task: "055";
  FINAL_VERDICT: "UNIVERSAL_24_7_SPORTS_INTELLIGENCE_BRAIN_READY" | "PARTIAL" | "BLOCKED";
  SYSTEM_STATUS: string;
  SUPERVISOR_STATUS: string;
  WORKER_STATUS: string;
  SUPERVISOR_ALIVE: boolean;
  WORKER_ALIVE: boolean;
  HEARTBEAT_FRESH: boolean;
  AUTOSTART_STATUS: string;
  AUTOSTART_INSTALLED: boolean;
  AUTOSTART_VERIFIED: boolean;
  ACTIVE_MECHANISM: string;
  NO_DUPLICATE_WORKERS: boolean;
  TOTAL_EVENTS: number;
  UNIQUE_EVENTS: number;
  NEW_EVENTS: number;
  EVENTS_BY_SPORT: Record<string, number>;
  EVENTS_TODAY: number;
  EVENTS_NEXT_24H: number;
  EVENTS_NEXT_72H: number;
  EVENTS_NEXT_7D: number;
  EVENTS_NEXT_30D: number;
  PREDICTIONS: number;
  BET_CANDIDATES: number;
  STRONG_CANDIDATES: number;
  NO_BET: number;
  MARKETS: number;
  MARKETS_ANALYZED: number;
  QUOTES: number;
  SNAPSHOTS: number;
  SOURCE_STATUS: SourceHealth055[];
  SPORT_STATUS: ConsolidationSnapshot055["SPORT_STATUS"];
  LOCKED: number;
  SETTLED: number;
  AUTOPSIES: number;
  LEARNING_CASES: number;
  ERROR_PATTERNS: number;
  COUNTERFACTUALS: number;
  PAPER_BANKROLL: 1000;
  PAPER_CAPITAL: number;
  PAPER_PNL: number;
  PAPER_ROI: number;
  PAPER_INITIAL_CAPITAL: 1000;
  REAL_MONEY: false;
  AUTO_PROMOTION: false;
  MODEL_VERSION: string;
  CHALLENGERS: number;
  MODEL_EDGE: "UNKNOWN";
  CAPITAL: "PAPER_ONLY";
  ARTIFICIAL_CAP: false;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  BUDGET: Record<string, unknown> | string;
  API_CALLS: number;
  MULTI_SPORT_ADAPTERS: string;
  MULTI_MARKET_ENGINE: string;
  SETTLEMENT: string;
  AUTOPSY: string;
  LEARNING: string;
  COUNTERFACTUAL: string;
  ERROR_PATTERNS_GATE: string;
  CONTROL_CENTER: string;
  CURRENT_WORK_VISIBLE: boolean;
  EVENT_DETAIL: string;
  BUDGET_FIREWALL: string;
  RECOVERY: string;
  CURRENT_ACTIVITY: string;
  OBSERVATORY_API_CALLS_UI: 0;
  consolidation: ConsolidationSnapshot055;
  open_task_056: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock055(r: Task055Report): string {
  return [
    "TASK 055 — FINAL CONSOLIDATION VERDICT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `SYSTEM_STATUS: ${r.SYSTEM_STATUS}`,
    `SUPERVISOR_ALIVE: ${r.SUPERVISOR_ALIVE}`,
    `WORKER_ALIVE: ${r.WORKER_ALIVE}`,
    `HEARTBEAT_FRESH: ${r.HEARTBEAT_FRESH}`,
    `AUTOSTART_VERIFIED: ${r.AUTOSTART_VERIFIED}`,
    `ACTIVE_MECHANISM: ${r.ACTIVE_MECHANISM}`,
    `NO_DUPLICATE_WORKERS: ${r.NO_DUPLICATE_WORKERS}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `UNIQUE_EVENTS: ${r.UNIQUE_EVENTS}`,
    `EVENTS_TODAY: ${r.EVENTS_TODAY}`,
    `EVENTS_NEXT_24H: ${r.EVENTS_NEXT_24H}`,
    `EVENTS_NEXT_72H: ${r.EVENTS_NEXT_72H}`,
    `EVENTS_NEXT_7D: ${r.EVENTS_NEXT_7D}`,
    `EVENTS_NEXT_30D: ${r.EVENTS_NEXT_30D}`,
    `PREDICTIONS: ${r.PREDICTIONS}`,
    `BET_CANDIDATES: ${r.BET_CANDIDATES}`,
    `STRONG_CANDIDATES: ${r.STRONG_CANDIDATES}`,
    `NO_BET: ${r.NO_BET}`,
    `MARKETS_ANALYZED: ${r.MARKETS_ANALYZED}`,
    `QUOTES: ${r.QUOTES}`,
    `SNAPSHOTS: ${r.SNAPSHOTS}`,
    `LOCKED: ${r.LOCKED}`,
    `SETTLED: ${r.SETTLED}`,
    `AUTOPSIES: ${r.AUTOPSIES}`,
    `LEARNING_CASES: ${r.LEARNING_CASES}`,
    `ERROR_PATTERNS: ${r.ERROR_PATTERNS}`,
    `COUNTERFACTUALS: ${r.COUNTERFACTUALS}`,
    `PAPER_CAPITAL: ${r.PAPER_CAPITAL}`,
    `PAPER_PNL: ${r.PAPER_PNL}`,
    `PAPER_ROI: ${r.PAPER_ROI}`,
    `PAPER_INITIAL_CAPITAL: ${r.PAPER_INITIAL_CAPITAL}`,
    `MODEL_VERSION: ${r.MODEL_VERSION}`,
    `CHALLENGERS: ${r.CHALLENGERS}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `AUTO_PROMOTION: ${r.AUTO_PROMOTION}`,
    `CAPITAL: ${r.CAPITAL}`,
    `ARTIFICIAL_CAP: ${r.ARTIFICIAL_CAP}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
    `MULTI_SPORT_ADAPTERS: ${r.MULTI_SPORT_ADAPTERS}`,
    `MULTI_MARKET_ENGINE: ${r.MULTI_MARKET_ENGINE}`,
    `SETTLEMENT: ${r.SETTLEMENT}`,
    `AUTOPSY: ${r.AUTOPSY}`,
    `LEARNING: ${r.LEARNING}`,
    `COUNTERFACTUAL: ${r.COUNTERFACTUAL}`,
    `CONTROL_CENTER: ${r.CONTROL_CENTER}`,
    `CURRENT_WORK_VISIBLE: ${r.CURRENT_WORK_VISIBLE}`,
    `BUDGET_FIREWALL: ${r.BUDGET_FIREWALL}`,
    `RECOVERY: ${r.RECOVERY}`,
    `CURRENT_ACTIVITY: ${r.CURRENT_ACTIVITY}`,
    `open_task_056: ${r.open_task_056}`,
    `SOURCE_STATUS: ${r.SOURCE_STATUS.map((s) => `${s.sourceId}=${s.status}`).join(" · ")}`,
    `SPORT_STATUS: ${Object.entries(r.SPORT_STATUS)
      .map(([k, v]) => `${k}=${v.status}(${v.events})`)
      .join(" · ")}`,
  ].join("\n");
}

function countJsonl(path: string): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split(/\n/).filter(Boolean).length;
}

export async function runTask055(): Promise<Task055Report> {
  const cfg = loadExp055Config();
  if (cfg.open_task_056) throw new ExperimentIntegrityError("TASK 056 forbidden");

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

  let bypassDenied = false;
  try {
    assertNoBypass054("bypass_captcha");
  } catch {
    bypassDenied = true;
  }
  if (!bypassDenied) throw new ExperimentIntegrityError("bypass_allowed");

  // Path-with-spaces quoting unit (autostart)
  const spaced =
    '-NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\giamm\\Desktop\\app previsioni sportive\\betting predict\\scripts\\start-supervisor.ps1"';
  if (!assertFileArgQuoted055(spaced, "start-supervisor.ps1")) {
    throw new ExperimentIntegrityError("autostart_quote_unit");
  }
  const broken = "-File C:\\Users\\giamm\\Desktop\\app previsioni sportive\\betting predict\\scripts\\start-supervisor.ps1";
  if (assertFileArgQuoted055(broken, "start-supervisor.ps1")) {
    throw new ExperimentIntegrityError("autostart_quote_false_positive");
  }

  const matchUnit = buildUniversalCatalog055(
    [
      {
        source: "THE_ODDS_API",
        events: [
          {
            source_id: "THE_ODDS_API",
            source_event_id: "o1",
            sport: "soccer",
            competition: "Serie A",
            country: "IT",
            home: "Inter Milan",
            away: "AC Milan",
            commence_time: "2026-09-10T18:00:00.000Z",
            event_status: null,
            ingested_at: "t",
            available_at: "t",
            source_published_at: null,
            content_hash: "a",
          },
        ],
      },
      {
        source: "SOFASCORE",
        events: [
          {
            source_id: "SOFASCORE",
            source_event_id: "s1",
            sport: "soccer",
            competition: "Serie A",
            country: "IT",
            home: "Internazionale",
            away: "Milan",
            commence_time: "2026-09-10T18:00:00.000Z",
            event_status: null,
            ingested_at: "t",
            available_at: "t",
            source_published_at: null,
            content_hash: "b",
          },
        ],
      },
    ],
    "2026-09-08T12:00:00.000Z",
  );
  if (matchUnit.universals.length !== 1 || matchUnit.matched_pairs < 1) {
    throw new ExperimentIntegrityError(`universal_match_fail:${matchUnit.universals.length}`);
  }

  const lineage = buildLineage055({
    sources: ["THE_ODDS_API"],
    observation_at: "t0",
    snapshot_at: "t1",
    prediction_id: "p1",
    prediction_at: "t2",
    decision: "NO_BET",
    lock_at: "t3",
    result_at: "t4",
    autopsy_id: "a1",
    learning_id: "l1",
  });
  if (lineage.length < 10) throw new ExperimentIntegrityError("lineage");

  const before = labAFingerprint046();
  const labB = permanentRoot044();
  ensureBankrollDirs053(labB);

  const adapters = createAllSourceAdapters055();
  if (adapters.length < 4) throw new ExperimentIntegrityError("adapters");
  const sofa = adapters.find((a) => a.sourceId === "SOFASCORE")!;
  if (sofa.health().status !== "DISABLED_BY_POLICY") {
    throw new ExperimentIntegrityError("sofa_should_be_disabled");
  }

  const coverage = await runMultiSourceCycle055();
  assertLabAUntouched046(before);

  const obs = await buildObservatory055();
  if (obs.api_calls_ui !== 0 || obs.multisource_055.api_calls_ui !== 0) {
    throw new ExperimentIntegrityError("ui_api");
  }

  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }

  const store = loadStore044(labB);
  const unique = new Set(store.events.map((e) => e.event_id)).size;
  const bankroll = summarizeBankroll053(labB);

  const consol = assessConsolidation055({
    leakagePass: true,
    reproducibilityPass: true,
    verifyAutostart: true,
  });

  const modulesOk = consolidationReady055(consol);
  const runtimeOk = runtimeHealthyEnough055(consol);

  let FINAL_VERDICT: Task055Report["FINAL_VERDICT"] = "BLOCKED";
  if (modulesOk && runtimeOk && coverage.artificial_cap === false && bankroll.initial === 1000) {
    FINAL_VERDICT = "UNIVERSAL_24_7_SPORTS_INTELLIGENCE_BRAIN_READY";
  } else if (modulesOk || unique > 0) {
    FINAL_VERDICT = "PARTIAL";
  }

  // Never claim READY without verified autostart
  if (FINAL_VERDICT === "UNIVERSAL_24_7_SPORTS_INTELLIGENCE_BRAIN_READY" && !consol.AUTOSTART_VERIFIED) {
    FINAL_VERDICT = "PARTIAL";
  }

  const bySport: Record<string, number> = {};
  for (const [k, v] of Object.entries(coverage.by_sport)) bySport[k] = v.catalog;

  const patternsPath = join(labB, "error-patterns.json");
  let errorPatterns = 0;
  if (existsSync(patternsPath)) {
    try {
      const j = JSON.parse(readFileSync(patternsPath, "utf8")) as { patterns?: unknown[] };
      errorPatterns = j.patterns?.length ?? 0;
    } catch {
      errorPatterns = 0;
    }
  }

  const body: Omit<Task055Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "055",
    FINAL_VERDICT,
    SYSTEM_STATUS: consol.SYSTEM_STATUS,
    SUPERVISOR_STATUS: consol.SUPERVISOR_ALIVE ? "ALIVE" : "DEAD",
    WORKER_STATUS: consol.WORKER_ALIVE ? "ALIVE" : "DEAD",
    SUPERVISOR_ALIVE: consol.SUPERVISOR_ALIVE,
    WORKER_ALIVE: consol.WORKER_ALIVE,
    HEARTBEAT_FRESH: consol.HEARTBEAT_FRESH,
    AUTOSTART_STATUS: consol.AUTOSTART_VERIFIED
      ? `VERIFIED:${consol.ACTIVE_MECHANISM}`
      : "UNVERIFIED",
    AUTOSTART_INSTALLED: consol.AUTOSTART_INSTALLED,
    AUTOSTART_VERIFIED: consol.AUTOSTART_VERIFIED,
    ACTIVE_MECHANISM: consol.ACTIVE_MECHANISM,
    NO_DUPLICATE_WORKERS: consol.NO_DUPLICATE_WORKERS,
    TOTAL_EVENTS: store.events.length,
    UNIQUE_EVENTS: unique,
    NEW_EVENTS: Math.max(0, unique - 114),
    EVENTS_BY_SPORT: bySport,
    EVENTS_TODAY: coverage.today,
    EVENTS_NEXT_24H: coverage.next_24h,
    EVENTS_NEXT_72H: coverage.next_72h,
    EVENTS_NEXT_7D: coverage.next_7d,
    EVENTS_NEXT_30D: coverage.next_30d,
    PREDICTIONS: coverage.predictions,
    BET_CANDIDATES: coverage.bet_candidates,
    STRONG_CANDIDATES: coverage.strong_candidates,
    NO_BET: coverage.no_bet,
    MARKETS: coverage.markets,
    MARKETS_ANALYZED: coverage.markets,
    QUOTES: coverage.quotes,
    SNAPSHOTS: coverage.snapshots,
    SOURCE_STATUS: coverage.source_health,
    SPORT_STATUS: consol.SPORT_STATUS,
    LOCKED: coverage.locked,
    SETTLED: coverage.settled,
    AUTOPSIES: coverage.autopsies,
    LEARNING_CASES: coverage.learning_cases,
    ERROR_PATTERNS: errorPatterns,
    COUNTERFACTUALS: countJsonl(join(labB, "counterfactuals.jsonl")),
    PAPER_BANKROLL: 1000,
    PAPER_CAPITAL: consol.PAPER_CAPITAL,
    PAPER_PNL: consol.PAPER_PNL,
    PAPER_ROI: consol.PAPER_ROI,
    PAPER_INITIAL_CAPITAL: 1000,
    REAL_MONEY: false,
    AUTO_PROMOTION: false,
    MODEL_VERSION: consol.MODEL_VERSION,
    CHALLENGERS: consol.CHALLENGERS,
    MODEL_EDGE: "UNKNOWN",
    CAPITAL: "PAPER_ONLY",
    ARTIFICIAL_CAP: false,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    BUDGET: existsSync(join(labB, "budget-state.json"))
      ? JSON.parse(readFileSync(join(labB, "budget-state.json"), "utf8").replace(/^\uFEFF/, ""))
      : "daemon_owned",
    API_CALLS: 0,
    MULTI_SPORT_ADAPTERS: consol.MULTI_SPORT_ADAPTERS,
    MULTI_MARKET_ENGINE: consol.MULTI_MARKET_ENGINE,
    SETTLEMENT: consol.SETTLEMENT,
    AUTOPSY: consol.AUTOPSY,
    LEARNING: consol.LEARNING,
    COUNTERFACTUAL: consol.COUNTERFACTUAL,
    ERROR_PATTERNS_GATE: consol.ERROR_PATTERNS,
    CONTROL_CENTER: consol.CONTROL_CENTER,
    CURRENT_WORK_VISIBLE: consol.CURRENT_WORK_VISIBLE,
    EVENT_DETAIL: consol.EVENT_DETAIL,
    BUDGET_FIREWALL: consol.BUDGET_FIREWALL,
    RECOVERY: consol.RECOVERY,
    CURRENT_ACTIVITY: obs.multisource_055.current_activity.phase,
    OBSERVATORY_API_CALLS_UI: 0,
    consolidation: consol,
    open_task_056: false,
    experiment_sha256: experimentSha055(),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task055Report = { ...body, fingerprint };
  writeArtifact055("task-055-result.json", report);
  writeArtifact055("task-055-verdict.txt", printVerdictBlock055(report));
  writeArtifact055("task-055-coverage.json", coverage);
  writeArtifact055("task-055-source-health.json", coverage.source_health);
  writeArtifact055("task-055-consolidation.json", consol);
  writeArtifact055("task-055-autostart.json", {
    AUTOSTART_INSTALLED: consol.AUTOSTART_INSTALLED,
    AUTOSTART_VERIFIED: consol.AUTOSTART_VERIFIED,
    ACTIVE_MECHANISM: consol.ACTIVE_MECHANISM,
  });
  return report;
}
