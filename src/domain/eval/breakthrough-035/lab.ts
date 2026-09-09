import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { bestCandidate035, catalog035 } from "@/domain/eval/breakthrough-035/catalog";
import {
  assertHoldoutLocked035,
  assertNo036,
  assertNoModify031,
  assertTestLocked035,
  experimentSha035,
  loadExp035Config,
} from "@/domain/eval/breakthrough-035/config";
import { canEnterStrict035 } from "@/domain/eval/breakthrough-035/gate";
import { inventoryFilesystem035 } from "@/domain/eval/breakthrough-035/inventory";
import { runHostileBattery035 } from "@/domain/eval/breakthrough-035/leakage";
import { gateQuotes035, matchReport035 } from "@/domain/eval/breakthrough-035/matching";
import { loadAllNewQuotes035 } from "@/domain/eval/breakthrough-035/parsers";
import {
  FROZEN_031_SHA256_035,
  type AnnualRow035,
  type InventoryFile035,
  type LabVerdict035,
  type MatchReport035,
  type Probe035,
  type SourceRecord035,
} from "@/domain/eval/breakthrough-035/types";

export type Task035Report = {
  experiment_id: string;
  task: "035";
  fixture_mode: boolean;
  observed_sha256: string;
  sources_investigated: number;
  sources_usable: number;
  new_sources: number;
  total_events: number;
  strict_events: number;
  strict_legacy_031: number;
  strict_2020_plus: number;
  exact_quote_timestamps: number;
  exact_kickoffs: number;
  match_exact: number;
  MODEL_READY: false;
  TEST_EVENTS: 0;
  HOLDOUT_EVENTS: 0;
  MARKET_BRIER: null;
  BEST_MODEL: null;
  BEST_MODEL_BRIER: null;
  DELTA_BRIER: null;
  CI95: null;
  HOLM: null;
  SIGNIFICANT: false;
  BETS: 0;
  BANKROLL: "—";
  ROI: null;
  MAX_DD: null;
  winner: null;
  auto_promotion: false;
  real_money: false;
  HOLDOUT_STATUS: "EMPTY";
  holdout_2020_plus: 0;
  test_used_for_selection: false;
  HOLDOUT_TOUCHED: false;
  qualified: false;
  CAPITAL_QUALIFIED: false;
  verdict: LabVerdict035;
  best_candidate_id: string;
  best_candidate_why: string;
  matching: MatchReport035;
  class_counts: Record<string, number>;
  catalog: SourceRecord035[];
  inventory: InventoryFile035[];
  roots_missing: string[];
  probes: Probe035[];
  annual: AnnualRow035[];
  leakage: { id: string; throws: boolean }[];
  experiment_sha256: string;
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  leakage_status: "PASS" | "FAIL";
  FINAL_VERDICT: LabVerdict035;
  fingerprint: string;
};

export function verdict035(input: {
  newStrict: number;
  newStrict2020: number;
  holdoutN: number;
  testN: number;
  multiYear: boolean;
  modelBeatsAllGates: boolean;
}): LabVerdict035 {
  if (input.newStrict >= 100 && input.testN >= 100 && input.holdoutN >= 100 && input.multiYear) {
    if (input.modelBeatsAllGates) return "MODEL_EDGE_DETECTED";
    return "DATA_BREAKTHROUGH_NO_EDGE";
  }
  if (input.newStrict >= 500 && input.newStrict2020 >= 100 && input.holdoutN >= 100 && input.multiYear) {
    return "DATA_BREAKTHROUGH";
  }
  return "INSUFFICIENT_DATA_FINAL";
}

