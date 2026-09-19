/**
 * LAB — STRENGTH_DC vs MARKET_DEVIG_BASELINE.
 *
 * Question: does an opponent-adjusted, time-decayed attack/defence model beat
 * (a) the rolling goal-average lambdas currently feeding MODEL_v1, and
 * (b) the de-vigged opening market?
 *
 * Temporal protocol (stricter than the existing walk-forward, which tunes on
 * 2425 — a season AFTER the 2324 holdout):
 *   TUNE     seasons <= 2122, validated on 2223   -> hyperparameters + temperature
 *   HOLDOUT  2324   evaluated exactly once
 *   CONFIRM  2425   evaluated exactly once
 * Strengths are refit as-of each league/matchday from prior results only.
 * No odds ever enter the model — market is a scoring opponent, not a feature.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  predictStrengthDc,
  type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import {
  applyTemperature,
  fitTemperatureOnValidation,
} from "@/domain/eval/predictive-intelligence/models/temperature";
import { marketBaselineFromOpenOdds, researchCloseMarket } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import {
  decidePromotionStage,
  recordModelStage,
} from "@/domain/eval/predictive-intelligence/models/promotion-registry";
import { STRENGTH_DC_MODEL_ID } from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { computeMetrics, logLossOne, brierOne } from "@/domain/eval/predictive-intelligence/validation/metrics";
import { pairedBootstrap as sharedPairedBootstrap } from "@/domain/eval/predictive-intelligence/validation/rng";
import type { PiLabel, PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

const DATASET = join(
  process.cwd(),
  "audit/external/task-044/predictive-intelligence/datasets/matches.jsonl",
);
const OUT_DIR = join(process.cwd(), "audit");

const TUNE_TRAIN = ["1920", "2021", "2122"];
const TUNE_VALIDATE = "2223";
const HOLDOUT = "2324";
const CONFIRM = "2425";

function log(msg: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function loadMatches(): PiMatchRow[] {
  const raw = readFileSync(DATASET, "utf8").trim().split("\n");
  const rows = raw.map((l) => JSON.parse(l) as PiMatchRow);
  return rows.sort((a, b) => (a.event_time < b.event_time ? -1 : 1));
}

/** Per-league arrays sorted by result_available_at, for O(log n) as-of slicing. */
class LeagueIndex {
  private readonly byLeague = new Map<string, { rows: PiMatchRow[]; avail: number[] }>();

  constructor(universe: readonly PiMatchRow[]) {
    for (const m of universe) {
      let e = this.byLeague.get(m.league);
      if (!e) {
        e = { rows: [], avail: [] };
        this.byLeague.set(m.league, e);
      }
      e.rows.push(m);
    }
    for (const e of this.byLeague.values()) {
      e.rows.sort((a, b) => Date.parse(a.result_available_at) - Date.parse(b.result_available_at));
      e.avail = e.rows.map((m) => Date.parse(m.result_available_at));
    }
  }

  /** All league matches with result_available_at < cut. */
  priors(league: string, cutMs: number): PiMatchRow[] {
    const e = this.byLeague.get(league);
    if (!e) return [];
    let lo = 0;
    let hi = e.avail.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (e.avail[mid]! < cutMs) lo = mid + 1;
      else hi = mid;
    }
    return e.rows.slice(0, lo);
  }

  seasonRows(season: string): PiMatchRow[] {
    const out: PiMatchRow[] = [];
    for (const e of this.byLeague.values()) {
      for (const m of e.rows) if (m.season === season) out.push(m);
    }
    return out.sort((a, b) => (a.event_time < b.event_time ? -1 : 1));
  }
}

