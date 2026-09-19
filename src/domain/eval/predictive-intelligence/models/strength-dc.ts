/**
 * STRENGTH_DC — Dixon–Coles with time-decayed attack/defence strengths.
 *
 * Replaces the rolling goal-average lambdas (features/goal-rates.ts,
 * poisson-independent.ts) with a proper weighted-MLE team strength fit:
 *
 *   lambda_home = mu * gamma * attack[home] * defence[away]
 *   lambda_away = mu        * attack[away] * defence[home]
 *
 * Fitted per league by iterative multiplicative scaling on the weighted
 * Poisson log-likelihood, with exponential time decay. Opponent-adjusted by
 * construction: beating a strong defence raises attack more than beating a
 * weak one.
 *
 * TEMPORAL CONTRACT: the caller passes only matches whose result_available_at
 * is strictly before the target's feature cutoff (priorMatchesAsOf). No odds,
 * no market input, ever — this is an INDEPENDENT model.
 */
import { poissonPmf } from "@/domain/eval/poisson-baseline";
import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

export const STRENGTH_DC_MODEL_ID = "INDEPENDENT_STRENGTH_DC_v1";

export type StrengthDcParams = {
  /** Exponential decay half-life in days for match weights. */
  halfLifeDays: number;
  /** Dixon–Coles low-score dependence parameter. */
  rho: number;
  /** Pseudo-observations (in expected-goal units) shrinking a team to league mean. */
  shrinkage: number;
  /** 0 = fit on goals only, 1 = fit on shots-on-target proxy only. */
  sotWeight: number;
  /** Score matrix truncation. */
  maxGoals: number;
  /** Iterative scaling sweeps. */
  iterations: number;
  /** Minimum weighted matches in a league fit before the model claims support. */
  minMatches: number;
};

export const DEFAULT_STRENGTH_DC: StrengthDcParams = {
  halfLifeDays: 180,
  rho: -0.06,
  shrinkage: 6,
  sotWeight: 0.35,
  maxGoals: 10,
  iterations: 60,
  minMatches: 80,
};

export type TeamStrength = {
  attack: number;
  defence: number;
  weight: number;
};

export type LeagueStrengthFit = {
  league: string;
  mu: number;
  gamma: number;
  teams: Map<string, TeamStrength>;
  n: number;
  totalWeight: number;
  conversionRate: number;
  supported: boolean;
  /** Baseline e vantaggio casa per divisione, quando il fit e cross-divisione. */
  perDivision?: Map<string, { mu: number; gamma: number }>;
};

/** Blend actual goals with a self-calibrated shots-on-target expectation. */
function targetGoals(
  goals: number,
  sot: number | null,
  conversionRate: number,
  sotWeight: number,
): number {
  if (sot == null || !Number.isFinite(sot) || sotWeight <= 0) return goals;
  return (1 - sotWeight) * goals + sotWeight * (conversionRate * sot);
}

/**
 * Peso di decadimento, con taglio netto oltre otto emivite.
 *
 * A quel punto il peso e sotto lo 0,4% e il contributo e trascurabile, mentre il
 * costo di calcolo no: su un fit cross-divisione la coda vecchia era la maggior
 * parte delle righe. Tagliarla rende il fit praticabile senza cambiare il
 * risultato in modo apprezzabile.
 */
function decayWeight(matchMs: number, asOfMs: number, halfLifeDays: number): number {
  const ageDays = (asOfMs - matchMs) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;
  if (ageDays > halfLifeDays * 8) return 0;
  return Math.pow(0.5, ageDays / Math.max(1, halfLifeDays));
}

/**
 * Weighted Poisson MLE for attack/defence/home-advantage by iterative scaling.
 * `matches` MUST already be as-of filtered and single-league.
 */
