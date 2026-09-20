/**
 * LAB — Over/Under 2.5 goals: STRENGTH_DC vs the de-vigged totals market.
 *
 * Rationale: the same score matrix that loses on 1X2 may win on totals, because
 * totals need only the sum of the two lambdas, not the draw boundary that makes
 * 1X2 hard. The O/U prices sit unused in the raw Football-Data CSVs
 * (B365>2.5 / B365<2.5 / P>2.5 / P<2.5), which is why audit/task-017 reports
 * total_goals as CATALOGUED_ONLY with n=122.
 *
 * Protocol identical to lab-strength-dc: tune on <=2122 validated on 2223,
 * then 2324 and 2425 scored once each. Strengths refit as-of per league/day.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  predictTotalsStrengthDc,
  applyBinaryTemperature,
  type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import { pairedBootstrap as sharedPairedBootstrap } from "@/domain/eval/predictive-intelligence/validation/rng";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
/**
 * Archivio esteso: e lo stesso storico, ma porta gli xG agganciati da
 * Understat. Si filtra ai cinque campionati del dataset originale, cosi il
 * confronto con le misure precedenti resta a parita di universo.
 */
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");
const LEGHE = new Set(["E0", "I1", "SP1", "D1", "F1"]);
const RAW_DIR = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/raw");
const OUT_DIR = join(ROOT, "audit");
const LINE = 2.5;

const TUNE_TRAIN = ["1920", "2021", "2122"];
const TUNE_VALIDATE = "2223";
const BLIND = ["2324", "2425"];

function log(m: string): void {
  process.stdout.write(`[${new Date().toISOString()}] ${m}\n`);
}

/** Opening and closing Over/Under 2.5 prices, keyed to the normalized rows. */
type TotalsQuote = {
  open_over: number | null;
  open_under: number | null;
  close_over: number | null;
  close_under: number | null;
};

