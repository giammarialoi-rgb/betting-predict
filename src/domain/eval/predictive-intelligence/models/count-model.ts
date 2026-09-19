/**
 * COUNT_MODEL — forze attacco/difesa su un conteggio per squadra qualsiasi.
 *
 * Stessa matematica di strength-dc (scaling moltiplicativo pesato su
 * log-verosimiglianza, decadimento esponenziale, shrinkage) applicata a corner,
 * cartellini o tiri invece che ai gol. La differenza sostanziale e la
 * distribuzione: i corner sono sovradispersi rispetto a Poisson (media 9,77,
 * varianza 11,5 sul dataset esteso), quindi il totale si legge da una negativa
 * binomiale con dispersione stimata dai dati, non da una Poisson.
 *
 * CONTRATTO TEMPORALE: il chiamante passa solo campioni gia disponibili prima
 * del cutoff dell'evento da prezzare. Nessuna quota entra mai qui dentro.
 */
import { negBinPmf } from "@/domain/eval/predictive-intelligence/models/negbin";

export type CountSample = {
  home: string;
  away: string;
  homeCount: number;
  awayCount: number;
  /** Istante dell'evento, per il peso di decadimento. */
  timeMs: number;
};

export type CountModelParams = {
  halfLifeDays: number;
  shrinkage: number;
  iterations: number;
  minSamples: number;
  /** Troncamento della distribuzione del totale. */
  maxCount: number;
};

export const DEFAULT_COUNT_MODEL: CountModelParams = {
  halfLifeDays: 180,
  shrinkage: 8,
  iterations: 40,
  minSamples: 60,
  maxCount: 40,
};

export type CountTeam = { attack: number; defence: number; weight: number };

export type CountFit = {
  mu: number;
  gamma: number;
  teams: Map<string, CountTeam>;
  /** Parametro r della negativa binomiale sul TOTALE; null se non sovradisperso. */
  dispersion: number | null;
  mean: number;
  variance: number;
  n: number;
  supported: boolean;
};

function decay(timeMs: number, asOfMs: number, halfLifeDays: number): number {
  const ageDays = (asOfMs - timeMs) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;
  return Math.pow(0.5, ageDays / Math.max(1, halfLifeDays));
}

export function fitCountStrength(input: {
  samples: readonly CountSample[];
  asOfMs: number;
  params?: CountModelParams;
}): CountFit {
  const p = input.params ?? DEFAULT_COUNT_MODEL;
  const rows: { home: string; away: string; ch: number; ca: number; w: number }[] = [];
  let totalWeight = 0;
  for (const s of input.samples) {
    const w = decay(s.timeMs, input.asOfMs, p.halfLifeDays);
    if (w <= 1e-6) continue;
    rows.push({ home: s.home, away: s.away, ch: s.homeCount, ca: s.awayCount, w });
    totalWeight += w;
  }

  const teams = new Map<string, CountTeam>();
  for (const r of rows) {
    if (!teams.has(r.home)) teams.set(r.home, { attack: 1, defence: 1, weight: 0 });
    if (!teams.has(r.away)) teams.set(r.away, { attack: 1, defence: 1, weight: 0 });
    teams.get(r.home)!.weight += r.w;
    teams.get(r.away)!.weight += r.w;
  }

  if (!rows.length) {
    return { mu: 5, gamma: 1.1, teams, dispersion: null, mean: 0, variance: 0, n: 0, supported: false };
  }

  // Momenti pesati sul TOTALE, per la dispersione della negativa binomiale.
  let wSum = 0;
  let wTot = 0;
  for (const r of rows) {
    wSum += r.w * (r.ch + r.ca);
    wTot += r.w;
  }
  const mean = wSum / wTot;
  let wVar = 0;
  for (const r of rows) wVar += r.w * (r.ch + r.ca - mean) ** 2;
  const variance = wVar / wTot;
  // r = mu^2 / (sigma^2 - mu); se non sovradisperso, resta null e si usa Poisson.
  const dispersion = variance > mean * 1.05 ? (mean * mean) / (variance - mean) : null;

  let mu = mean / 2;
  let gamma = 1.1;
  const K = p.shrinkage;

  for (let it = 0; it < p.iterations; it += 1) {
    const aN = new Map<string, number>();
    const aD = new Map<string, number>();
    for (const r of rows) {
      const dh = teams.get(r.home)!.defence;
      const da = teams.get(r.away)!.defence;
      aN.set(r.home, (aN.get(r.home) ?? 0) + r.w * r.ch);
      aD.set(r.home, (aD.get(r.home) ?? 0) + r.w * mu * gamma * da);
      aN.set(r.away, (aN.get(r.away) ?? 0) + r.w * r.ca);
      aD.set(r.away, (aD.get(r.away) ?? 0) + r.w * mu * dh);
    }
    for (const [id, t] of teams) {
      t.attack = Math.max(0.2, Math.min(3, ((aN.get(id) ?? 0) + K) / ((aD.get(id) ?? 0) + K)));
    }

    const dN = new Map<string, number>();
    const dD = new Map<string, number>();
    for (const r of rows) {
      const ah = teams.get(r.home)!.attack;
      const aa = teams.get(r.away)!.attack;
      dN.set(r.home, (dN.get(r.home) ?? 0) + r.w * r.ca);
      dD.set(r.home, (dD.get(r.home) ?? 0) + r.w * mu * aa);
      dN.set(r.away, (dN.get(r.away) ?? 0) + r.w * r.ch);
      dD.set(r.away, (dD.get(r.away) ?? 0) + r.w * mu * gamma * ah);
    }
    for (const [id, t] of teams) {
      t.defence = Math.max(0.2, Math.min(3, ((dN.get(id) ?? 0) + K) / ((dD.get(id) ?? 0) + K)));
    }

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

    let gN = 0;
    let gD = 0;
    let tN = 0;
    let tD = 0;
    for (const r of rows) {
      const ah = teams.get(r.home)!.attack;
      const dh = teams.get(r.home)!.defence;
      const aa = teams.get(r.away)!.attack;
      const da = teams.get(r.away)!.defence;
      gN += r.w * r.ch;
      gD += r.w * mu * ah * da;
      tN += r.w * (r.ch + r.ca);
      tD += r.w * (gamma * ah * da + aa * dh);
    }
    if (gD > 0) gamma = Math.max(0.6, Math.min(2.2, (gN + K) / (gD + K)));
    if (tD > 0) mu = Math.max(0.5, Math.min(20, tN / tD));
  }

  return {
    mu,
    gamma,
    teams,
    dispersion,
    mean,
    variance,
    n: rows.length,
    supported: rows.length >= p.minSamples,
  };
}