/**
 * Fit CROSS-DIVISIONE: un solo insieme di forze squadra, un baseline e un
 * vantaggio casa per ciascuna divisione.
 *
 * Nasce da una debolezza misurata. Con un fit per divisione, una squadra appena
 * promossa o retrocessa non ha storico nel campionato di destinazione e lo
 * shrinkage la riporta alla media di lega, che e quasi sempre sbagliata. Il
 * divario dal mercato passa da +0,0154 quando entrambe hanno storico a +0,0224
 * con una nuova e +0,0455 con due. Sono il 22% delle partite.
 *
 * Poiche le forze sono gia aggiustate per l'avversario, il rating di una squadra
 * e confrontabile fra divisioni: un attacco che segna contro difese di Serie B
 * viene valutato per le difese che ha incontrato. La differenza di livello fra
 * campionati finisce nel baseline mu di ciascuna divisione, e le squadre che si
 * spostano fanno da ponte fra i due insiemi.
 */
export function fitCrossDivisionStrength(input: {
  matches: readonly PiMatchRow[];
  asOfIso: string;
  params?: StrengthDcParams;
}): LeagueStrengthFit {
  const p = input.params ?? DEFAULT_STRENGTH_DC;
  const asOfMs = Date.parse(input.asOfIso);

  let wGoals = 0;
  let wSot = 0;
  for (const m of input.matches) {
    const w = decayWeight(Date.parse(m.event_time), asOfMs, p.halfLifeDays);
    if (w <= 1e-6) continue;
    if (m.hst != null && m.ast != null) {
      wGoals += w * (m.fthg + m.ftag);
      wSot += w * (m.hst + m.ast);
    }
  }
  const conversionRate = wSot > 0 ? wGoals / wSot : 0.33;

  type Row = { home: string; away: string; div: string; gh: number; ga: number; w: number };
  const rows: Row[] = [];
  let totalWeight = 0;
  for (const m of input.matches) {
    const w = decayWeight(Date.parse(m.event_time), asOfMs, p.halfLifeDays);
    if (w <= 1e-6) continue;
    rows.push({
      home: m.home_team_id, away: m.away_team_id, div: m.league,
      gh: targetGoals(m.fthg, m.hst, conversionRate, p.sotWeight),
      ga: targetGoals(m.ftag, m.ast, conversionRate, p.sotWeight),
      w,
    });
    totalWeight += w;
  }

  const teams = new Map<string, TeamStrength>();
  const divs = new Map<string, { mu: number; gamma: number; w: number; goals: number; home: number }>();
  for (const r of rows) {
    if (!teams.has(r.home)) teams.set(r.home, { attack: 1, defence: 1, weight: 0 });
    if (!teams.has(r.away)) teams.set(r.away, { attack: 1, defence: 1, weight: 0 });
    teams.get(r.home)!.weight += r.w;
    teams.get(r.away)!.weight += r.w;
    const d = divs.get(r.div) ?? { mu: 1.3, gamma: 1.2, w: 0, goals: 0, home: 0 };
    d.w += r.w;
    d.goals += r.w * (r.gh + r.ga);
    d.home += r.w * r.gh;
    divs.set(r.div, d);
  }
  for (const d of divs.values()) {
    d.mu = d.w > 0 ? d.goals / (2 * d.w) : 1.3;
    d.gamma = d.goals - d.home > 0 ? d.home / (d.goals - d.home) : 1.2;
  }

  if (!rows.length) {
    return { league: "ALL", mu: 1.35, gamma: 1.2, teams, n: 0, totalWeight: 0, conversionRate, supported: false };
  }

  const K = p.shrinkage;
  for (let it = 0; it < p.iterations; it += 1) {
    const aN = new Map<string, number>();
    const aD = new Map<string, number>();
    for (const r of rows) {
      const d = divs.get(r.div)!;
      const dh = teams.get(r.home)!.defence;
      const da = teams.get(r.away)!.defence;
      aN.set(r.home, (aN.get(r.home) ?? 0) + r.w * r.gh);
      aD.set(r.home, (aD.get(r.home) ?? 0) + r.w * d.mu * d.gamma * da);
      aN.set(r.away, (aN.get(r.away) ?? 0) + r.w * r.ga);
      aD.set(r.away, (aD.get(r.away) ?? 0) + r.w * d.mu * dh);
    }
    for (const [id, t] of teams) {
      t.attack = Math.max(0.15, Math.min(4, ((aN.get(id) ?? 0) + K) / ((aD.get(id) ?? 0) + K)));
    }
    const dN = new Map<string, number>();
    const dD = new Map<string, number>();
    for (const r of rows) {
      const d = divs.get(r.div)!;
      const ah = teams.get(r.home)!.attack;
      const aa = teams.get(r.away)!.attack;
      dN.set(r.home, (dN.get(r.home) ?? 0) + r.w * r.ga);
      dD.set(r.home, (dD.get(r.home) ?? 0) + r.w * d.mu * aa);
      dN.set(r.away, (dN.get(r.away) ?? 0) + r.w * r.gh);
      dD.set(r.away, (dD.get(r.away) ?? 0) + r.w * d.mu * d.gamma * ah);
    }
    for (const [id, t] of teams) {
      t.defence = Math.max(0.15, Math.min(4, ((dN.get(id) ?? 0) + K) / ((dD.get(id) ?? 0) + K)));
    }
    let wa = 0, wd = 0, wt = 0;
    for (const t of teams.values()) { wa += t.weight * t.attack; wd += t.weight * t.defence; wt += t.weight; }
    const ma = wt > 0 ? wa / wt : 1;
    const md = wt > 0 ? wd / wt : 1;
    if (ma > 0 && md > 0) {
      for (const t of teams.values()) { t.attack /= ma; t.defence /= md; }
      for (const d of divs.values()) d.mu *= ma * md;
    }
    // baseline e vantaggio casa, per divisione
    const acc = new Map<string, { gN: number; gD: number; tN: number; tD: number }>();
    for (const r of rows) {
      const d = divs.get(r.div)!;
      const ah = teams.get(r.home)!.attack, dh = teams.get(r.home)!.defence;
      const aa = teams.get(r.away)!.attack, da = teams.get(r.away)!.defence;
      const a = acc.get(r.div) ?? { gN: 0, gD: 0, tN: 0, tD: 0 };
      a.gN += r.w * r.gh;
      a.gD += r.w * d.mu * ah * da;
      a.tN += r.w * (r.gh + r.ga);
      a.tD += r.w * (d.gamma * ah * da + aa * dh);
      acc.set(r.div, a);
    }
    for (const [dv, a] of acc) {
      const d = divs.get(dv)!;
      if (a.gD > 0) d.gamma = Math.max(0.6, Math.min(2.5, (a.gN + K) / (a.gD + K)));
      if (a.tD > 0) d.mu = Math.max(0.3, Math.min(4, a.tN / a.tD));
    }
  }

  const perDivision = new Map<string, { mu: number; gamma: number }>();
  for (const [dv, d] of divs) perDivision.set(dv, { mu: d.mu, gamma: d.gamma });
  const main = [...divs.values()].sort((a, b) => b.w - a.w)[0]!;
  return {
    league: "ALL", mu: main.mu, gamma: main.gamma, teams,
    n: rows.length, totalWeight, conversionRate,
    supported: rows.length >= p.minMatches, perDivision,
  };
}