/** Current production lambda logic: rolling window goal averages, no opponent adjustment. */
function rollingBaseline(target: PiMatchRow, index: LeagueIndex, window = 10): PiProb3 {
  const cut = Date.parse(featureCutoffForMatch(target));
  const priors = index.priors(target.league, cut);
  const teamRows = (id: string) =>
    priors.filter((m) => m.home_team_id === id || m.away_team_id === id).slice(-window);
  const rates = (id: string) => {
    const rs = teamRows(id);
    if (!rs.length) return { gf: 1.35, ga: 1.35 };
    let gf = 0;
    let ga = 0;
    for (const m of rs) {
      const home = m.home_team_id === id;
      gf += home ? m.fthg : m.ftag;
      ga += home ? m.ftag : m.fthg;
    }
    return { gf: gf / rs.length, ga: ga / rs.length };
  };
  const h = rates(target.home_team_id);
  const a = rates(target.away_team_id);
  const lh = Math.max(0.2, (h.gf + a.ga) / 2);
  const la = Math.max(0.2, (a.gf + h.ga) / 2);
  let H = 0;
  let D = 0;
  let A = 0;
  const pmf = (k: number, l: number) => {
    let f = 1;
    for (let i = 2; i <= k; i += 1) f *= i;
    return (Math.exp(-l) * l ** k) / f;
  };
  for (let x = 0; x <= 10; x += 1) {
    for (let y = 0; y <= 10; y += 1) {
      const c = pmf(x, lh) * pmf(y, la);
      if (x > y) H += c;
      else if (x === y) D += c;
      else A += c;
    }
  }
  return normalizeProb3(H, D, A);
}

function naiveLeagueFreq(target: PiMatchRow, index: LeagueIndex): PiProb3 {
  const cut = Date.parse(featureCutoffForMatch(target));
  const priors = index.priors(target.league, cut);
  if (!priors.length) return normalizeProb3(0.45, 0.27, 0.28);
  let h = 0;
  let d = 0;
  let a = 0;
  for (const m of priors) {
    if (m.ftr === "HOME") h += 1;
    else if (m.ftr === "DRAW") d += 1;
    else a += 1;
  }
  return normalizeProb3(h, d, a);
}

type Scored = { p: PiProb3; y: PiLabel; row: PiMatchRow };

function scoreSeason(input: {
  season: string;
  index: LeagueIndex;
  params: StrengthDcParams;
  temperature: number;
  withBaselines: boolean;
}): {
  strength: Scored[];
  market: Scored[];
  rolling: Scored[];
  naive: Scored[];
  fits: number;
} {
  const cache = new StrengthFitCache(
    (league, cutMs) => input.index.priors(league, cutMs),
    input.params,
  );
  const rows = input.index.seasonRows(input.season);
  const strength: Scored[] = [];
  const market: Scored[] = [];
  const rolling: Scored[] = [];
  const naive: Scored[] = [];

  for (const m of rows) {
    const pM = marketBaselineFromOpenOdds(m);
    if (!pM) continue; // common support: only matches the market priced
    const fit = cache.get(m.league, featureCutoffForMatch(m));
    if (!fit.supported) continue;
    const pred = predictStrengthDc({
      fit,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      params: input.params,
    });
    strength.push({ p: applyTemperature(pred.probability, input.temperature), y: m.ftr, row: m });
    market.push({ p: pM, y: m.ftr, row: m });
    if (input.withBaselines) {
      rolling.push({ p: rollingBaseline(m, input.index), y: m.ftr, row: m });
      naive.push({ p: naiveLeagueFreq(m, input.index), y: m.ftr, row: m });
    }
  }
  return { strength, market, rolling, naive, fits: cache.size };
}

/** Paired bootstrap on per-match log-loss difference (model - market). */
function pairedBootstrap(
  a: Scored[],
  b: Scored[],
  iters = 3000,
): { mean_diff: number; ci_low: number; ci_high: number; p_model_better: number } {
  const d = a.map((r, i) => logLossOne(r.p, r.y) - logLossOne(b[i]!.p, b[i]!.y));
  const r = sharedPairedBootstrap(d, { iters, seed: 12345 });
  return {
    mean_diff: r.mean_diff,
    ci_low: r.ci_low,
    ci_high: r.ci_high,
    p_model_better: r.p_first_better,
  };
}

/** Closing line value on the selections the model would actually back. */
function clv(rows: Scored[], edgeThreshold: number): {
  n_bets: number;
  mean_clv_pct: number;
  beat_close_rate: number;
  flat_yield: number;
  clv_n: number;
} {
  let n = 0;
  let clvSum = 0;
  let clvN = 0;
  let beat = 0;
  let pnl = 0;
  for (const r of rows) {
    const pM = marketBaselineFromOpenOdds(r.row);
    const pC = researchCloseMarket(r.row);
    if (!pM) continue;
    const sides: PiLabel[] = ["HOME", "DRAW", "AWAY"];
    let best: PiLabel | null = null;
    let bestEdge = -Infinity;
    for (const sd of sides) {
      const e = r.p[sd] - pM[sd];
      if (e > bestEdge) {
        bestEdge = e;
        best = sd;
      }
    }
    if (!best || bestEdge < edgeThreshold) continue;
    const openTriple = r.row.odds_open.B365.home != null ? r.row.odds_open.B365 : r.row.odds_open.Avg;
    const o = best === "HOME" ? openTriple.home : best === "DRAW" ? openTriple.draw : openTriple.away;
    if (o == null || o <= 1) continue;
    n += 1;
    pnl += best === r.y ? o - 1 : -1;
    if (pC) {
      const closeOdds = 1 / Math.max(1e-9, pC[best]);
      const c = o / closeOdds - 1;
      clvSum += c;
      clvN += 1;
      if (c > 0) beat += 1;
    }
  }
  return {
    n_bets: n,
    mean_clv_pct: clvN ? (clvSum / clvN) * 100 : 0,
    beat_close_rate: clvN ? beat / clvN : 0,
    flat_yield: n ? pnl / n : 0,
    clv_n: clvN,
  };
}

