/**
 * DIAGNOSI — dove il modello perde piu terreno contro il mercato.
 *
 * Il divario medio sull'1X2 e +0,028. Una media nasconde quasi sempre gruppi
 * molto diversi: prima di aggiungere feature conviene sapere QUALI partite
 * pesano. Si ripartisce l'holdout per condizioni note prima del fischio e si
 * misura il divario in ciascun gruppo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC, StrengthFitCache, predictStrengthDc, type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { applyTemperature } from "@/domain/eval/predictive-intelligence/models/temperature";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import { logLossOne } from "@/domain/eval/predictive-intelligence/validation/metrics";
import { pairedBootstrap } from "@/domain/eval/predictive-intelligence/validation/rng";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");
const PARAMS: StrengthDcParams = { ...DEFAULT_STRENGTH_DC, halfLifeDays: 150, shrinkage: 9, rho: -0.12, sotWeight: 0.8, iterations: 60 };

function main(): void {
  const season = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1] ?? "2324";
  const all = readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow);
  const universe = all.filter((m) => m.season <= season);

  const byLeague = new Map<string, PiMatchRow[]>();
  for (const m of universe) {
    const a = byLeague.get(m.league) ?? [];
    a.push(m);
    byLeague.set(m.league, a);
  }
  for (const a of byLeague.values()) a.sort((x, y) => Date.parse(x.result_available_at) - Date.parse(y.result_available_at));
  const priors = (lg: string, cut: number) => (byLeague.get(lg) ?? []).filter((m) => Date.parse(m.result_available_at) < cut);
  const cache = new StrengthFitCache(priors, PARAMS);

  // ultima partita di ogni squadra, per i giorni di riposo
  const lastPlayed = new Map<string, number>();
  const restOf = new Map<string, { home: number | null; away: number | null }>();
  for (const m of universe.slice().sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time))) {
    const t = Date.parse(m.event_time);
    restOf.set(m.canonical_id, {
      home: lastPlayed.has(m.home_team_id) ? (t - lastPlayed.get(m.home_team_id)!) / 86_400_000 : null,
      away: lastPlayed.has(m.away_team_id) ? (t - lastPlayed.get(m.away_team_id)!) / 86_400_000 : null,
    });
    lastPlayed.set(m.home_team_id, t);
    lastPlayed.set(m.away_team_id, t);
  }

  // squadre con storico nella divisione prima della stagione di holdout
  const seenInDiv = new Map<string, Set<string>>();
  for (const m of universe) {
    if (m.season >= season) continue;
    for (const id of [m.home_team_id, m.away_team_id]) {
      const s = seenInDiv.get(m.league) ?? new Set<string>();
      s.add(id);
      seenInDiv.set(m.league, s);
    }
  }

  type Rec = { diff: number; newTeams: number; rest: number | null; matchday: number; fav: number };
  const recs: Rec[] = [];
  const played = new Map<string, number>();

  for (const m of universe.filter((x) => x.season === season).sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time))) {
    const pM = marketBaselineFromOpenOdds(m);
    if (!pM) continue;
    const fit = cache.get(m.league, featureCutoffForMatch(m));
    const n = (played.get(m.league) ?? 0) + 1;
    played.set(m.league, n);
    if (!fit.supported) continue;
    const p = predictStrengthDc({ fit, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id, params: PARAMS });
    const prob = applyTemperature(p.probability, 0.7);
    const set = seenInDiv.get(m.league) ?? new Set<string>();
    const newTeams = [m.home_team_id, m.away_team_id].filter((id) => !set.has(id)).length;
    const r = restOf.get(m.canonical_id)!;
    const minRest = r.home != null && r.away != null ? Math.min(r.home, r.away) : null;
    recs.push({
      diff: logLossOne(prob, m.ftr) - logLossOne(pM, m.ftr),
      newTeams,
      rest: minRest,
      matchday: n,
      fav: Math.max(pM.HOME, pM.DRAW, pM.AWAY),
    });
  }

  const show = (label: string, sel: (r: Rec) => boolean, seed: number) => {
    const g = recs.filter(sel);
    if (g.length < 60) return;
    const b = pairedBootstrap(g.map((r) => r.diff), { iters: 2000, seed });
    process.stdout.write(
      `${label.padEnd(40)} ${String(g.length).padStart(6)} ${(b.mean_diff >= 0 ? "+" : "") + b.mean_diff.toFixed(5)}  [${b.ci_low.toFixed(4)}, ${b.ci_high.toFixed(4)}]\n`,
    );
  };

  process.stdout.write(`\nStagione ${season} — divario dal mercato per gruppo (positivo = il mercato vince)\n\n`);
  process.stdout.write(`${"gruppo".padEnd(40)} ${"n".padStart(6)} ${"divario"}   IC 95%\n`);
  process.stdout.write("-".repeat(78) + "\n");
  show("TUTTE", () => true, 1);
  process.stdout.write("\n  squadre senza storico nella divisione\n");
  show("  nessuna (entrambe con storico)", (r) => r.newTeams === 0, 2);
  show("  una delle due", (r) => r.newTeams === 1, 3);
  show("  entrambe", (r) => r.newTeams === 2, 4);
  process.stdout.write("\n  giornata di campionato\n");
  show("  prime 60 partite della stagione", (r) => r.matchday <= 60, 5);
  show("  da 61 a 200", (r) => r.matchday > 60 && r.matchday <= 200, 6);
  show("  oltre la 200", (r) => r.matchday > 200, 7);
  process.stdout.write("\n  riposo minimo fra le due squadre\n");
  show("  3 giorni o meno", (r) => r.rest != null && r.rest <= 3, 8);
  show("  4-6 giorni", (r) => r.rest != null && r.rest > 3 && r.rest <= 6, 9);
  show("  7-9 giorni", (r) => r.rest != null && r.rest > 6 && r.rest <= 9, 10);
  show("  oltre 9 giorni", (r) => r.rest != null && r.rest > 9, 11);
  process.stdout.write("\n  quanto e netto il favorito secondo il mercato\n");
  show("  equilibrata (max prob < 45%)", (r) => r.fav < 0.45, 12);
  show("  media (45-60%)", (r) => r.fav >= 0.45 && r.fav < 0.6, 13);
  show("  netta (oltre 60%)", (r) => r.fav >= 0.6, 14);

  writeFileSync(join(ROOT, "audit", "weakness-diagnosis.json"), JSON.stringify({ season, n: recs.length }, null, 2));
}

main();