/** Vista su una divisione specifica di un fit cross-divisione. */
export function viewDivision(fit: LeagueStrengthFit, division: string): LeagueStrengthFit {
  const pd = fit.perDivision?.get(division);
  if (!pd) return fit;
  return { ...fit, league: division, mu: pd.mu, gamma: pd.gamma };
}

export function fitLeagueStrength(input: {
  league: string;
  matches: readonly PiMatchRow[];
  asOfIso: string;
  params?: StrengthDcParams;
}): LeagueStrengthFit {
  const p = input.params ?? DEFAULT_STRENGTH_DC;
  const asOfMs = Date.parse(input.asOfIso);

  const rows: {
    home: string;
    away: string;
    gh: number;
    ga: number;
    w: number;
  }[] = [];

  // Self-calibrate goals-per-shot-on-target on the same weighted window.
  let wGoals = 0;
  let wSot = 0;
  for (const m of input.matches) {
    const w = decayWeight(Date.parse(m.event_time), asOfMs, p.halfLifeDays);
    if (w <= 1e-6) continue;
    if (m.hst != null && m.ast != null) {
      wGoals += w * (m.fthg + m.ftag);
      wSot += w * (m.hst + m.ast);
    }
  }
  const conversionRate = wSot > 0 ? wGoals / wSot : 0.33;

  let totalWeight = 0;
  for (const m of input.matches) {
    const w = decayWeight(Date.parse(m.event_time), asOfMs, p.halfLifeDays);
    if (w <= 1e-6) continue;
    rows.push({
      home: m.home_team_id,
      away: m.away_team_id,
      gh: targetGoals(m.fthg, m.hst, conversionRate, p.sotWeight),
      ga: targetGoals(m.ftag, m.ast, conversionRate, p.sotWeight),
      w,
    });
    totalWeight += w;
  }

  const teams = new Map<string, TeamStrength>();
  for (const r of rows) {
    if (!teams.has(r.home)) teams.set(r.home, { attack: 1, defence: 1, weight: 0 });
    if (!teams.has(r.away)) teams.set(r.away, { attack: 1, defence: 1, weight: 0 });
    teams.get(r.home)!.weight += r.w;
    teams.get(r.away)!.weight += r.w;
  }

  const supported = rows.length >= p.minMatches;
  if (!rows.length) {
    return {
      league: input.league,
      mu: 1.35,
      gamma: 1.2,
      teams,
      n: 0,
      totalWeight: 0,
      conversionRate,
      supported: false,
    };
  }

  // Initial values from weighted marginals.
  let wSumGoals = 0;
  let wSumHome = 0;
  for (const r of rows) {
    wSumGoals += r.w * (r.gh + r.ga);
    wSumHome += r.w * r.gh;
  }
  let mu = wSumGoals / (2 * totalWeight);
  let gamma = wSumHome > 0 ? wSumHome / Math.max(1e-9, wSumGoals - wSumHome) : 1.2;
  const K = p.shrinkage;

  for (let it = 0; it < p.iterations; it += 1) {
    // --- attack sweep ---
    const attNum = new Map<string, number>();
    const attDen = new Map<string, number>();
    for (const r of rows) {
      const dh = teams.get(r.home)!.defence;
      const da = teams.get(r.away)!.defence;
      attNum.set(r.home, (attNum.get(r.home) ?? 0) + r.w * r.gh);
      attDen.set(r.home, (attDen.get(r.home) ?? 0) + r.w * mu * gamma * da);
      attNum.set(r.away, (attNum.get(r.away) ?? 0) + r.w * r.ga);
      attDen.set(r.away, (attDen.get(r.away) ?? 0) + r.w * mu * dh);
    }
    for (const [id, t] of teams) {
      const num = (attNum.get(id) ?? 0) + K;
      const den = (attDen.get(id) ?? 0) + K;
      t.attack = den > 0 ? Math.max(0.15, Math.min(4, num / den)) : 1;
    }

    // --- defence sweep ---
    const defNum = new Map<string, number>();
    const defDen = new Map<string, number>();
    for (const r of rows) {
      const ah = teams.get(r.home)!.attack;
      const aa = teams.get(r.away)!.attack;
      // home team concedes r.ga, produced by away attack with no home bonus
      defNum.set(r.home, (defNum.get(r.home) ?? 0) + r.w * r.ga);
      defDen.set(r.home, (defDen.get(r.home) ?? 0) + r.w * mu * aa);
      // away team concedes r.gh, produced by home attack WITH home bonus
      defNum.set(r.away, (defNum.get(r.away) ?? 0) + r.w * r.gh);
      defDen.set(r.away, (defDen.get(r.away) ?? 0) + r.w * mu * gamma * ah);
    }
    for (const [id, t] of teams) {
      const num = (defNum.get(id) ?? 0) + K;
      const den = (defDen.get(id) ?? 0) + K;
      t.defence = den > 0 ? Math.max(0.15, Math.min(4, num / den)) : 1;
    }

    // --- identifiability: weighted mean(attack) = mean(defence) = 1 ---
    let wa = 0;
    let wd = 0;
    let wt = 0;
    for (const t of teams.values()) {
      wa += t.weight * t.attack;
      wd += t.weight * t.defence;
      wt += t.weight;
    }
    const ma = wt > 0 ? wa / wt : 1;
    const md = wt > 0 ? wd / wt : 1;
    if (ma > 0 && md > 0) {
      for (const t of teams.values()) {
        t.attack /= ma;
        t.defence /= md;
      }
      mu *= ma * md;
    }

    // --- home advantage + baseline ---
    let ghNum = 0;
    let ghDen = 0;
    let allNum = 0;
    let allDen = 0;
    for (const r of rows) {
      const ah = teams.get(r.home)!.attack;
      const dh = teams.get(r.home)!.defence;
      const aa = teams.get(r.away)!.attack;
      const da = teams.get(r.away)!.defence;
      ghNum += r.w * r.gh;
      ghDen += r.w * mu * ah * da;
      allNum += r.w * (r.gh + r.ga);
      allDen += r.w * (gamma * ah * da + aa * dh);
    }
    if (ghDen > 0) gamma = Math.max(0.6, Math.min(2.5, (ghNum + K) / (ghDen + K)));
    if (allDen > 0) mu = Math.max(0.3, Math.min(4, allNum / allDen));
  }

  return {
    league: input.league,
    mu,
    gamma,
    teams,
    n: rows.length,
    totalWeight,
    conversionRate,
    supported,
  };
}

