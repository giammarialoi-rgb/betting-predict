/**
 * Fit per divisione contro fit cross-divisione, sullo stesso holdout cieco.
 *
 * L'ipotesi: poiche le forze sono aggiustate per l'avversario, il rating di una
 * squadra e confrontabile fra campionati, e una promossa dovrebbe portarsi
 * dietro il proprio invece di ripartire dalla media di lega. Se l'ipotesi e
 * giusta il guadagno deve concentrarsi sulle partite con squadre senza storico
 * nella divisione, non spalmarsi ovunque: e la verifica che distingue un
 * miglioramento vero da un caso fortunato.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC, StrengthFitCache, fitCrossDivisionStrength, viewDivision,
  predictStrengthDc, type LeagueStrengthFit, type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { applyTemperature } from "@/domain/eval/predictive-intelligence/models/temperature";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import { computeMetrics, logLossOne } from "@/domain/eval/predictive-intelligence/validation/metrics";
import { pairedBootstrap } from "@/domain/eval/predictive-intelligence/validation/rng";
import type { PiMatchRow, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");
const PARAMS: StrengthDcParams = { ...DEFAULT_STRENGTH_DC, halfLifeDays: 150, shrinkage: 9, rho: -0.12, sotWeight: 0.8, iterations: 40 };
const T = 0.7;

function main(): void {
  const season = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1] ?? "2324";
  const all = readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow);
  const universe = all.filter((m) => m.season <= season)
    .sort((a, b) => Date.parse(a.result_available_at) - Date.parse(b.result_available_at));

  const byLeague = new Map<string, PiMatchRow[]>();
  for (const m of universe) {
    const a = byLeague.get(m.league) ?? [];
    a.push(m);
    byLeague.set(m.league, a);
  }
  const priors = (lg: string, cut: number) => (byLeague.get(lg) ?? []).filter((m) => Date.parse(m.result_available_at) < cut);
  const perDiv = new StrengthFitCache(priors, PARAMS);
  /** Entrambi i modelli devono vedere gli stessi dati: stessa granularita di rifit.
   *  Prima il per-divisione rifittava ogni giorno e il cross ogni settimana, cioe
   *  fino a sei giorni di risultati in piu per uno solo dei due. */
  const weekOf = (iso: string) =>
    new Date(Math.floor(Date.parse(iso) / (7 * 86_400_000)) * 7 * 86_400_000).toISOString();

  const avail = universe.map((m) => Date.parse(m.result_available_at));
  const crossCache = new Map<string, LeagueStrengthFit>();
  /** Rifit settimanale: in produzione sarebbe giornaliero, qui basta e costa 7 volte meno.
   *  E' una scelta CONSERVATIVA: se il cross-divisione vince con dati piu vecchi
   *  di qualche giorno rispetto al concorrente, vince a maggior ragione rifittato ogni giorno. */
  const crossFit = (cutIso: string): LeagueStrengthFit => {
    const weekKey = weekOf(cutIso);
    const hit = crossCache.get(weekKey);
    if (hit) return hit;
    const cut = Date.parse(weekKey);
    let lo = 0, hi = avail.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (avail[mid]! < cut) lo = mid + 1; else hi = mid; }
    const f = fitCrossDivisionStrength({ matches: universe.slice(0, lo), asOfIso: weekKey, params: PARAMS });
    crossCache.set(weekKey, f);
    return f;
  };

  const seenInDiv = new Map<string, Set<string>>();
  for (const m of universe) {
    if (m.season >= season) continue;
    const s = seenInDiv.get(m.league) ?? new Set<string>();
    s.add(m.home_team_id); s.add(m.away_team_id);
    seenInDiv.set(m.league, s);
  }

  type Rec = { a: PiProb3; b: PiProb3; mk: PiProb3; y: PiMatchRow["ftr"]; newTeams: number; md: number };
  const recs: Rec[] = [];
  const played = new Map<string, number>();
  for (const m of universe.filter((x) => x.season === season).sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time))) {
    const mk = marketBaselineFromOpenOdds(m);
    if (!mk) continue;
    const cutIso = featureCutoffForMatch(m);
    const fa = perDiv.get(m.league, weekOf(cutIso));
    const n = (played.get(m.league) ?? 0) + 1;
    played.set(m.league, n);
    if (!fa.supported) continue;
    const fb = viewDivision(crossFit(cutIso), m.league);
    if (!fb.supported) continue;
    const pa = applyTemperature(predictStrengthDc({ fit: fa, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id, params: PARAMS }).probability, T);
    const pb = applyTemperature(predictStrengthDc({ fit: fb, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id, params: PARAMS }).probability, T);
    const set = seenInDiv.get(m.league) ?? new Set<string>();
    recs.push({ a: pa, b: pb, mk, y: m.ftr, md: n,
      newTeams: [m.home_team_id, m.away_team_id].filter((id) => !set.has(id)).length });
  }

  const ma = computeMetrics(recs.map((r) => ({ p: r.a, y: r.y })));
  const mb = computeMetrics(recs.map((r) => ({ p: r.b, y: r.y })));
  const mm = computeMetrics(recs.map((r) => ({ p: r.mk, y: r.y })));
  process.stdout.write(`\nStagione ${season} — n=${recs.length}, fit cross-divisione calcolati: ${crossCache.size}\n\n`);
  process.stdout.write(`${"modello".padEnd(24)} ${"log loss".padStart(9)} ${"Brier".padStart(8)} ${"divario dal mercato".padStart(20)}\n`);
  process.stdout.write("-".repeat(66) + "\n");
  process.stdout.write(`${"per divisione".padEnd(24)} ${ma.log_loss.toFixed(5).padStart(9)} ${ma.brier.toFixed(5).padStart(8)} ${("+" + (ma.log_loss - mm.log_loss).toFixed(5)).padStart(20)}\n`);
  process.stdout.write(`${"cross-divisione".padEnd(24)} ${mb.log_loss.toFixed(5).padStart(9)} ${mb.brier.toFixed(5).padStart(8)} ${("+" + (mb.log_loss - mm.log_loss).toFixed(5)).padStart(20)}\n`);
  process.stdout.write(`${"mercato".padEnd(24)} ${mm.log_loss.toFixed(5).padStart(9)} ${mm.brier.toFixed(5).padStart(8)}\n`);

  const boot = pairedBootstrap(recs.map((r) => logLossOne(r.b, r.y) - logLossOne(r.a, r.y)), { iters: 3000, seed: 21 });
  process.stdout.write(`\ncross-divisione contro per-divisione: ${boot.mean_diff >= 0 ? "+" : ""}${boot.mean_diff.toFixed(5)}  IC [${boot.ci_low.toFixed(5)}, ${boot.ci_high.toFixed(5)}]  p(migliore)=${boot.p_first_better.toFixed(3)}\n`);

  process.stdout.write(`\n${"gruppo".padEnd(34)} ${"n".padStart(6)} ${"guadagno".padStart(10)}   IC 95%\n`);
  process.stdout.write("-".repeat(72) + "\n");
  const grp = (label: string, sel: (r: Rec) => boolean, seed: number) => {
    const g = recs.filter(sel);
    if (g.length < 60) return;
    const b2 = pairedBootstrap(g.map((r) => logLossOne(r.b, r.y) - logLossOne(r.a, r.y)), { iters: 2000, seed });
    process.stdout.write(`${label.padEnd(34)} ${String(g.length).padStart(6)} ${(b2.mean_diff >= 0 ? "+" : "") + b2.mean_diff.toFixed(5)}  [${b2.ci_low.toFixed(5)}, ${b2.ci_high.toFixed(5)}]\n`);
  };
  grp("entrambe con storico in divisione", (r) => r.newTeams === 0, 31);
  grp("una senza storico", (r) => r.newTeams === 1, 32);
  grp("entrambe senza storico", (r) => r.newTeams === 2, 33);
  grp("prime 60 partite di stagione", (r) => r.md <= 60, 34);
  grp("dopo la 60esima", (r) => r.md > 60, 35);

  writeFileSync(join(ROOT, "audit", "cross-division-report.json"), JSON.stringify({
    season, n: recs.length,
    per_division: { log_loss: ma.log_loss, brier: ma.brier },
    cross_division: { log_loss: mb.log_loss, brier: mb.brier },
    market: { log_loss: mm.log_loss, brier: mm.brier },
    paired: boot,
  }, null, 2));
}

main();
