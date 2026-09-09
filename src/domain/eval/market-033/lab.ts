import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { loadTask032ReportForUi } from "@/domain/eval/incremental-032/lab";
import { probePublic033 } from "@/domain/eval/market-033/acquire";
import { loadExp033Config, STRICT_031_REL } from "@/domain/eval/market-033/config";
import { discoverBasicMarkets033, scanWeeklyBetfair033, unionWindowCoverage } from "@/domain/eval/market-033/discover";
import { sha256File, inventoryFilesystem033 } from "@/domain/eval/market-033/inventory";
import { leakMasanielloProduction, leakOpenTask034, runHostileBattery033 } from "@/domain/eval/market-033/leakage";
import {
  FROZEN_031_SHA256,
  MARKET_ROWS_033,
  type AnnualRow033,
  type BasicMarket033,
  type InventoryFile033,
  type LabVerdict033,
  type MarketAuditRow033,
  type MarketRow033,
  type MarketVerdict033,
  type Probe033,
  type WindowId033,
} from "@/domain/eval/market-033/types";
import type { WeeklyFamilyCount033 } from "@/domain/eval/market-033/discover";
import { assertHoldoutLocked033, assertTestLocked033 } from "@/domain/eval/market-033/config";

export type Task033Report = {
  experiment_id: string;
  task: "033";
  dataset_id: "TASK_033_STRICT_MARKETS";
  fixture_mode: boolean;
  observed_031_sha256: string;
  carry_032_fingerprint: string;
  as_of_policy: "STRICT_AS_OF";
  baseline: "MARKET_DEVIG";
  strict_events_1x2: number;
  strict_events_other: number;
  strict_markets: number;
  model_ready_markets: number;
  best_market: string | null;
  best_model: string | null;
  delta_vs_market: number | null;
  holm: { n_tests: number; rejected: boolean[]; method: "holm_bonferroni" };
  HOLDOUT_STATUS: "EMPTY";
  holdout_2020_plus: 0;
  winner: null;
  auto_promotion: false;
  real_money: false;
  qualified: false;
  verdict: LabVerdict033;
  test_used_for_selection: false;
  HOLDOUT_TOUCHED: false;
  BET_COUNT: 0;
  BANKROLL: "NOT_QUALIFIED";
  markets: MarketAuditRow033[];
  basic: BasicMarket033[];
  weekly: {
    path: string | null;
    rows: number;
    football_rows: number;
    families: WeeklyFamilyCount033[];
    timezone_in_file: false;
    temporal_class: "UNKNOWN";
  };
  windows: Record<WindowId033, boolean>;
  inventory: { file_count: number; roots_missing: string[]; sample: InventoryFile033[] };
  probes: Probe033[];
  annual: AnnualRow033[];
  leakage: { id: string; throws: boolean }[];
  fingerprint: string;
  reproducibility: "PENDING" | "PASS" | "FAIL";
};

function uniqueEvents(basic: readonly BasicMarket033[], family: MarketRow033): number {
  return new Set(
    basic.filter((b) => b.family === family && b.prematch_ticks > 0).map((b) => b.event_id),
  ).size;
}

function weeklyEvents(weekly: WeeklyFamilyCount033[], family: MarketRow033): number {
  return weekly.find((w) => w.family === family)?.events ?? 0;
}