/** Dixon–Coles low-score dependence factor. */
function tau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return Math.max(0.01, 1 - lh * la * rho);
  if (h === 0 && a === 1) return Math.max(0.01, 1 + lh * rho);
  if (h === 1 && a === 0) return Math.max(0.01, 1 + la * rho);
  if (h === 1 && a === 1) return Math.max(0.01, 1 - rho);
  return 1;
}

export type StrengthDcPrediction = {
  probability: PiProb3;
  lambda_home: number;
  lambda_away: number;
  attack_home: number;
  defence_home: number;
  attack_away: number;
  defence_away: number;
  mu: number;
  gamma: number;
  supported: boolean;
};

export function lambdasFromFit(
  fit: LeagueStrengthFit,
  homeTeamId: string,
  awayTeamId: string,
): { lambda_home: number; lambda_away: number; home: TeamStrength; away: TeamStrength } {
  const home = fit.teams.get(homeTeamId) ?? { attack: 1, defence: 1, weight: 0 };
  const away = fit.teams.get(awayTeamId) ?? { attack: 1, defence: 1, weight: 0 };
  return {
    lambda_home: Math.max(0.15, fit.mu * fit.gamma * home.attack * away.defence),
    lambda_away: Math.max(0.15, fit.mu * away.attack * home.defence),
    home,
    away,
  };
}

