/**
 * LAB — schedine multi-selezione.
 *
 * (a) Valuta le schedine storiche reali sotto ipotesi esplicite di margine.
 * (b) Scansiona la stagione di holdout per misurare quanto vale la correlazione
 *     fra selezioni della stessa partita, cioe quanto regala un book che le
 *     prezza come indipendenti.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  scoreMatrixStrengthDc,
  type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import {
  evaluateTicket,
  type BonusTier,
  type TicketLeg,
} from "@/domain/eval/predictive-intelligence/models/ticket-ev";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches.jsonl");
const OUT = join(ROOT, "audit", "ticket-ev-report.json");

function log(m: string): void {
  process.stdout.write(`${m}\n`);
}

// ---- (a) schedine storiche reali, quote lette dagli screenshot -------------

const REAL_SLIPS: { name: string; odds: number[]; bonusPct: number; stake: number; payout: number }[] = [
  { name: "2016-04-30  7 eventi", odds: [1.15, 1.29, 1.46, 1.21, 1.08, 1.5, 1.45], bonusPct: 0.18, stake: 50, payout: 363.21 },
  { name: "2016-05-02  7 eventi", odds: [1.15, 1.19, 1.14, 1.39, 1.13, 1.49, 1.19], bonusPct: 0.15, stake: 100, payout: 499.66 },
  { name: "2016-04-28 10 eventi", odds: [1.15, 1.1, 1.27, 1.21, 1.14, 1.24, 1.44, 1.19, 1.27, 1.1], bonusPct: 0.33, stake: 100, payout: 874.91 },
  { name: "2017-05-20 13 eventi", odds: [1.3, 1.55, 1.22, 1.5, 1.25, 1.17, 1.15, 1.32, 1.65, 1.33, 1.13, 1.21, 1.3], bonusPct: 0.302, stake: 10, payout: 415.84 },
  { name: "2017-04-02 13 eventi", odds: [1.16, 1.28, 1.33, 1.18, 1.45, 1.4, 1.23, 1.45, 1.3, 1.48, 1.75, 1.38, 1.16], bonusPct: 0.359, stake: 10, payout: 617.99 },
  { name: "2016-04-24 14 eventi", odds: [1.26, 1.72, 2.13, 1.69, 1.49, 1.4, 1.18, 1.47, 1.37, 1.8, 1.26, 1.38, 1.18, 2.0], bonusPct: 0.5, stake: 10, payout: 4284.74 },
];

function evaluateRealSlips(): unknown[] {
  const out: unknown[] = [];
  log("\n=== (a) Le tue schedine, valutate a margine noto ===");
  log(`${"schedina".padEnd(22)} ${"quote".padStart(9)} ${"bonus".padStart(7)} ${"pareggio".padStart(9)} ${"EV@3%".padStart(7)} ${"EV@5%".padStart(7)} ${"EV@7%".padStart(7)} ${"p(vinci)".padStart(9)}`);
  for (const s of REAL_SLIPS) {
    const ladder: BonusTier[] = [{ minLegs: s.odds.length, bonusPct: s.bonusPct }];
    const row: Record<string, number> = {};
    for (const margin of [0.03, 0.05, 0.07]) {
      const legs: TicketLeg[] = s.odds.map((o, i) => ({
        legId: `l${i}`,
        matchId: `m${i}`,
        selection: "1X",
        odds: o,
        modelProb: (1 - margin) / o,
      }));
      const ev = evaluateTicket({ legs, ladder });
      row[`ev_m${Math.round(margin * 100)}`] = ev.ev;
      row.break_even = ev.break_even_margin_per_leg;
      row.p_win = ev.p_win;
      row.product = ev.product_odds;
    }
    log(
      `${s.name.padEnd(22)} ${row.product!.toFixed(2).padStart(9)} ${(100 * s.bonusPct).toFixed(1).padStart(6)}% ${(100 * row.break_even!).toFixed(2).padStart(8)}% ${row.ev_m3!.toFixed(3).padStart(7)} ${row.ev_m5!.toFixed(3).padStart(7)} ${row.ev_m7!.toFixed(3).padStart(7)} ${(100 * row.p_win!).toFixed(2).padStart(8)}%`,
    );
    out.push({ name: s.name, n_legs: s.odds.length, ...row, bonus_pct: s.bonusPct });
  }
  return out;
}

// ---- (b) quanto vale la correlazione sulla stessa partita ------------------

const COMBOS: { name: string; sels: string[] }[] = [
  { name: "1 + Over 2.5", sels: ["1", "O2.5"] },
  { name: "1 + Under 2.5", sels: ["1", "U2.5"] },
  { name: "1 + GG", sels: ["1", "GG"] },
  { name: "1X + Under 3.5", sels: ["1X", "U3.5"] },
  { name: "1X + Over 1.5", sels: ["1X", "O1.5"] },
  { name: "2 + Over 2.5", sels: ["2", "O2.5"] },
  { name: "GG + Over 2.5", sels: ["GG", "O2.5"] },
  { name: "NG + Under 2.5", sels: ["NG", "U2.5"] },
  { name: "Over 3.5 + NG", sels: ["O3.5", "NG"] },
  { name: "1 + MultiGol casa 1-3", sels: ["1", "MG_H_1_3"] },
  { name: "1 + Over 2.5 + GG", sels: ["1", "O2.5", "GG"] },
];

function scanCorrelation(all: PiMatchRow[], season: string, params: StrengthDcParams): unknown {
  const universe = all.filter((m) => m.season <= season);
  const byLeague = new Map<string, PiMatchRow[]>();
  for (const m of universe) {
    const a = byLeague.get(m.league) ?? [];
    a.push(m);
    byLeague.set(m.league, a);
  }
  for (const a of byLeague.values()) {
    a.sort((x, y) => Date.parse(x.result_available_at) - Date.parse(y.result_available_at));
  }
  const priors = (lg: string, cut: number) =>
    (byLeague.get(lg) ?? []).filter((m) => Date.parse(m.result_available_at) < cut);
  const cache = new StrengthFitCache(priors, params);

  const stats = new Map<string, { n: number; ratio: number; joint: number; indep: number }>();
  const target = universe.filter((m) => m.season === season);
  for (const m of target) {
    const fit = cache.get(m.league, featureCutoffForMatch(m));
    if (!fit.supported) continue;
    const { matrix } = scoreMatrixStrengthDc({
      fit,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      params,
    });
    const matrices = new Map([["m", matrix]]);
    for (const c of COMBOS) {
      const legs: TicketLeg[] = c.sels.map((s, i) => ({
        legId: `l${i}`,
        matchId: "m",
        selection: s,
        odds: 2,
      }));
      const ev = evaluateTicket({ legs, matrices });
      const note = ev.correlation[0]!;
      if (note.p_independent <= 0) continue;
      const cur = stats.get(c.name) ?? { n: 0, ratio: 0, joint: 0, indep: 0 };
      cur.n += 1;
      cur.ratio += note.ratio;
      cur.joint += note.p_joint;
      cur.indep += note.p_independent;
      stats.set(c.name, cur);
    }
  }

  log(`\n=== (b) Correlazione stessa partita — stagione ${season}, ${target.length} partite ===`);
  log(`${"combinazione".padEnd(24)} ${"p indip.".padStart(9)} ${"p reale".padStart(9)} ${"rapporto".padStart(9)} ${"valore regalato".padStart(16)}`);
  const rows: unknown[] = [];
  const ordered = [...stats.entries()].sort((a, b) => b[1].ratio / b[1].n - a[1].ratio / a[1].n);
  for (const [name, s] of ordered) {
    const ratio = s.ratio / s.n;
    const pi = s.indep / s.n;
    const pj = s.joint / s.n;
    log(
      `${name.padEnd(24)} ${pi.toFixed(4).padStart(9)} ${pj.toFixed(4).padStart(9)} ${ratio.toFixed(3).padStart(9)} ${((ratio - 1) * 100).toFixed(1).padStart(15)}%`,
    );
    rows.push({ combo: name, n: s.n, p_independent: pi, p_joint: pj, ratio });
  }
  return rows;
}

function main(): void {
  const all = (readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow)).sort(
    (a, b) => (a.event_time < b.event_time ? -1 : 1),
  );
  const params: StrengthDcParams = {
    ...DEFAULT_STRENGTH_DC,
    halfLifeDays: 150,
    shrinkage: 9,
    rho: -0.12,
    sotWeight: 0.8,
    iterations: 60,
  };
  const slips = evaluateRealSlips();
  const corr = scanCorrelation(all, "2324", params);
  mkdirSync(join(ROOT, "audit"), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), real_slips: slips, correlation_scan: corr }, null, 2));
  log(`\nreport -> ${OUT}`);
}

main();
