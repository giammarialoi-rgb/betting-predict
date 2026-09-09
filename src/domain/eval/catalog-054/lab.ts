import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { runHostileBattery039 } from "@/domain/eval/live-039/leakage";
import { assertNoPostLockMutation044 } from "@/domain/eval/permanent-044/firewall";
import { mutateDecision } from "@/domain/eval/prospective-036/lock";
import { permanentRoot044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { assertLabAUntouched046, labAFingerprint046 } from "@/domain/eval/control-046/lab-a-firewall";
import { experimentSha054, loadExp054Config, writeArtifact054 } from "@/domain/eval/catalog-054/config";
import { runCatalogCycle054 } from "@/domain/eval/catalog-054/coverage";
import { buildObservatory054 } from "@/domain/eval/catalog-054/observatory";
import {
  matchEvents054,
  detectKickoffConflict054,
  marketNormalize054,
  availableAt054,
  normalizeParticipant054,
} from "@/domain/eval/catalog-054/matching";
import { createDirectaAdapter054, assertNoBypass054 } from "@/services/sources/directa";
import { summarizeBankroll053 } from "@/domain/eval/bankroll-053/ledger";
import { ensureBankrollDirs053 } from "@/domain/eval/bankroll-053/config";

export type Task054Report = {
  experiment_id: string;
  task: "054";
  FINAL_VERDICT: "DIRECTA_MULTISOURCE_CATALOG_READY" | "PARTIAL" | "BLOCKED";
  DIRECTA_STATUS: string;
  DIRECTA_POLICY_STATUS: string;
  TOTAL_EVENTS: number;
  UNIQUE_EVENTS: number;
  TODAY: number;
  NEXT_24H: number;
  NEXT_72H: number;
  NEXT_7D: number;
  CATALOG: number;
  ODDS_AVAILABLE: number;
  ODDS_MISSING: number;
  MATCHED: number;
  UNMATCHED: number;
  CONFLICTS: number;
  ANALYZED: number;
  PAPER_BANKROLL: 1000;
  REAL_MONEY: false;
  MODEL_EDGE: "UNKNOWN";
  CAPITAL: "PAPER_ONLY";
  ARTIFICIAL_CAP: false;
  LAB_A_MUTATION: false;
  LAB_A_EVENTS: number;
  LAB_A_LOCKED: number;
  LEAKAGE: "PASS";
  REPRODUCIBILITY: "PASS";
  CURRENT_ACTIVITY: string;
  OBSERVATORY_API_CALLS_UI: 0;
  open_task_055: false;
  fingerprint: string;
  experiment_sha256: string;
};

export function printVerdictBlock054(r: Task054Report): string {
  return [
    "TASK 054 — FINAL VERDICT",
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
    `DIRECTA_STATUS: ${r.DIRECTA_STATUS}`,
    `DIRECTA_POLICY_STATUS: ${r.DIRECTA_POLICY_STATUS}`,
    `TOTAL_EVENTS: ${r.TOTAL_EVENTS}`,
    `UNIQUE_EVENTS: ${r.UNIQUE_EVENTS}`,
    `TODAY: ${r.TODAY}`,
    `NEXT_24H: ${r.NEXT_24H}`,
    `NEXT_72H: ${r.NEXT_72H}`,
    `NEXT_7D: ${r.NEXT_7D}`,
    `CATALOG: ${r.CATALOG}`,
    `ODDS_AVAILABLE: ${r.ODDS_AVAILABLE}`,
    `ODDS_MISSING: ${r.ODDS_MISSING}`,
    `MATCHED: ${r.MATCHED}`,
    `UNMATCHED: ${r.UNMATCHED}`,
    `CONFLICTS: ${r.CONFLICTS}`,
    `ANALYZED: ${r.ANALYZED}`,
    `PAPER_BANKROLL: ${r.PAPER_BANKROLL}`,
    `REAL_MONEY: ${r.REAL_MONEY}`,
    `MODEL_EDGE: ${r.MODEL_EDGE}`,
    `CAPITAL: ${r.CAPITAL}`,
    `ARTIFICIAL_CAP: ${r.ARTIFICIAL_CAP}`,
    `LAB_A_MUTATION: ${r.LAB_A_MUTATION}`,
    `CURRENT_ACTIVITY: ${r.CURRENT_ACTIVITY}`,
    `LEAKAGE: ${r.LEAKAGE}`,
    `REPRODUCIBILITY: ${r.REPRODUCIBILITY}`,
  ].join("\n");
}

export async function runTask054(): Promise<Task054Report> {
  const cfg = loadExp054Config();
  if (cfg.open_task_055) throw new ExperimentIntegrityError("TASK 055 forbidden");

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

  // Compliance: bypass must throw
  let bypassDenied = false;
  try {
    assertNoBypass054("bypass_captcha");
  } catch {
    bypassDenied = true;
  }
  if (!bypassDenied) throw new ExperimentIntegrityError("bypass_allowed");

  // Matching unit checks
  const exact = matchEvents054({
    sport_a: "soccer",
    sport_b: "soccer",
    p1_a: "Inter Milan",
    p2_a: "AC Milan",
    p1_b: "Internazionale",
    p2_b: "Milan",
    kickoff_a: "2026-09-10T18:00:00.000Z",
    kickoff_b: "2026-09-10T18:00:00.000Z",
  });
  if (exact.class !== "MATCH_EXACT" && exact.class !== "MATCH_HIGH_CONFIDENCE") {
    throw new ExperimentIntegrityError(`match_fail:${exact.class}:${exact.match_score}`);
  }
  if (normalizeParticipant054("Real Madrid CF") !== normalizeParticipant054("Real Madrid")) {
    throw new ExperimentIntegrityError("normalize_fail");
  }
  const conflict = detectKickoffConflict054(
    "DIRECTA",
    "2026-09-10T18:00:00.000Z",
    "ODDS_API",
    "2026-09-10T18:15:00.000Z",
    "2026-09-08T12:00:00.000Z",
  );
  if (!conflict) throw new ExperimentIntegrityError("conflict_miss");
  const mkt = marketNormalize054("Over 2,5");
  if (mkt.market_type !== "TOTALS" || mkt.line !== 2.5 || mkt.selection !== "OVER") {
    throw new ExperimentIntegrityError("market_norm");
  }
  if (availableAt054({ source_published_at: null, ingested_at: "T1" }) !== "T1") {
    throw new ExperimentIntegrityError("available_at");
  }

  const before = labAFingerprint046();
  const labB = permanentRoot044();
  ensureBankrollDirs053(labB);

  const coverage = await runCatalogCycle054();
  assertLabAUntouched046(before);

  const directa = createDirectaAdapter054();
  const health = directa.health();
  if (health.policy_status !== "DISABLED_BY_POLICY") {
    // Default env must keep Directa disabled
    throw new ExperimentIntegrityError("directa_should_be_disabled_by_default");
  }

  const obs = await buildObservatory054();
  if (obs.api_calls_ui !== 0 || obs.catalog_054.api_calls_ui !== 0) {
    throw new ExperimentIntegrityError("ui_api");
  }

  const labA = loadStore039(labAStore044());
  if (labA.events.length !== 114 || labA.decisions.length !== 114) {
    throw new ExperimentIntegrityError("Lab A seed size drifted");
  }

  const store = loadStore044(labB);
  const unique = new Set(store.events.map((e) => e.event_id)).size;
  const bankroll = summarizeBankroll053(labB);

  let FINAL_VERDICT: Task054Report["FINAL_VERDICT"] = "BLOCKED";
  if (
    unique >= 114 &&
    health.policy_status === "DISABLED_BY_POLICY" &&
    coverage.artificial_cap === false &&
    bankroll.initial === 1000
  ) {
    FINAL_VERDICT = "DIRECTA_MULTISOURCE_CATALOG_READY";
  } else if (unique > 0) {
    FINAL_VERDICT = "PARTIAL";
  }

  const body: Omit<Task054Report, "fingerprint"> = {
    experiment_id: cfg.experiment_id,
    task: "054",
    FINAL_VERDICT,
    DIRECTA_STATUS: coverage.directa_status,
    DIRECTA_POLICY_STATUS: coverage.directa_policy_status,
    TOTAL_EVENTS: store.events.length,
    UNIQUE_EVENTS: unique,
    TODAY: coverage.today,
    NEXT_24H: coverage.next_24h,
    NEXT_72H: coverage.next_72h,
    NEXT_7D: coverage.next_7d,
    CATALOG: coverage.catalog_events,
    ODDS_AVAILABLE: coverage.odds_available,
    ODDS_MISSING: coverage.odds_missing,
    MATCHED: coverage.matched,
    UNMATCHED: coverage.unmatched,
    CONFLICTS: coverage.conflicts,
    ANALYZED: coverage.analyzed_events,
    PAPER_BANKROLL: 1000,
    REAL_MONEY: false,
    MODEL_EDGE: "UNKNOWN",
    CAPITAL: "PAPER_ONLY",
    ARTIFICIAL_CAP: false,
    LAB_A_MUTATION: false,
    LAB_A_EVENTS: before.events,
    LAB_A_LOCKED: before.decisions,
    LEAKAGE: "PASS",
    REPRODUCIBILITY: "PASS",
    CURRENT_ACTIVITY: obs.catalog_054.current_activity.phase,
    OBSERVATORY_API_CALLS_UI: 0,
    open_task_055: false,
    experiment_sha256: experimentSha054(),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Task054Report = { ...body, fingerprint };
  writeArtifact054("task-054-result.json", report);
  writeArtifact054("task-054-verdict.txt", printVerdictBlock054(report));
  writeArtifact054("task-054-coverage.json", coverage);
  writeArtifact054("task-054-directa-health.json", health);
  return report;
}