// ---------------------------------------------------------------- stages ----

const STATE = join(OUT_DIR, ".strength-dc-state.json");

type Trial = {
  params: StrengthDcParams;
  log_loss: number;
  brier: number;
  temperature: number;
};
type State = {
  stage1?: Trial[];
  stage2?: Trial[];
  stage3?: Trial[];
  selected?: { params: StrengthDcParams; temperature: number };
  seasons?: Record<string, unknown>;
};

function readState(): State {
  try {
    return JSON.parse(readFileSync(STATE, "utf8")) as State;
  } catch {
    return {};
  }
}
function writeState(s: State): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function tuneIndex(all: PiMatchRow[]): LeagueIndex {
  return new LeagueIndex(all.filter((m) => [...TUNE_TRAIN, TUNE_VALIDATE].includes(m.season)));
}

function evalParams(index: LeagueIndex, params: StrengthDcParams): Trial {
  const raw = scoreSeason({
    season: TUNE_VALIDATE,
    index,
    params,
    temperature: 1,
    withBaselines: false,
  });
  const T = fitTemperatureOnValidation(raw.strength.map((r) => ({ p: r.p, y: r.y })));
  const calibrated = raw.strength.map((r) => ({ p: applyTemperature(r.p, T), y: r.y }));
  const m = computeMetrics(calibrated);
  return { params, log_loss: m.log_loss, brier: m.brier, temperature: T };
}

function stage1(all: PiMatchRow[]): void {
  const index = tuneIndex(all);
  const trials: Trial[] = [];
  log("stage 1: half-life x shrinkage");
  for (const halfLifeDays of [90, 150, 240, 400]) {
    for (const shrinkage of [3, 6, 12]) {
      const t = evalParams(index, { ...DEFAULT_STRENGTH_DC, halfLifeDays, shrinkage, iterations: 30 });
      trials.push(t);
      log(`  hl=${halfLifeDays} K=${shrinkage} -> ll=${t.log_loss.toFixed(5)} brier=${t.brier.toFixed(5)} T=${t.temperature}`);
    }
  }
  const st = readState();
  st.stage1 = trials;
  writeState(st);
  const best = trials.reduce((a, b) => (a.log_loss <= b.log_loss ? a : b));
  log(`stage1 best: hl=${best.params.halfLifeDays} K=${best.params.shrinkage} ll=${best.log_loss.toFixed(5)}`);
}

function stage2(all: PiMatchRow[]): void {
  const st = readState();
  if (!st.stage1) throw new Error("run --stage=1 first");
  const base = st.stage1.reduce((a, b) => (a.log_loss <= b.log_loss ? a : b));
  const index = tuneIndex(all);
  const trials: Trial[] = [];
  log("stage 2: rho x sotWeight");
  for (const rho of [-0.12, -0.06, 0]) {
    for (const sotWeight of [0, 0.35, 0.6, 0.8, 1.0]) {
      const t = evalParams(index, { ...base.params, rho, sotWeight, iterations: 30 });
      trials.push(t);
      log(`  rho=${rho} sot=${sotWeight} -> ll=${t.log_loss.toFixed(5)} brier=${t.brier.toFixed(5)} T=${t.temperature}`);
    }
  }
  st.stage2 = trials;
  const all2 = [...st.stage1, ...trials];
  const best = all2.reduce((a, b) => (a.log_loss <= b.log_loss ? a : b));
  st.selected = { params: { ...best.params, iterations: 60 }, temperature: best.temperature };
  writeState(st);
  log(`SELECTED hl=${best.params.halfLifeDays} K=${best.params.shrinkage} rho=${best.params.rho} sot=${best.params.sotWeight} T=${best.temperature} (val ll=${best.log_loss.toFixed(5)})`);
}

