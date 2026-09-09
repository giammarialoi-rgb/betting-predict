import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { brier3 } from "@/domain/eval/capital-020/models";
import { freezeStrict027 } from "@/domain/eval/validation-028/freeze";
import { actualIdx, scoreRows } from "@/domain/eval/validation-028/metrics";
import { blockBootstrapMeanCI, permutationMeanPOneSidedPositive } from "@/domain/eval/validation-028/stats";
import { holmBonferroni } from "@/domain/eval/multiple-testing";
import { loadMovementByMatchBook } from "@/domain/eval/final-feature-reconstruction";
import { loadBooksByMatch, type BookQuote029 } from "@/domain/eval/incremental-029/overlay";
import { assertHoldoutLocked034, assertTestLocked034, experimentSha034, loadExp034Config } from "@/domain/eval/market-034/config";
import { buildCoverage, type Coverage034, type EventWindowRow034 } from "@/domain/eval/market-034/coverage";
import {
  assignQuartile,
  brierDecompHome,
  classifyMovement034,
  groupBrier,
  hosmerLemeshow,
  meanBrier,
  quartileCuts,
  type BrierDecomp034,
  type GroupBrier,
  type Hl034,
  type MovementLabel034,
} from "@/domain/eval/market-034/diagnostics";
import { HYPOTHESES_034, hypothesisRegistryHash034 } from "@/domain/eval/market-034/hypotheses";
import { leakEloAdded, leakOpen035, runHostileBattery034 } from "@/domain/eval/market-034/leakage";
import {
  bestPriceOdds,
  crossBookEntropy,
  deVigAdditive,
  favoriteBand,
  flbTable,
  medianOdds,
  mixToward,
  overroundOf,
  powerP,
  priceDispersion,
  proportionalP,
  quantile,
  shinP,
  type FlbRow,
} from "@/domain/eval/market-034/price";
import {
  FROZEN_031_SHA256_034,
  type AnnualRow034,
  type Challenger034,
  type Hypothesis034,
  type LabVerdict034,
  type Score034,
  type SignalVerdict034,
} from "@/domain/eval/market-034/types";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";

export type Task034Report = {
  experiment_id: string;
  task: "034";
  fixture_mode: boolean;
  observed_sha256: string;
  strict_events: number;
  market_snapshots: number;
  hypotheses: number;
  significant_signals: number;
  best_signal: Challenger034 | "MARKET_DEVIG" | null;
  verdict: LabVerdict034;
  market_efficiency: "MARKET_EFFICIENCY_SUPPORTED" | "CANDIDATE" | "INSUFFICIENT";
  HOLDOUT_STATUS: "EMPTY";
  holdout_2020_plus: 0;
  winner: null;
  auto_promotion: false;
  real_money: false;
  qualified: false;
  BET_COUNT: 0;
  CAPITAL_QUALIFIED: false;
  COST_ROBUST: "N/A";
  CLV: number | null;
  CLV_STATUS: "NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF";
  EXECUTION_COST: "UNKNOWN";
  test_used_for_selection: false;
  HOLDOUT_TOUCHED: false;
  coverage: Coverage034;
  scores: Record<string, { VALIDATION: Score034; TEST: Score034 }>;
  classes: Record<string, SignalVerdict034 | "BASELINE">;
  holm: { ids: string[]; raw_p: number[]; adjusted_p: number[]; rejected: boolean[] };
  ci95: Record<string, { low: number; high: number } | null>;
  selected_on_val: Challenger034 | null;
  flb: FlbRow[];
  overround_summary: Record<string, number | null>;
  bands: { band: string; n: number; brier: number | null }[];
  movement: { pattern: MovementLabel034; n: number; brier: number | null; note: string }[];
  cross_book: {
    n_events_multi: number;
    mean_cv_home: number | null;
    mean_range_home: number | null;
    mean_entropy_home: number | null;
  };
  quartile_overround: { q: string; n: number; brier: number | null }[];
  quartile_dispersion: { q: string; n: number; brier: number | null }[];
  hl_home: Hl034;
  brier_decomp_home: BrierDecomp034;
  conditional: GroupBrier[];
  inventory: {
    events: number;
    t1h_snapshots: number;
    t24_snapshots: number;
    windows_zero: string[];
  };
  quote_windows: EventWindowRow034[];
  hypothesis_registry: Hypothesis034[];
  annual: AnnualRow034[];
  leakage: { id: string; throws: boolean }[];
  friction: { cost: number; note: string }[];
  experiment_sha256: string;
  hypothesis_registry_hash: string;
  reproducibility: "PASS" | "FAIL" | "NOT_RUN";
  fingerprint: string;
};