export function fingerprint035(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function annual035(yearCounts: { y2015: number; y2016: number }, fixture: boolean): AnnualRow035[] {
  const years: AnnualRow035[] = [
    {
      year_label: "2001–2014",
      signal: "none",
      n: 0,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      status: "INSUFFICIENT_DATA",
    },
    {
      year_label: "2015",
      signal: "LEGACY_031",
      n: fixture ? 0 : yearCounts.y2015,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      status: "LEGACY_NO_HOLDOUT",
    },
    {
      year_label: "2016",
      signal: "LEGACY_031",
      n: fixture ? 0 : yearCounts.y2016,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      status: "LEGACY_NO_HOLDOUT",
    },
  ];
  for (const y of ["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"]) {
    years.push({
      year_label: y,
      signal: "none",
      n: 0,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      status: "INSUFFICIENT_DATA",
    });
  }
  years.push({
    year_label: "2026 YTD",
    signal: "none",
    n: 0,
    bets: 0,
    start: 1000,
    end: null,
    pnl: null,
    roi: null,
    max_dd: null,
    status: "INCOMPLETE_YEAR",
  });
  return years;
}

function loadProbes(): Probe035[] {
  const p = join(process.cwd(), "artifacts", "task-035", "probes.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Probe035[];
  } catch {
    return [];
  }
}

export async function runTask035(input: { skipHeavy?: boolean }): Promise<Task035Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp035Config();
  assertTestLocked035(false);
  assertHoldoutLocked035(false);
  assertNo036(cfg.open_task_036);
  assertNoModify031(cfg.modify_frozen_031);
  const { freeze, events } = freezeStrict027({ skipHeavy });
  if (!skipHeavy && !freeze.fixture && freeze.sha256 !== FROZEN_031_SHA256_035) {
    throw new ExperimentIntegrityError(`TASK 031 SHA mismatch ${freeze.sha256}`);
  }

  const quotes = loadAllNewQuotes035({ skipHeavy });
  const gated = gateQuotes035(quotes);
  const matching = matchReport035(gated);
  const class_counts: Record<string, number> = {};
  const eventClass = new Map<string, string>();
  for (const q of gated) {
    class_counts[q.temporal_class] = (class_counts[q.temporal_class] ?? 0) + 1;
    if (!eventClass.has(q.event_id)) eventClass.set(q.event_id, q.temporal_class);
  }

  let newStrict = 0;
  let newStrict2020 = 0;
  let exactQuote = 0;
  let exactKick = 0;
  const seenEvent = new Set<string>();
  for (const q of gated) {
    if (q.quote_has_offset && q.quote_timestamp) exactQuote += 1;
    if (q.kickoff_has_offset && q.kickoff_timestamp) exactKick += 1;
    if (seenEvent.has(q.event_id)) continue;
    seenEvent.add(q.event_id);
    if (canEnterStrict035({ temporal_class: q.temporal_class, match_grade: q.match_grade, quote: q })) {
      newStrict += 1;
      const y = Number((q.kickoff_timestamp ?? "").slice(0, 4));
      if (y >= 2020) newStrict2020 += 1;
    }
  }

  const catalog = [...catalog035()];
  const sources_usable = catalog.filter((s) => s.access === "LOCAL" || s.access === "PUBLIC_DOWNLOAD" || s.access === "SAMPLE_ONLY" || s.access === "MIRROR").length;
  const new_sources = catalog.filter((s) => s.new_source).length;
  const best = bestCandidate035();

  const inv = await inventoryFilesystem035({
    hashMaxBytes: skipHeavy ? 2_000_000 : 40_000_000,
    skipHeavy,
  });

  const leakage = runHostileBattery035();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }

  const verdict = verdict035({
    newStrict,
    newStrict2020,
    holdoutN: 0,
    testN: 0,
    multiYear: false,
    modelBeatsAllGates: false,
  });

  const fp = fingerprint035({
    verdict,
    newStrict,
    newStrict2020,
    legacy: freeze.sha256,
    exp: experimentSha035(),
    investigated: catalog.length,
    usable: sources_usable,
    test: 0,
    holdout: 0,
    bets: 0,
    winner: null,
    match_exact: matching.exact,
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "035",
    fixture_mode: freeze.fixture,
    observed_sha256: freeze.sha256,
    sources_investigated: catalog.length,
    sources_usable,
    new_sources,
    total_events: seenEvent.size + (freeze.fixture ? 0 : events.length),
    strict_events: newStrict,
    strict_legacy_031: freeze.fixture ? 0 : events.length,
    strict_2020_plus: newStrict2020,
    exact_quote_timestamps: exactQuote,
    exact_kickoffs: exactKick,
    match_exact: matching.exact,
    MODEL_READY: false,
    TEST_EVENTS: 0,
    HOLDOUT_EVENTS: 0,
    MARKET_BRIER: null,
    BEST_MODEL: null,
    BEST_MODEL_BRIER: null,
    DELTA_BRIER: null,
    CI95: null,
    HOLM: null,
    SIGNIFICANT: false,
    BETS: 0,
    BANKROLL: "—",
    ROI: null,
    MAX_DD: null,
    winner: null,
    auto_promotion: false,
    real_money: false,
    HOLDOUT_STATUS: "EMPTY",
    holdout_2020_plus: 0,
    test_used_for_selection: false,
    HOLDOUT_TOUCHED: false,
    qualified: false,
    CAPITAL_QUALIFIED: false,
    verdict,
    best_candidate_id: best.id,
    best_candidate_why: `${best.title}. ${best.why_not_strict}`,
    matching,
    class_counts,
    catalog,
    inventory: inv.files,
    roots_missing: inv.roots_missing,
    probes: skipHeavy ? [] : loadProbes(),
    annual: annual035(
      {
        y2015: events.filter((e) => e.kickoff.startsWith("2015")).length,
        y2016: events.filter((e) => e.kickoff.startsWith("2016")).length,
      },
      freeze.fixture,
    ),
    leakage,
    experiment_sha256: experimentSha035(),
    reproducibility: "NOT_RUN",
    leakage_status: "PASS",
    FINAL_VERDICT: verdict,
    fingerprint: fp,
  };
}