export function lambdasFromCountFit(
  fit: CountFit,
  homeId: string,
  awayId: string,
): { lambda_home: number; lambda_away: number; lambda_total: number } {
  const h = fit.teams.get(homeId) ?? { attack: 1, defence: 1, weight: 0 };
  const a = fit.teams.get(awayId) ?? { attack: 1, defence: 1, weight: 0 };
  const lh = Math.max(0.3, fit.mu * fit.gamma * h.attack * a.defence);
  const la = Math.max(0.3, fit.mu * a.attack * h.defence);
  return { lambda_home: lh, lambda_away: la, lambda_total: lh + la };
}

/** Distribuzione del TOTALE: negativa binomiale se sovradisperso, altrimenti Poisson. */
export function totalCountDistribution(
  lambdaTotal: number,
  dispersion: number | null,
  maxCount = DEFAULT_COUNT_MODEL.maxCount,
): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let k = 0; k <= maxCount; k += 1) {
    let v: number;
    if (dispersion != null && dispersion > 0) {
      v = negBinPmf(k, lambdaTotal, dispersion);
    } else {
      let f = 1;
      for (let i = 2; i <= k; i += 1) f *= i;
      v = (Math.exp(-lambdaTotal) * lambdaTotal ** k) / f;
    }
    out.push(v);
    sum += v;
  }
  if (sum > 0) for (let i = 0; i < out.length; i += 1) out[i] = out[i]! / sum;
  return out;
}

export function predictCountOverUnder(input: {
  fit: CountFit;
  homeId: string;
  awayId: string;
  line: number;
  params?: CountModelParams;
}): { p_over: number; p_under: number; lambda_total: number; lambda_home: number; lambda_away: number } {
  const p = input.params ?? DEFAULT_COUNT_MODEL;
  if (Number.isInteger(input.line)) {
    throw new Error(`linea intera non supportata (${input.line}): darebbe rimborso, non un esito binario`);
  }
  const l = lambdasFromCountFit(input.fit, input.homeId, input.awayId);
  const dist = totalCountDistribution(l.lambda_total, input.fit.dispersion, p.maxCount);
  let over = 0;
  for (let k = 0; k < dist.length; k += 1) if (k > input.line) over += dist[k]!;
  return {
    p_over: Math.min(1, Math.max(0, over)),
    p_under: Math.min(1, Math.max(0, 1 - over)),
    lambda_total: l.lambda_total,
    lambda_home: l.lambda_home,
    lambda_away: l.lambda_away,
  };
}

/** Chi ne ottiene di piu: mercato "corner 1X2". Conteggi indipendenti condizionati alle medie. */
export function predictCountWinner(input: {
  fit: CountFit;
  homeId: string;
  awayId: string;
  params?: CountModelParams;
}): { HOME: number; DRAW: number; AWAY: number } {
  const p = input.params ?? DEFAULT_COUNT_MODEL;
  const l = lambdasFromCountFit(input.fit, input.homeId, input.awayId);
  const r = input.fit.dispersion;
  const pmf = (k: number, lam: number) => {
    if (r != null && r > 0) return negBinPmf(k, lam, r * (lam / Math.max(1e-9, input.fit.mean)));
    let f = 1;
    for (let i = 2; i <= k; i += 1) f *= i;
    return (Math.exp(-lam) * lam ** k) / f;
  };
  let H = 0;
  let D = 0;
  let A = 0;
  for (let h = 0; h <= p.maxCount; h += 1) {
    const ph = pmf(h, l.lambda_home);
    for (let a = 0; a <= p.maxCount; a += 1) {
      const c = ph * pmf(a, l.lambda_away);
      if (h > a) H += c;
      else if (h === a) D += c;
      else A += c;
    }
  }
  const s = H + D + A;
  return s > 0 ? { HOME: H / s, DRAW: D / s, AWAY: A / s } : { HOME: 1 / 3, DRAW: 1 / 3, AWAY: 1 / 3 };
}