function partOf(kickoff: string, cfg: ReturnType<typeof loadExp034Config>): "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT" | "NONE" {
  const t = kickoff;
  for (const k of ["TRAIN", "VALIDATION", "TEST", "HOLDOUT"] as const) {
    const p = cfg.corpus_partitions[k];
    if (t >= p.start && t <= p.end) return k;
  }
  return "NONE";
}

function scored(
  rows: readonly { p: [number, number, number]; actual: 0 | 1 | 2 }[],
  bins: number,
  marketBrier: number | null,
  marketLl: number | null,
): Score034 {
  const s = scoreRows(rows, bins);
  return {
    n: s.n,
    brier: s.brier,
    logloss: s.logloss,
    ece: s.ece,
    delta_brier: s.brier != null && marketBrier != null ? s.brier - marketBrier : null,
    delta_logloss: s.logloss != null && marketLl != null ? s.logloss - marketLl : null,
  };
}

export function classifySignal034(input: {
  delta: number | null;
  holmRejected: boolean;
  ci: { low: number; high: number } | null;
}): SignalVerdict034 {
  if (input.delta == null || !input.ci) return "INCONCLUSIVE";
  if (input.delta < 0 && input.ci.high < 0 && input.holmRejected) return "EDGE_CANDIDATE";
  if (input.delta > 0 && input.ci.low > 0) return "HARMFUL";
  if (input.ci.low <= 0 && input.ci.high >= 0) return "NON_INFERIOR";
  return "INCONCLUSIVE";
}

export function verdict034(input: { fixture: boolean; testN: number; anyCandidate: boolean }): LabVerdict034 {
  if (input.fixture || input.testN < 100) return "INSUFFICIENT_DATA";
  if (input.anyCandidate) return "INEFFICIENCY_FOUND";
  return "NO_DEMONSTRATED_INEFFICIENCY";
}