function parseCsvDate(d: string): string | null {
  const t = d.trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const yy = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${yy}-${m[2]}-${m[1]}`;
}

function numOrNull(v: string | undefined): number | null {
  if (v == null) return null;
  const x = Number(v.trim());
  return Number.isFinite(x) && x > 1.01 ? x : null;
}

function loadTotalsQuotes(): Map<string, TotalsQuote> {
  const out = new Map<string, TotalsQuote>();
  for (const f of readdirSync(RAW_DIR).filter((x) => x.endsWith(".csv"))) {
    const text = readFileSync(join(RAW_DIR, f), "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) continue;
    const header = lines[0]!.replace(/^﻿/, "").split(",");
    const ix = (name: string) => header.indexOf(name);
    const iDiv = ix("Div");
    const iDate = ix("Date");
    const iHome = ix("HomeTeam");
    const iAway = ix("AwayTeam");
    const iBO = ix("B365>2.5");
    const iBU = ix("B365<2.5");
    const iPO = ix("P>2.5");
    const iPU = ix("P<2.5");
    // True closing O/U columns. Pinnacle closing (PC) is the sharp reference for
    // CLV; Bet365 closing (B365C) is the fallback. Max>2.5 is the best price
    // ACROSS books, not a closing line — de-vigging two maxima yields an
    // overround below 1 and fabricates CLV, so it is never used here.
    const iMO = ix("PC>2.5") >= 0 ? ix("PC>2.5") : ix("B365C>2.5");
    const iMU = ix("PC<2.5") >= 0 ? ix("PC<2.5") : ix("B365C<2.5");
    const iFO = ix("B365C>2.5");
    const iFU = ix("B365C<2.5");
    for (let i = 1; i < lines.length; i += 1) {
      const c = lines[i]!.split(",");
      const date = parseCsvDate(c[iDate] ?? "");
      if (!date) continue;
      const key = `${(c[iDiv] ?? "").trim()}|${date}|${(c[iHome] ?? "").trim()}|${(c[iAway] ?? "").trim()}`;
      out.set(key, {
        open_over: numOrNull(c[iBO]) ?? numOrNull(c[iPO]),
        open_under: numOrNull(c[iBU]) ?? numOrNull(c[iPU]),
        close_over: numOrNull(c[iMO]) ?? numOrNull(c[iFO]),
        close_under: numOrNull(c[iMU]) ?? numOrNull(c[iFU]),
      });
    }
  }
  return out;
}

function quoteKey(m: PiMatchRow): string {
  return `${m.league}|${m.match_date}|${m.home_team}|${m.away_team}`;
}

function devig2(over: number, under: number): { over: number; under: number; overround: number } {
  const io = 1 / over;
  const iu = 1 / under;
  const s = io + iu;
  return { over: io / s, under: iu / s, overround: s };
}

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
    for (const e of this.byLeague.values()) for (const m of e.rows) if (m.season === season) out.push(m);
    return out.sort((a, b) => (a.event_time < b.event_time ? -1 : 1));
  }
}

type Row = {
  p_model: number; // P(over)
  p_market: number; // P(over) de-vigged
  over: boolean; // outcome
  open_over: number;
  open_under: number;
  close_over: number | null;
  close_under: number | null;
  overround: number;
};

function scoreSeason(input: {
  season: string;
  index: LeagueIndex;
  quotes: Map<string, TotalsQuote>;
  params: StrengthDcParams;
  temperature: number;
}): { rows: Row[]; fits: number } {
  const cache = new StrengthFitCache((lg, cut) => input.index.priors(lg, cut), input.params);
  const rows: Row[] = [];
  for (const m of input.index.seasonRows(input.season)) {
    const q = input.quotes.get(quoteKey(m));
    if (!q?.open_over || !q.open_under) continue;
    const fit = cache.get(m.league, featureCutoffForMatch(m));
    if (!fit.supported) continue;
    const pred = predictTotalsStrengthDc({
      fit,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      line: LINE,
      params: input.params,
    });
    const mk = devig2(q.open_over, q.open_under);
    rows.push({
      p_model: applyBinaryTemperature(pred.p_over, input.temperature),
      p_market: mk.over,
      over: m.fthg + m.ftag > LINE,
      open_over: q.open_over,
      open_under: q.open_under,
      close_over: q.close_over,
      close_under: q.close_under,
      overround: mk.overround,
    });
  }
  return { rows, fits: cache.size };
}

function binaryMetrics(rows: Row[], pick: (r: Row) => number): {
  log_loss: number;
  brier: number;
  accuracy: number;
  n: number;
} {
  if (!rows.length) return { log_loss: 999, brier: 999, accuracy: 0, n: 0 };
  let ll = 0;
  let br = 0;
  let hit = 0;
  for (const r of rows) {
    const p = Math.min(1 - 1e-12, Math.max(1e-12, pick(r)));
    const y = r.over ? 1 : 0;
    ll += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    br += (p - y) ** 2;
    if ((p >= 0.5 ? 1 : 0) === y) hit += 1;
  }
  return { log_loss: ll / rows.length, brier: br / rows.length, accuracy: hit / rows.length, n: rows.length };
}

function pairedBootstrap(rows: Row[], iters = 3000): {
  mean_diff: number;
  ci_low: number;
  ci_high: number;
  p_model_better: number;
} {
  const d = rows.map((r) => {
    const y = r.over ? 1 : 0;
    const a = Math.min(1 - 1e-12, Math.max(1e-12, r.p_model));
    const b = Math.min(1 - 1e-12, Math.max(1e-12, r.p_market));
    const la = -(y * Math.log(a) + (1 - y) * Math.log(1 - a));
    const lb = -(y * Math.log(b) + (1 - y) * Math.log(1 - b));
    return la - lb;
  });
  const r = sharedPairedBootstrap(d, { iters, seed: 991 });
  return { mean_diff: r.mean_diff, ci_low: r.ci_low, ci_high: r.ci_high, p_model_better: r.p_first_better };
}

function betting(rows: Row[], edge: number): {
  n_bets: number;
  yield: number;
  mean_clv_pct: number;
  beat_close_rate: number;
  clv_n: number;
} {
  let n = 0;
  let pnl = 0;
  let clvSum = 0;
  let clvN = 0;
  let beat = 0;
  for (const r of rows) {
    const eOver = r.p_model - r.p_market;
    const eUnder = (1 - r.p_model) - (1 - r.p_market);
    const takeOver = eOver >= edge;
    const takeUnder = eUnder >= edge;
    if (!takeOver && !takeUnder) continue;
    const o = takeOver ? r.open_over : r.open_under;
    const won = takeOver ? r.over : !r.over;
    n += 1;
    pnl += won ? o - 1 : -1;
    // devig2 always takes (over, under) in that order — passing the taken side
    // first would compare an Under price against the fair Over probability.
    if (r.close_over && r.close_under) {
      const fair = devig2(r.close_over, r.close_under);
      const fairOdds = 1 / (takeOver ? fair.over : fair.under);
      const c = o / fairOdds - 1;
      clvSum += c;
      clvN += 1;
      if (c > 0) beat += 1;
    }
  }
  return {
    n_bets: n,
    yield: n ? pnl / n : 0,
    mean_clv_pct: clvN ? (clvSum / clvN) * 100 : 0,
    beat_close_rate: clvN ? beat / clvN : 0,
    clv_n: clvN,
  };
}

const STATE = join(OUT_DIR, ".totals-dc-state.json");

function main(): void {
  const stage = process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1] ?? "all";
  const seasonArg = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1];
  const all = (readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow))
    .filter((m) => LEGHE.has(String(m.league)))
    .sort(
    (a, b) => (a.event_time < b.event_time ? -1 : 1),
  );
  const quotes = loadTotalsQuotes();
  log(`${all.length} partite, ${quotes.size} righe di quote O/U caricate`);

  // ---- tuning on <=2122 validated on 2223 ----
  let finalParams: StrengthDcParams;
  let temperature: number;
  let tuningTrials: { half_life_days: number; sot_weight: number; xg_weight: number; shrinkage: number; log_loss: number; temperature: number }[] = [];

  if (stage === "tune" || stage === "all") {
  const tuneIdx = new LeagueIndex(all.filter((m) => [...TUNE_TRAIN, TUNE_VALIDATE].includes(m.season)));
  type Trial = { params: StrengthDcParams; temperature: number; log_loss: number };
  const trials: Trial[] = [];
  log("tuning (half-life x xgWeight x shrinkage) sul target TOTALI");
  for (const halfLifeDays of [110, 150, 220, 320]) {
    for (const xgWeight of [0, 0.9]) {
      for (const shrinkage of [4, 9]) {
      const sotWeight = 0.7;
      const params: StrengthDcParams = {
        ...DEFAULT_STRENGTH_DC,
        halfLifeDays,
        sotWeight,
        xgWeight,
        shrinkage,
        rho: -0.12,
        iterations: 30,
      };
      const s = scoreSeason({ season: TUNE_VALIDATE, index: tuneIdx, quotes, params, temperature: 1 });
      let bestT = 1;
      let bestLL = Infinity;
      for (const T of [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6]) {
        const m = binaryMetrics(s.rows, (r) => applyBinaryTemperature(r.p_model, T));
        if (m.log_loss < bestLL) {
          bestLL = m.log_loss;
          bestT = T;
        }
      }
      trials.push({ params, temperature: bestT, log_loss: bestLL });
      log(`  hl=${halfLifeDays} xg=${xgWeight} k=${shrinkage} -> ll=${bestLL.toFixed(5)} T=${bestT} (n=${s.rows.length})`);
      }
    }
  }
  const best = trials.reduce((a, b) => (a.log_loss <= b.log_loss ? a : b));
  finalParams = { ...best.params, iterations: 60 };
  temperature = best.temperature;
  tuningTrials = trials.map((t) => ({
    half_life_days: t.params.halfLifeDays,
    sot_weight: t.params.sotWeight,
    xg_weight: t.params.xgWeight,
    shrinkage: t.params.shrinkage,
    log_loss: t.log_loss,
    temperature: t.temperature,
  }));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(STATE, JSON.stringify({ finalParams, temperature, tuningTrials, seasons: {} }, null, 2));
  log(`SELECTED hl=${finalParams.halfLifeDays} xg=${finalParams.xgWeight} k=${finalParams.shrinkage} T=${temperature} (val ll=${best.log_loss.toFixed(5)})`);
  if (stage === "tune") return;
  } else {
    const st = JSON.parse(readFileSync(STATE, "utf8")) as {
      finalParams: StrengthDcParams;
      temperature: number;
      tuningTrials: typeof tuningTrials;
    };
    finalParams = st.finalParams;
    temperature = st.temperature;
    tuningTrials = st.tuningTrials;
  }

  const stateNow = JSON.parse(readFileSync(STATE, "utf8")) as { seasons: Record<string, unknown> };
  const report: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    market: `over_under_${LINE}`,
    protocol: { tune_train: TUNE_TRAIN, tune_validate: TUNE_VALIDATE, blind: BLIND },
    selected_params: finalParams,
    temperature,
    tuning_trials: tuningTrials,
  };

  const seasonsToRun = stage === "eval" && seasonArg ? [seasonArg] : BLIND;
  for (const season of seasonsToRun) {
    const idx = new LeagueIndex(all.filter((m) => m.season <= season));
    const s = scoreSeason({ season, index: idx, quotes, params: finalParams, temperature });
    const mModel = binaryMetrics(s.rows, (r) => r.p_model);
    const mMarket = binaryMetrics(s.rows, (r) => r.p_market);
    const boot = pairedBootstrap(s.rows);
    const meanOverround = s.rows.reduce((a, r) => a + r.overround, 0) / Math.max(1, s.rows.length);
    const bets = {
      edge_0_02: betting(s.rows, 0.02),
      edge_0_04: betting(s.rows, 0.04),
      edge_0_06: betting(s.rows, 0.06),
    };
    stateNow.seasons[season] = {
      n: mModel.n,
      mean_overround: meanOverround,
      metrics: { strength_dc: mModel, market_devig: mMarket },
      delta_vs_market: { log_loss: mModel.log_loss - mMarket.log_loss, bootstrap: boot },
      betting: bets,
    };
    report[`season_${season}`] = {
      n: mModel.n,
      fits: s.fits,
      mean_overround: meanOverround,
      metrics: { strength_dc: mModel, market_devig: mMarket },
      delta_vs_market: { log_loss: mModel.log_loss - mMarket.log_loss, bootstrap: boot },
      betting: bets,
    };
    log(`--- ${season}: n=${mModel.n} overround medio=${meanOverround.toFixed(4)}`);
    log(`    STRENGTH_DC ll=${mModel.log_loss.toFixed(5)} brier=${mModel.brier.toFixed(5)} acc=${mModel.accuracy.toFixed(4)}`);
    log(`    MARKET      ll=${mMarket.log_loss.toFixed(5)} brier=${mMarket.brier.toFixed(5)} acc=${mMarket.accuracy.toFixed(4)}`);
    log(`    delta ll=${(mModel.log_loss - mMarket.log_loss).toFixed(5)} p(better)=${boot.p_model_better.toFixed(3)} CI=[${boot.ci_low.toFixed(4)},${boot.ci_high.toFixed(4)}]`);
    for (const k of Object.keys(bets) as (keyof typeof bets)[]) {
      const b = bets[k];
      log(`    ${k}: bets=${b.n_bets} yield=${(b.yield * 100).toFixed(2)}% CLV=${b.mean_clv_pct.toFixed(2)}% beatClose=${(b.beat_close_rate * 100).toFixed(1)}%`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    STATE,
    JSON.stringify({ finalParams, temperature, tuningTrials, seasons: stateNow.seasons }, null, 2),
  );
  const out = join(OUT_DIR, "totals-dc-report.json");
  writeFileSync(out, JSON.stringify({ ...report, seasons: stateNow.seasons }, null, 2));
  log(`report -> ${out}`);
}

main();
