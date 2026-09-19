/**
 * Dove il modello regge, lega per lega.
 *
 * L'universo di proposta deve coincidere con l'universo che il modello sa
 * prezzare. Questo script lo misura: STRENGTH_DC contro il mercato de-viggato
 * su ogni divisione, stagione di holdout, con gli iperparametri gia scelti sullo
 * split di taratura delle 5 leghe originali (nessuna ri-taratura per lega: sarebbe
 * sovradattamento su 22 campioni).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  predictStrengthDc,
  type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { applyTemperature } from "@/domain/eval/predictive-intelligence/models/temperature";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import { computeMetrics } from "@/domain/eval/predictive-intelligence/validation/metrics";
import type { PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");
const OUT = join(ROOT, "audit", "league-coverage-report.json");
const SEASON = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1] ?? "2324";

const NAMES: Record<string, string> = {
  E0: "Premier League", E1: "Championship", E2: "League One", E3: "League Two", EC: "National League",
  SC0: "Scozia Premiership", SC1: "Scozia Champ.", SC2: "Scozia Lg One", SC3: "Scozia Lg Two",
  D1: "Bundesliga", D2: "2. Bundesliga", SP1: "La Liga", SP2: "La Liga 2",
  I1: "Serie A", I2: "Serie B", F1: "Ligue 1", F2: "Ligue 2",
  N1: "Eredivisie", B1: "Belgio Pro League", P1: "Primeira Liga",
  T1: "Turchia Super Lig", G1: "Grecia Super League",
};

const PARAMS: StrengthDcParams = {
  ...DEFAULT_STRENGTH_DC, halfLifeDays: 150, shrinkage: 9, rho: -0.12, sotWeight: 0.8, iterations: 60,
};
const TEMPERATURE = 0.7;

function main(): void {
  const all = readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow);
  const universe = all.filter((m) => m.season <= SEASON).sort((a, b) => (a.event_time < b.event_time ? -1 : 1));

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
  const cache = new StrengthFitCache(priors, PARAMS);

  const rows: { league: string; name: string; n: number; model: number; market: number; delta: number; overround: number }[] = [];
  for (const [league, list] of byLeague) {
    const target = list.filter((m) => m.season === SEASON);
    const mm: { p: PiProb3; y: PiMatchRow["ftr"] }[] = [];
    const kk: { p: PiProb3; y: PiMatchRow["ftr"] }[] = [];
    let orr = 0;
    for (const m of target) {
      const pM = marketBaselineFromOpenOdds(m);
      if (!pM) continue;
      const t = m.odds_open.B365.home != null ? m.odds_open.B365 : m.odds_open.Avg;
      if (t.home && t.draw && t.away) orr += 1 / t.home + 1 / t.draw + 1 / t.away;
      const fit = cache.get(league, featureCutoffForMatch(m));
      if (!fit.supported) continue;
      const p = predictStrengthDc({ fit, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id, params: PARAMS });
      mm.push({ p: applyTemperature(p.probability, TEMPERATURE), y: m.ftr });
      kk.push({ p: pM, y: m.ftr });
    }
    if (mm.length < 100) continue;
    const a = computeMetrics(mm);
    const b = computeMetrics(kk);
    rows.push({
      league, name: NAMES[league] ?? league, n: a.n,
      model: a.log_loss, market: b.log_loss, delta: a.log_loss - b.log_loss,
      overround: orr / Math.max(1, mm.length),
    });
  }

  rows.sort((x, y) => x.delta - y.delta);
  process.stdout.write(`\nStagione ${SEASON} — STRENGTH_DC contro il mercato, per lega\n`);
  process.stdout.write(`(delta negativo = il modello BATTE il mercato)\n\n`);
  process.stdout.write(`${"div".padEnd(5)} ${"lega".padEnd(20)} ${"n".padStart(6)} ${"modello".padStart(9)} ${"mercato".padStart(9)} ${"delta".padStart(9)} ${"margine".padStart(9)}\n`);
  process.stdout.write("-".repeat(72) + "\n");
  for (const r of rows) {
    const flag = r.delta < 0 ? "  <<<" : "";
    process.stdout.write(
      `${r.league.padEnd(5)} ${r.name.padEnd(20)} ${String(r.n).padStart(6)} ${r.model.toFixed(5).padStart(9)} ${r.market.toFixed(5).padStart(9)} ${(r.delta >= 0 ? "+" : "") + r.delta.toFixed(5)} ${((r.overround - 1) * 100).toFixed(2).padStart(8)}%${flag}\n`,
    );
  }
  const wins = rows.filter((r) => r.delta < 0);
  process.stdout.write("-".repeat(72) + "\n");
  process.stdout.write(`leghe valutate: ${rows.length}   in cui il modello batte il mercato: ${wins.length}\n`);
  writeFileSync(OUT, JSON.stringify({ season: SEASON, params: PARAMS, temperature: TEMPERATURE, leagues: rows }, null, 2));
  process.stdout.write(`-> ${OUT}\n`);
}

main();