export function fingerprint034(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

type Packed = {
  event: StrictCandidate027;
  partition: "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT" | "NONE";
  actual: 0 | 1 | 2;
  p: Record<"market" | Challenger034, [number, number, number]>;
  overround: number;
  nBooks: number;
  rangeHome: number;
  cvHome: number | null;
  entropyHome: number | null;
  t24: boolean;
  deltaFavP: number | null;
  movement: MovementLabel034;
  week: string;
  year: number;
  weekday: string;
  league: string;
  favOdds: number;
  favSide: "HOME" | "DRAW" | "AWAY";
};

export async function runTask034(input: { skipHeavy?: boolean }): Promise<Task034Report> {
  const skipHeavy = input.skipHeavy === true;
  const cfg = loadExp034Config();
  leakEloAdded(cfg.add_elo);
  leakOpen035(cfg.open_task_035);
  assertTestLocked034(false);
  assertHoldoutLocked034(false);
  const { freeze, events } = freezeStrict027({ skipHeavy });
  if (!skipHeavy && !freeze.fixture && freeze.sha256 !== FROZEN_031_SHA256_034) {
    throw new ExperimentIntegrityError(`TASK 031 SHA mismatch ${freeze.sha256}`);
  }
  const books = loadBooksByMatch(skipHeavy);
  const t24 = loadMovementByMatchBook(skipHeavy);
  const mix = cfg.steam_follow_mix;

  const packed: Packed[] = [];
  let t24n = 0;
  for (const e of events) {
    const market = proportionalP({ home: e.home_odds, draw: e.draw_odds, away: e.away_odds });
    if (!market) continue;
    const o = { home: e.home_odds, draw: e.draw_odds, away: e.away_odds };
    const list = books.get(e.match_id) ?? [];
    const withPrimary: BookQuote029[] =
      list.length > 0
        ? list
        : [{ matchId: e.match_id, bookmaker: e.bookmaker, home: e.home_odds, draw: e.draw_odds, away: e.away_odds }];
    const best = bestPriceOdds(withPrimary, o);
    const med = medianOdds(withPrimary, o);
    const early = t24.get(`${e.match_id}|${e.bookmaker.toLowerCase()}`);
    const earlyP = early
      ? proportionalP({ home: early.home, draw: early.draw, away: early.away })
      : null;
    if (earlyP) t24n += 1;
    const steam = earlyP ? mixToward(market, earlyP, mix) : market;
    const homes = withPrimary.map((b) => b.home);
    const favIdx = o.home <= o.draw && o.home <= o.away ? 0 : o.draw <= o.away ? 1 : 2;
    const deltaFavP =
      earlyP != null ? market[favIdx]! - earlyP[favIdx]! : null;
    packed.push({
      event: e,
      partition: partOf(e.kickoff, cfg),
      actual: actualIdx(e.ft_home, e.ft_away),
      p: {
        market,
        shin: shinP(o) ?? market,
        power: powerP(o) ?? market,
        additive: deVigAdditive([o.home, o.draw, o.away]) ?? market,
        best_price: proportionalP(best) ?? market,
        median_consensus: proportionalP(med) ?? market,
        follow_steam: steam,
      },
      overround: overroundOf(o),
      nBooks: withPrimary.length,
      rangeHome: priceDispersion(homes).range ?? 0,
      cvHome: priceDispersion(homes).cv,
      entropyHome: crossBookEntropy(homes),
      t24: Boolean(earlyP),
      deltaFavP,
      movement: classifyMovement034(deltaFavP),
      week: e.kickoff.slice(0, 10),
      year: Number(e.kickoff.slice(0, 4)),
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(e.kickoff).getUTCDay()] ?? "unk",
      league: e.competition || "unknown",
      favOdds: Math.min(e.home_odds, e.draw_odds, e.away_odds),
      favSide: favIdx === 0 ? "HOME" : favIdx === 1 ? "DRAW" : "AWAY",
    });
  }

  const by = (p: Packed["partition"]) => packed.filter((r) => r.partition === p);
  const val = by("VALIDATION");
  const test = by("TEST");
  const train = by("TRAIN");
  const challengers = cfg.challengers;

  const mVal = scored(val.map((r) => ({ p: r.p.market, actual: r.actual })), cfg.ece_bins, null, null);
  const mTest = scored(test.map((r) => ({ p: r.p.market, actual: r.actual })), cfg.ece_bins, null, null);
  const scores: Task034Report["scores"] = {
    market: { VALIDATION: { ...mVal, delta_brier: 0, delta_logloss: 0 }, TEST: { ...mTest, delta_brier: 0, delta_logloss: 0 } },
  };
  for (const id of challengers) {
    scores[id] = {
      VALIDATION: scored(val.map((r) => ({ p: r.p[id], actual: r.actual })), cfg.ece_bins, mVal.brier, mVal.logloss),
      TEST: scored(test.map((r) => ({ p: r.p[id], actual: r.actual })), cfg.ece_bins, mTest.brier, mTest.logloss),
    };
  }

  let selected: Challenger034 | null = null;
  let bestVal = 0;
  for (const id of challengers) {
    const d = scores[id]!.VALIDATION.delta_brier;
    if (d != null && d < -cfg.val_improve_eps && (selected == null || d < bestVal)) {
      selected = id;
      bestVal = d;
    }
  }

  const rawP: number[] = [];
  const ci95: Task034Report["ci95"] = {};
  for (const id of challengers) {
    const diffs = test.map((r) => brier3(r.p.market, r.actual) - brier3(r.p[id], r.actual));
    rawP.push(permutationMeanPOneSidedPositive({ values: diffs, nPerm: cfg.permutation_n, seed: cfg.bootstrap_seed }) ?? 1);
    const signed = test.map((r) => brier3(r.p[id], r.actual) - brier3(r.p.market, r.actual));
    const ci = blockBootstrapMeanCI({
      values: signed,
      blockIds: test.map((r) => r.week),
      nBoot: cfg.bootstrap_n,
      seed: cfg.bootstrap_seed,
      alpha: cfg.alpha,
    });
    ci95[id] = ci ? { low: ci.low, high: ci.high } : null;
  }
  const holm = holmBonferroni(rawP, cfg.alpha);
  const classes: Task034Report["classes"] = { market: "BASELINE" };
  for (let i = 0; i < challengers.length; i++) {
    const id = challengers[i]!;
    classes[id] = classifySignal034({
      delta: scores[id]!.TEST.delta_brier,
      holmRejected: holm.rejected[i] === true,
      ci: ci95[id],
    });
  }

  const flbPairs: { p: number; y: 0 | 1 }[] = [];
  for (const r of test) {
    flbPairs.push({ p: r.p.market[0]!, y: r.actual === 0 ? 1 : 0 });
    flbPairs.push({ p: r.p.market[1]!, y: r.actual === 1 ? 1 : 0 });
    flbPairs.push({ p: r.p.market[2]!, y: r.actual === 2 ? 1 : 0 });
  }
  const flb = flbTable(flbPairs);

  const ov = train.map((r) => r.overround);
  const overround_summary = {
    mean: ov.length ? ov.reduce((a, b) => a + b, 0) / ov.length : null,
    median: quantile(ov, 0.5),
    p10: quantile(ov, 0.1),
    p25: quantile(ov, 0.25),
    p75: quantile(ov, 0.75),
    p90: quantile(ov, 0.9),
    max: ov.length ? Math.max(...ov) : null,
  };

  const bandMap = new Map<string, { n: number; brier: number }>();
  for (const r of test) {
    const band = favoriteBand(r.favOdds);
    const g = bandMap.get(band) ?? { n: 0, brier: 0 };
    g.n += 1;
    g.brier += brier3(r.p.market, r.actual);
    bandMap.set(band, g);
  }
  const bands = [...bandMap.entries()].map(([band, g]) => ({ band, n: g.n, brier: g.n ? g.brier / g.n : null }));

  const ovCuts = quartileCuts(train.map((r) => r.overround));
  const dispCuts = quartileCuts(train.filter((r) => r.nBooks >= 2).map((r) => r.rangeHome));
  const quartile_overround = ([1, 2, 3, 4] as const).map((q) => {
    const rows = ovCuts ? test.filter((r) => assignQuartile(r.overround, ovCuts) === q) : [];
    return { q: `Q${q}`, n: rows.length, brier: meanBrier(rows.map((r) => ({ p: r.p.market, actual: r.actual }))) };
  });
  const quartile_dispersion = ([1, 2, 3, 4] as const).map((q) => {
    const rows = dispCuts ? test.filter((r) => r.nBooks >= 2 && assignQuartile(r.rangeHome, dispCuts) === q) : [];
    return { q: `Q${q}`, n: rows.length, brier: meanBrier(rows.map((r) => ({ p: r.p.market, actual: r.actual }))) };
  });

  const movementLabels: MovementLabel034[] = [
    "steam",
    "reverse_steam",
    "drift",
    "stability",
    "no_second_snapshot",
    "late_reversal",
    "t1_to_kickoff",
  ];
  const movement = movementLabels.map((pattern) => {
    if (pattern === "late_reversal" || pattern === "t1_to_kickoff") {
      return { pattern, n: 0, brier: null, note: "window coverage 0 — not interpolated" };
    }
    const rows = test.filter((r) => r.movement === pattern);
    return {
      pattern,
      n: rows.length,
      brier: meanBrier(rows.map((r) => ({ p: r.p.market, actual: r.actual }))),
      note: pattern === "no_second_snapshot" ? "T-24 overlay missing" : "T-24→T-1h only",
    };
  });

  const multi = packed.filter((r) => r.nBooks >= 2);
  const cvVals = multi.map((r) => r.cvHome).filter((x): x is number => x != null);
  const entropyVals = multi.map((r) => r.entropyHome).filter((x): x is number => x != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const cross_book = {
    n_events_multi: multi.length,
    mean_cv_home: avg(cvVals),
    mean_range_home: avg(multi.map((r) => r.rangeHome)),
    mean_entropy_home: avg(entropyVals),
  };

  const hl_home = hosmerLemeshow(test.map((r) => ({ p: r.p.market[0]!, y: r.actual === 0 ? 1 : 0 })));
  const brier_decomp_home = brierDecompHome(test.map((r) => ({ p: r.p.market, actual: r.actual })));
  const conditional = [
    ...groupBrier(
      test.map((r) => ({ key: r.weekday, p: r.p.market, actual: r.actual })),
      "weekday",
    ),
    ...groupBrier(
      test.map((r) => ({ key: String(r.year), p: r.p.market, actual: r.actual })),
      "season",
    ),
    ...groupBrier(
      test.map((r) => ({ key: r.favSide, p: r.p.market, actual: r.actual })),
      "favorite_side",
    ),
    ...groupBrier(
      test.map((r) => ({ key: r.movement, p: r.p.market, actual: r.actual })),
      "movement_direction",
    ),
    ...groupBrier(
      test.map((r) => ({ key: r.league, p: r.p.market, actual: r.actual })),
      "league",
    ),
    ...groupBrier(
      test.map((r) => ({ key: "T-1h", p: r.p.market, actual: r.actual })),
      "time_to_kickoff",
    ),
  ];

  const quote_windows: EventWindowRow034[] = packed.map((r) => ({
    event_id: r.event.event_id,
    kickoff: r.event.kickoff,
    bookmaker: r.event.bookmaker,
    t1h: 1,
    t24: r.t24 ? 1 : 0,
    "T-72h": 0,
    "T-48h": 0,
    "T-12h": 0,
    "T-6h": 0,
    "T-3h": 0,
    "T-30m": 0,
    "T-15m": 0,
    "T-5m": 0,
    "T-1m": 0,
  }));

  const anyCandidate = Object.values(classes).some((c) => c === "EDGE_CANDIDATE");
  const verdict = verdict034({ fixture: freeze.fixture, testN: test.length, anyCandidate });
  let bestSignal: Challenger034 | "MARKET_DEVIG" = "MARKET_DEVIG";
  let bestD = 0;
  for (const id of challengers) {
    if (classes[id] !== "EDGE_CANDIDATE") continue;
    const d = scores[id]!.TEST.delta_brier;
    if (d != null && (bestSignal === "MARKET_DEVIG" || d < bestD)) {
      bestSignal = id;
      bestD = d;
    }
  }
  const registry = HYPOTHESES_034.map((h, i) => {
    if (!h.inferential) return { ...h, status: h.status };
    const id = challengers[i];
    if (!id) return { ...h, status: "PENDING" };
    return { ...h, status: classes[id] ?? "PENDING" };
  });

  const leakage = runHostileBattery034();
  if (leakage.some((l) => !l.throws)) {
    throw new ExperimentIntegrityError(`leakage miss: ${leakage.filter((l) => !l.throws).map((l) => l.id).join(",")}`);
  }

  const yearsStrict = (y: number) => packed.filter((r) => r.year === y).length;
  const annual: AnnualRow034[] = [
    { year_label: "2001–2014", signal: "none", n: 0, bets: 0, start: 1000, end: null, pnl: null, roi: null, max_dd: null, status: "INSUFFICIENT_DATA" },
    { year_label: "2015", signal: "MARKET_DEVIG", n: freeze.fixture ? 0 : yearsStrict(2015), bets: 0, start: 1000, end: null, pnl: null, roi: null, max_dd: null, status: freeze.fixture ? "INSUFFICIENT_DATA" : "NO_INEFFICIENCY" },
    { year_label: "2016", signal: "MARKET_DEVIG", n: freeze.fixture ? 0 : yearsStrict(2016), bets: 0, start: 1000, end: null, pnl: null, roi: null, max_dd: null, status: freeze.fixture ? "INSUFFICIENT_DATA" : "NO_INEFFICIENCY" },
    ...["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"].map((y) => ({
      year_label: y,
      signal: "none",
      n: 0,
      bets: 0,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      status: "INSUFFICIENT_DATA" as const,
    })),
    { year_label: "2026 YTD", signal: "none", n: 0, bets: 0, start: 1000, end: null, pnl: null, roi: null, max_dd: null, status: "INCOMPLETE_YEAR" },
  ];

  const fp = fingerprint034({
    verdict,
    sha: freeze.sha256,
    exp: experimentSha034(),
    hyp: hypothesisRegistryHash034(),
    selected,
    test: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.TEST])),
    holm: holm.adjusted,
    clv_status: "NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF",
  });

  return {
    experiment_id: cfg.experiment_id,
    task: "034",
    fixture_mode: freeze.fixture,
    observed_sha256: freeze.sha256,
    strict_events: events.length,
    market_snapshots: events.length * 3 + t24n * 3,
    hypotheses: HYPOTHESES_034.length,
    significant_signals: holm.rejected.filter(Boolean).length,
    best_signal: bestSignal,
    verdict,
    market_efficiency:
      verdict === "INSUFFICIENT_DATA" ? "INSUFFICIENT" : anyCandidate ? "CANDIDATE" : "MARKET_EFFICIENCY_SUPPORTED",
    HOLDOUT_STATUS: "EMPTY",
    holdout_2020_plus: 0,
    winner: null,
    auto_promotion: false,
    real_money: false,
    qualified: false,
    BET_COUNT: 0,
    CAPITAL_QUALIFIED: false,
    COST_ROBUST: "N/A",
    CLV: null,
    CLV_STATUS: "NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF",
    EXECUTION_COST: "UNKNOWN",
    test_used_for_selection: false,
    HOLDOUT_TOUCHED: false,
    coverage: buildCoverage({ nEvents: events.length, t1h: events.length, t24: t24n }),
    scores,
    classes,
    holm: { ids: [...challengers], raw_p: rawP, adjusted_p: holm.adjusted, rejected: holm.rejected },
    ci95,
    selected_on_val: selected,
    flb,
    overround_summary,
    bands,
    movement,
    cross_book,
    quartile_overround,
    quartile_dispersion,
    hl_home,
    brier_decomp_home,
    conditional,
    inventory: {
      events: events.length,
      t1h_snapshots: events.length,
      t24_snapshots: t24n,
      windows_zero: ["T-72h", "T-48h", "T-12h", "T-6h", "T-3h", "T-30m", "T-15m", "T-5m", "T-1m"],
    },
    quote_windows,
    hypothesis_registry: registry,
    annual,
    leakage,
    friction: cfg.friction_scenarios.map((cost) => ({
      cost,
      note: "Not executed — capital gate closed. EXECUTION_COST_UNKNOWN.",
    })),
    experiment_sha256: experimentSha034(),
    hypothesis_registry_hash: hypothesisRegistryHash034(),
    reproducibility: "NOT_RUN",
    fingerprint: fp,
  };
}

export function loadTask034ReportForUi(): Task034Report | null {
  const p = join(process.cwd(), "artifacts", "task-034-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task034Report;
    if (raw.experiment_id !== "exp_034_market_inefficiency") return null;
    return { ...raw, quote_windows: raw.quote_windows ?? [] };
  } catch {
    return null;
  }
}

export async function loadOrRunTask034(): Promise<Task034Report> {
  return loadTask034ReportForUi() ?? runTask034({ skipHeavy: true });
}