export function predictStrengthDc(input: {
  fit: LeagueStrengthFit;
  homeTeamId: string;
  awayTeamId: string;
  params?: StrengthDcParams;
}): StrengthDcPrediction {
  const p = input.params ?? DEFAULT_STRENGTH_DC;
  const { lambda_home, lambda_away, home, away } = lambdasFromFit(
    input.fit,
    input.homeTeamId,
    input.awayTeamId,
  );

  let H = 0;
  let D = 0;
  let A = 0;
  for (let h = 0; h <= p.maxGoals; h += 1) {
    const ph = poissonPmf(h, lambda_home);
    for (let a = 0; a <= p.maxGoals; a += 1) {
      const cell = ph * poissonPmf(a, lambda_away) * tau(h, a, lambda_home, lambda_away, p.rho);
      if (h > a) H += cell;
      else if (h === a) D += cell;
      else A += cell;
    }
  }

  return {
    probability: normalizeProb3(H, D, A),
    lambda_home,
    lambda_away,
    attack_home: home.attack,
    defence_home: home.defence,
    attack_away: away.attack,
    defence_away: away.defence,
    mu: input.fit.mu,
    gamma: input.fit.gamma,
    supported: input.fit.supported,
  };
}

/**
 * Full joint distribution over exact scorelines. Everything derived from the
 * same match — 1X2, totals, both-teams-to-score, multigol, correct score,
 * European handicap and any combination of them — must be read off THIS matrix,
 * never by multiplying separate market probabilities together.
 */