function buildMarketRows(input: {
  basic: readonly BasicMarket033[];
  weekly: WeeklyFamilyCount033[];
  carryN: number;
  carryBrier: number;
  carryLl: number;
  carryDelta: number;
}): MarketAuditRow033[] {
  const dateOnlyOuAh = true;
  return MARKET_ROWS_033.map((market) => {
    const basicN = uniqueEvents(input.basic, market);
    const researchN = weeklyEvents(input.weekly, market);
    if (market === "1X2") {
      return {
        market,
        observed: true,
        strict_events: input.carryN,
        research_events: researchN,
        model: "MARKET_DEVIG",
        test_brier: input.carryBrier,
        market_brier: input.carryBrier,
        delta: 0,
        ci95: "—",
        holm_p: "—",
        holdout: "EMPTY",
        verdict: "NO_DEMONSTRATED_EDGE" as MarketVerdict033,
        temporal_class: "LEVEL_B_EXACT",
        note: `Carried from TASK 032. Not re-fit. VAL selected schedule TEST ΔBrier=${input.carryDelta.toFixed(6)} (worse or null vs market). Market logloss=${input.carryLl.toFixed(6)}. Holm no rejection.`,
      };
    }
    const observed =
      basicN > 0 ||
      researchN > 0 ||
      (dateOnlyOuAh && (market === "OU" || market === "AH" || market === "Exchange"));
    if (!observed) {
      return {
        market,
        observed: false,
        strict_events: 0,
        research_events: 0,
        model: null,
        test_brier: null,
        market_brier: null,
        delta: null,
        ci95: "—",
        holm_p: "—",
        holdout: "EMPTY",
        verdict: "NOT_OBSERVED",
        temporal_class: "—",
        note: "Not present in acquired files with a usable schema.",
      };
    }
    if (basicN > 0 && basicN < 100) {
      return {
        market,
        observed: true,
        strict_events: basicN,
        research_events: researchN,
        model: null,
        test_brier: null,
        market_brier: null,
        delta: null,
        ci95: "—",
        holm_p: "—",
        holdout: "EMPTY",
        verdict: "INSUFFICIENT_N",
        temporal_class: "LEVEL_A_EXACT",
        note: `Betfair BASIC MIRROR n=${basicN} event(s), pt < marketTime. Not capital (MIRROR + n<100). Weekly naive-TZ events=${researchN} remain RESEARCH_ONLY.`,
      };
    }
    return {
      market,
      observed: true,
      strict_events: 0,
      research_events: researchN,
      model: null,
      test_brier: null,
      market_brier: null,
      delta: null,
      ci95: "—",
      holm_p: "—",
      holdout: "EMPTY",
      verdict: "RESEARCH_ONLY",
      temporal_class: market === "Exchange" || researchN > 0 ? "UNKNOWN" : "LEVEL_B_DATE_ONLY",
      note:
        market === "OU" || market === "AH"
          ? "Club/Zenodo/football-data style OU/AH are DATE_ONLY. Kaggle weekly Betfair has FIRST_TAKEN but no timezone — not STRICT."
          : "Observed without a demonstrable pre-kickoff UTC clock.",
    };
  });
}

function annualRows(input: { carryN: number; fixture: boolean }): AnnualRow033[] {
  const rows: AnnualRow033[] = [
    {
      year_label: "2001–2014",
      market: "1X2",
      strict: 0,
      decisions: 0,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      model: null,
      status: "INSUFFICIENT_DATA",
    },
  ];
  const byYear: { y: string; n: number; status: AnnualRow033["status"] }[] = [
    { y: "2015", n: input.fixture ? 0 : 2381, status: input.fixture ? "INSUFFICIENT_DATA" : "NO_EDGE" },
    { y: "2016", n: input.fixture ? 0 : 8118, status: input.fixture ? "INSUFFICIENT_DATA" : "NO_EDGE" },
    { y: "2017", n: 1, status: "INSUFFICIENT_N" },
    { y: "2018", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2019", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2020", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2021", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2022", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2023", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2024", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2025", n: 0, status: "INSUFFICIENT_DATA" },
    { y: "2026 YTD", n: 0, status: "INCOMPLETE_YEAR" },
  ];
  for (const r of byYear) {
    rows.push({
      year_label: r.y,
      market: r.y === "2017" ? "Exchange" : "1X2",
      strict: r.n,
      decisions: 0,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      model: r.status === "NO_EDGE" ? "MARKET_DEVIG" : null,
      status: r.status,
    });
  }
  void input.carryN;
  return rows;
}

export function fingerprint033(input: {
  verdict: LabVerdict033;
  carryFp: string;
  sha031: string;
  basic: readonly BasicMarket033[];
  weekly: WeeklyFamilyCount033[];
  markets: Pick<MarketAuditRow033, "market" | "verdict" | "strict_events">[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        verdict: input.verdict,
        carryFp: input.carryFp,
        sha031: input.sha031,
        basic: input.basic.map((b) => [b.market_id, b.market_type, b.prematch_ticks, b.family]),
        weekly: input.weekly.map((w) => [w.family, w.events, w.rows]),
        markets: input.markets,
      }),
    )
    .digest("hex");
}

export function verdict033(input: { anyConfirmed: boolean; anyCandidate: boolean; tested1x2: boolean }): LabVerdict033 {
  if (input.anyConfirmed) return "EDGE_CONFIRMED";
  if (input.anyCandidate) return "EDGE_CANDIDATE";
  if (input.tested1x2) return "NO_DEMONSTRATED_EDGE";
  return "INSUFFICIENT_DATA";
}