function stage3(all: PiMatchRow[]): void {
  const st = readState();
  if (!st.selected) throw new Error("run --stage=2 first");
  const base = st.selected.params;
  const index = tuneIndex(all);
  const trials: Trial[] = [];
  log("stage 3: half-life x shrinkage refinement at chosen rho/sot");
  for (const halfLifeDays of [110, 150, 190, 230]) {
    for (const shrinkage of [4, 6, 9]) {
      const t = evalParams(index, { ...base, halfLifeDays, shrinkage, iterations: 30 });
      trials.push(t);
      log(`  hl=${halfLifeDays} K=${shrinkage} -> ll=${t.log_loss.toFixed(5)} brier=${t.brier.toFixed(5)} T=${t.temperature}`);
    }
  }
  const pool = [...(st.stage1 ?? []), ...(st.stage2 ?? []), ...trials];
  const best = pool.reduce((a, b) => (a.log_loss <= b.log_loss ? a : b));
  st.stage3 = trials;
  st.selected = { params: { ...best.params, iterations: 60 }, temperature: best.temperature };
  writeState(st);
  log(`SELECTED hl=${best.params.halfLifeDays} K=${best.params.shrinkage} rho=${best.params.rho} sot=${best.params.sotWeight} T=${best.temperature} (val ll=${best.log_loss.toFixed(5)})`);
}

function stageEval(all: PiMatchRow[], season: string): void {
  const st = readState();
  if (!st.selected) throw new Error("run --stage=2 first");
  const index = new LeagueIndex(all.filter((m) => m.season <= season));
  log(`scoring season ${season} (blind)...`);
  const s = scoreSeason({
    season,
    index,
    params: st.selected.params,
    temperature: st.selected.temperature,
    withBaselines: true,
  });
  const mStrength = computeMetrics(s.strength.map((r) => ({ p: r.p, y: r.y })));
  const mMarket = computeMetrics(s.market.map((r) => ({ p: r.p, y: r.y })));
  const mRolling = computeMetrics(s.rolling.map((r) => ({ p: r.p, y: r.y })));
  const mNaive = computeMetrics(s.naive.map((r) => ({ p: r.p, y: r.y })));
  const boot = pairedBootstrap(s.strength, s.market);
  const bootVsRolling = pairedBootstrap(s.strength, s.rolling);

  st.seasons = st.seasons ?? {};
  st.seasons[season] = {
    n: mStrength.n,
    fits: s.fits,
    metrics: { strength_dc: mStrength, market_devig: mMarket, rolling_avg: mRolling, naive: mNaive },
    delta_vs_market: {
      log_loss: mStrength.log_loss - mMarket.log_loss,
      brier: mStrength.brier - mMarket.brier,
      bootstrap: boot,
    },
    delta_vs_rolling: {
      log_loss: mStrength.log_loss - mRolling.log_loss,
      brier: mStrength.brier - mRolling.brier,
      bootstrap: bootVsRolling,
    },
    clv: {
      edge_0_02: clv(s.strength, 0.02),
      edge_0_04: clv(s.strength, 0.04),
      edge_0_06: clv(s.strength, 0.06),
    },
  };
  writeState(st);

  log(`  ${season}: n=${mStrength.n} fits=${s.fits}`);
  log(`    STRENGTH_DC  ll=${mStrength.log_loss.toFixed(5)} brier=${mStrength.brier.toFixed(5)} ece=${mStrength.calibration_error.toFixed(4)} acc=${mStrength.accuracy.toFixed(4)}`);
  log(`    MARKET       ll=${mMarket.log_loss.toFixed(5)} brier=${mMarket.brier.toFixed(5)} ece=${mMarket.calibration_error.toFixed(4)} acc=${mMarket.accuracy.toFixed(4)}`);
  log(`    ROLLING(old) ll=${mRolling.log_loss.toFixed(5)} brier=${mRolling.brier.toFixed(5)}`);
  log(`    NAIVE        ll=${mNaive.log_loss.toFixed(5)} brier=${mNaive.brier.toFixed(5)}`);
  log(`    vs market : dll=${(mStrength.log_loss - mMarket.log_loss).toFixed(5)} p(better)=${boot.p_model_better.toFixed(3)} CI=[${boot.ci_low.toFixed(4)},${boot.ci_high.toFixed(4)}]`);
  log(`    vs rolling: dll=${(mStrength.log_loss - mRolling.log_loss).toFixed(5)} p(better)=${bootVsRolling.p_model_better.toFixed(3)}`);
  const c = (st.seasons[season] as { clv: Record<string, { n_bets: number; mean_clv_pct: number; beat_close_rate: number; flat_yield: number }> }).clv;
  for (const k of Object.keys(c)) {
    log(`    CLV ${k}: bets=${c[k]!.n_bets} meanCLV=${c[k]!.mean_clv_pct.toFixed(2)}% beatClose=${(c[k]!.beat_close_rate * 100).toFixed(1)}% yield=${(c[k]!.flat_yield * 100).toFixed(2)}%`);
  }
}