export function loadTask035ReportForUi(): Task035Report | null {
  const p = join(process.cwd(), "artifacts", "task-035-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task035Report;
    if (raw.experiment_id !== "exp_035_data_breakthrough") return null;
    return raw;
  } catch {
    return null;
  }
}

export async function loadOrRunTask035(): Promise<Task035Report> {
  return loadTask035ReportForUi() ?? runTask035({ skipHeavy: true });
}

export function printVerdictBlock035(r: Task035Report): string {
  return [
    "TASK 035 VERDICT:",
    `DATASET: ${r.experiment_id}`,
    `TOTAL SOURCES INVESTIGATED: ${r.sources_investigated}`,
    `NEW SOURCES: ${r.new_sources}`,
    `TOTAL EVENTS: ${r.total_events}`,
    `STRICT EVENTS: ${r.strict_events}`,
    `STRICT 2020+ EVENTS: ${r.strict_2020_plus}`,
    `EXACT QUOTE TIMESTAMPS: ${r.exact_quote_timestamps}`,
    `EXACT KICKOFFS: ${r.exact_kickoffs}`,
    `MATCH_EXACT: ${r.match_exact}`,
    `MODEL_READY: ${r.MODEL_READY}`,
    `TEST_EVENTS: ${r.TEST_EVENTS}`,
    `HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    `MARKET_BRIER: ${r.MARKET_BRIER ?? "—"}`,
    `BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `BEST_MODEL_BRIER: ${r.BEST_MODEL_BRIER ?? "—"}`,
    `DELTA_BRIER: ${r.DELTA_BRIER ?? "—"}`,
    `95_CI: ${r.CI95 ?? "—"}`,
    `HOLM: ${r.HOLM ?? "—"}`,
    `SIGNIFICANT: ${r.SIGNIFICANT}`,
    `BETS: ${r.BETS}`,
    `BANKROLL: ${r.BANKROLL}`,
    `ROI: ${r.ROI ?? "—"}`,
    `MAX_DD: ${r.MAX_DD ?? "—"}`,
    `WINNER: ${r.winner}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REAL_MONEY: ${r.real_money}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `LEAKAGE: ${r.leakage_status}`,
    `FINAL_VERDICT: ${r.FINAL_VERDICT}`,
  ].join("\n");
}