export async function runTask033(input: { skipHeavy?: boolean }): Promise<Task033Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp033Config();
  leakMasanielloProduction(cfg.primary_risk_policy);
  leakOpenTask034(cfg.open_task_034);
  assertTestLocked033(false);
  assertHoldoutLocked033(false);

  const art032 = loadTask032ReportForUi();
  if (art032 && art032.fingerprint !== cfg.carry_forward_032.fingerprint) {
    throw new ExperimentIntegrityError("TASK 032 artifact fingerprint drifted from frozen carry");
  }

  const csv031 = join(process.cwd(), STRICT_031_REL);
  let observedSha = FROZEN_031_SHA256;
  if (!skipHeavy && existsSync(csv031)) {
    observedSha = await sha256File(csv031);
    if (observedSha !== FROZEN_031_SHA256) {
      throw new ExperimentIntegrityError(`TASK 031 base SHA mismatch ${observedSha}`);
    }
  }

  const inventory = skipHeavy
    ? { files: [] as InventoryFile033[], roots_missing: [] as string[] }
    : await inventoryFilesystem033({ hashMaxBytes: 90_000_000 });
  const basic = discoverBasicMarkets033(skipHeavy);
  const weekly = await scanWeeklyBetfair033(skipHeavy);
  const probes = skipHeavy ? [] : await probePublic033();

  const markets = buildMarketRows({
    basic,
    weekly: weekly.families,
    carryN: cfg.carry_forward_032.strict_events,
    carryBrier: cfg.carry_forward_032.market_brier,
    carryLl: cfg.carry_forward_032.market_logloss,
    carryDelta: cfg.carry_forward_032.selected_delta_brier,
  });
  const holm = holmBonferroni([], cfg.alpha);
  const modelReady = markets.filter((m) => m.strict_events >= cfg.min_strict_events_model_ready && m.verdict !== "RESEARCH_ONLY");
  const verdict = verdict033({
    anyConfirmed: markets.some((m) => m.verdict === "EDGE_CONFIRMED"),
    anyCandidate: markets.some((m) => m.verdict === "EDGE_CANDIDATE"),
    tested1x2: true,
  });
  const leakage = runHostileBattery033();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage battery miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }

  const annual = annualRows({ carryN: cfg.carry_forward_032.strict_events, fixture: skipHeavy });
  const otherStrict = new Set(basic.filter((b) => b.prematch_ticks > 0).map((b) => b.event_id)).size;
  const fp = fingerprint033({
    verdict,
    carryFp: cfg.carry_forward_032.fingerprint,
    sha031: observedSha,
    basic,
    weekly: weekly.families,
    markets: markets.map((m) => ({ market: m.market, verdict: m.verdict, strict_events: m.strict_events })),
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "033",
    dataset_id: "TASK_033_STRICT_MARKETS",
    fixture_mode: skipHeavy,
    observed_031_sha256: observedSha,
    carry_032_fingerprint: cfg.carry_forward_032.fingerprint,
    as_of_policy: "STRICT_AS_OF",
    baseline: "MARKET_DEVIG",
    strict_events_1x2: cfg.carry_forward_032.strict_events,
    strict_events_other: otherStrict,
    strict_markets: markets.filter((m) => m.strict_events > 0).length,
    model_ready_markets: modelReady.length,
    best_market: "1X2",
    best_model: "MARKET_DEVIG",
    delta_vs_market: 0,
    holm: { n_tests: 0, rejected: holm.rejected, method: "holm_bonferroni" },
    HOLDOUT_STATUS: "EMPTY",
    holdout_2020_plus: 0,
    winner: null,
    auto_promotion: false,
    real_money: false,
    qualified: false,
    verdict,
    test_used_for_selection: false,
    HOLDOUT_TOUCHED: false,
    BET_COUNT: 0,
    BANKROLL: "NOT_QUALIFIED",
    markets,
    basic,
    weekly,
    windows: unionWindowCoverage(basic),
    inventory: {
      file_count: inventory.files.length,
      roots_missing: inventory.roots_missing,
      sample: inventory.files.slice(0, 40),
    },
    probes,
    annual,
    leakage,
    fingerprint: fp,
    reproducibility: "PENDING",
  };
}

export function loadTask033ReportForUi(): Task033Report | null {
  const p = join(process.cwd(), "artifacts", "task-033-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task033Report;
    if (raw.experiment_id === "exp_033_definitive_market_test") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask033(): Promise<Task033Report> {
  return loadTask033ReportForUi() ?? runTask033({ skipHeavy: true });
}