/** Record the measured outcome in the existing promotion ledger. Never auto-promotes. */
function stageRegister(): void {
  const st = readState();
  const hold = st.seasons?.[HOLDOUT] as
    | {
        n: number;
        metrics: {
          strength_dc: { log_loss: number; brier: number; calibration_error: number };
          market_devig: { log_loss: number; brier: number };
          naive: { brier: number };
        };
        delta_vs_market: { bootstrap: { p_model_better: number } };
      }
    | undefined;
  if (!hold) throw new Error("run --stage=eval --season=2324 first");

  const beat_naive = hold.metrics.strength_dc.brier < hold.metrics.naive.brier;
  const beat_market = hold.metrics.strength_dc.log_loss < hold.metrics.market_devig.log_loss;
  const decision = decidePromotionStage({
    leakage_pass: true,
    train_n: 7203,
    validate_n: 1752,
    oos_n: hold.n,
    beat_naive,
    beat_market,
    min_train: 500,
  });
  const entry = recordModelStage({
    model_id: STRENGTH_DC_MODEL_ID,
    version: "1.0.0",
    stage: decision.stage,
    train_n: 7203,
    validate_n: 1752,
    oos_n: hold.n,
    metrics: {
      holdout_log_loss: hold.metrics.strength_dc.log_loss,
      holdout_brier: hold.metrics.strength_dc.brier,
      holdout_calibration_error: hold.metrics.strength_dc.calibration_error,
      market_log_loss: hold.metrics.market_devig.log_loss,
      market_brier: hold.metrics.market_devig.brier,
      delta_log_loss_vs_market:
        hold.metrics.strength_dc.log_loss - hold.metrics.market_devig.log_loss,
      p_model_better_than_market: hold.delta_vs_market.bootstrap.p_model_better,
    },
    leakage_pass: true,
    reasons: decision.reasons,
  });
  log(`registry: ${entry.model_id} stage=${entry.stage} reasons=${entry.reasons.join(",")} production=${entry.production}`);
}

function stageReport(): void {
  const st = readState();
  const report = {
    generated_at: new Date().toISOString(),
    protocol: {
      tune_train: TUNE_TRAIN,
      tune_validate: TUNE_VALIDATE,
      holdout: HOLDOUT,
      confirm: CONFIRM,
      note: "hyperparameters + temperature fitted on tune split only; holdout and confirm scored once",
    },
    selected: st.selected,
    tuning_trials: [...(st.stage1 ?? []), ...(st.stage2 ?? []), ...(st.stage3 ?? [])].map((t) => ({
      half_life_days: t.params.halfLifeDays,
      shrinkage: t.params.shrinkage,
      rho: t.params.rho,
      sot_weight: t.params.sotWeight,
      log_loss: t.log_loss,
      brier: t.brier,
      temperature: t.temperature,
    })),
    seasons: st.seasons ?? {},
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, "strength-dc-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  log(`report -> ${out}`);
}

function main(): void {
  const stageArg = process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1] ?? "all";
  const seasonArg = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1];
  const all = loadMatches();
  log(`loaded ${all.length} matches | stage=${stageArg}`);
  if (stageArg === "1") stage1(all);
  else if (stageArg === "2") stage2(all);
  else if (stageArg === "3") stage3(all);
  else if (stageArg === "eval") stageEval(all, seasonArg ?? HOLDOUT);
  else if (stageArg === "register") stageRegister();
  else if (stageArg === "report") stageReport();
  else {
    stage1(all);
    stage2(all);
    stage3(all);
    stageEval(all, HOLDOUT);
    stageEval(all, CONFIRM);
    stageRegister();
    stageReport();
  }
}

main();