export function scoreMatrixStrengthDc(input: {
  fit: LeagueStrengthFit;
  homeTeamId: string;
  awayTeamId: string;
  params?: StrengthDcParams;
}): { matrix: number[][]; lambda_home: number; lambda_away: number; maxGoals: number } {
  const p = input.params ?? DEFAULT_STRENGTH_DC;
  const { lambda_home, lambda_away } = lambdasFromFit(
    input.fit,
    input.homeTeamId,
    input.awayTeamId,
  );
  const matrix: number[][] = [];
  let total = 0;
  for (let h = 0; h <= p.maxGoals; h += 1) {
    const row: number[] = [];
    const ph = poissonPmf(h, lambda_home);
    for (let a = 0; a <= p.maxGoals; a += 1) {
      const cell = ph * poissonPmf(a, lambda_away) * tau(h, a, lambda_home, lambda_away, p.rho);
      row.push(cell);
      total += cell;
    }
    matrix.push(row);
  }
  if (total > 0) {
    for (const row of matrix) {
      for (let i = 0; i < row.length; i += 1) row[i] = row[i]! / total;
    }
  }
  return { matrix, lambda_home, lambda_away, maxGoals: p.maxGoals };
}

/**
 * Totals projection from the same score matrix that produces 1X2.
 * A goals model is structurally better suited to totals than to 1X2: it needs
 * only the sum, not the hardest part of 1X2 (the draw boundary).
 */
export function predictTotalsStrengthDc(input: {
  fit: LeagueStrengthFit;
  homeTeamId: string;
  awayTeamId: string;
  line: number;
  params?: StrengthDcParams;
}): { p_over: number; p_under: number; lambda_home: number; lambda_away: number; lambda_total: number } {
  const p = input.params ?? DEFAULT_STRENGTH_DC;
  const { lambda_home, lambda_away } = lambdasFromFit(
    input.fit,
    input.homeTeamId,
    input.awayTeamId,
  );
  let over = 0;
  let under = 0;
  for (let h = 0; h <= p.maxGoals; h += 1) {
    const ph = poissonPmf(h, lambda_home);
    for (let a = 0; a <= p.maxGoals; a += 1) {
      const cell = ph * poissonPmf(a, lambda_away) * tau(h, a, lambda_home, lambda_away, p.rho);
      if (h + a > input.line) over += cell;
      else under += cell;
    }
  }
  const s = over + under;
  return {
    p_over: s > 0 ? over / s : 0.5,
    p_under: s > 0 ? under / s : 0.5,
    lambda_home,
    lambda_away,
    lambda_total: lambda_home + lambda_away,
  };
}

/** Single-parameter recalibration for a binary probability (temperature on the logit). */
export function applyBinaryTemperature(p: number, temperature: number): number {
  const T = Math.max(0.25, Math.min(4, temperature));
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const a = Math.pow(q, 1 / T);
  const b = Math.pow(1 - q, 1 / T);
  return a / (a + b);
}

/**
 * Fit cache keyed by league + as-of day. Production refits daily, so reusing a
 * single fit for all matches sharing a league/day is exactly the live behaviour
 * and keeps backtests O(days) instead of O(matches).
 */
export type PriorsProvider = (league: string, cutMs: number) => readonly PiMatchRow[];

export class StrengthFitCache {
  private readonly cache = new Map<string, LeagueStrengthFit>();
  private readonly priorsOf: PriorsProvider;

  constructor(
    universe: readonly PiMatchRow[] | PriorsProvider,
    private readonly params: StrengthDcParams = DEFAULT_STRENGTH_DC,
  ) {
    this.priorsOf =
      typeof universe === "function"
        ? universe
        : (league, cutMs) =>
            universe.filter(
              (m) => m.league === league && Date.parse(m.result_available_at) < cutMs,
            );
  }

  get(league: string, featureCutoffIso: string): LeagueStrengthFit {
    const key = `${league}|${featureCutoffIso}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const cut = Date.parse(featureCutoffIso);
    const priors = this.priorsOf(league, cut);
    const fit = fitLeagueStrength({
      league,
      matches: priors,
      asOfIso: featureCutoffIso,
      params: this.params,
    });
    this.cache.set(key, fit);
    return fit;
  }

  get size(): number {
    return this.cache.size;
  }
}
