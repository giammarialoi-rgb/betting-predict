/**
 * LAB — modello corner contro la base di riferimento.
 *
 * Non esistono quote corner storiche in questo dataset, quindi l'edge contro il
 * mercato NON e misurabile qui. Cio che si puo misurare, ed e il presupposto
 * perche valga la pena comprare quei prezzi, e se il modello sa qualcosa che la
 * semplice media di lega non sa.
 *
 * Riferimento: media mobile dei corner della lega fino al cutoff, stessa
 * distribuzione. Se il modello non lo batte, i prezzi corner sono inutili.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_COUNT_MODEL,
  fitCountStrength,
  predictCountOverUnder,
  predictCountWinner,
  lambdasFromCountFit,
  totalCountDistribution,
  type CountFit,
  type CountModelParams,
  type CountSample,
} from "@/domain/eval/predictive-intelligence/models/count-model";
import { pairedBootstrap as sharedPairedBootstrap } from "@/domain/eval/predictive-intelligence/validation/rng";

const ROOT = process.cwd();
const RAW = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/raw");
const OUT = join(ROOT, "audit", (process.argv.find((a) => a.startsWith("--metric="))?.split("=")[1] ?? "corners") + "-report.json");

type Row = { div: string; date: number; home: string; away: string; hc: number; ac: number; season: string };

function parseDate(d: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(d.trim());
  if (!m) return null;
  const yy = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return Date.parse(`${yy}-${m[2]}-${m[1]}T12:00:00Z`);
}

function load(): Row[] {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const out: Row[] = [];
  for (const f of readdirSync(RAW).filter((x) => /^[A-Z]+\d?-\d{4}\.csv$/.test(x))) {
    const season = f.slice(-8, -4);
    const text = readFileSync(join(RAW, f), "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const h = lines[0]!.replace(/^﻿/, "").split(",");
    const ix = (n: string) => h.indexOf(n);
    const metric = process.argv.find((a) => a.startsWith("--metric="))?.split("=")[1] ?? "corners";
    const cols = metric === "cards" ? ["HY", "AY"] : ["HC", "AC"];
    const [iD, iDate, iH, iA, iHC, iAC] = [ix("Div"), ix("Date"), ix("HomeTeam"), ix("AwayTeam"), ix(cols[0]!), ix(cols[1]!)];
    if (iHC < 0 || iAC < 0) continue;
    for (let i = 1; i < lines.length; i += 1) {
      const c = lines[i]!.split(",");
      const t = parseDate(c[iDate] ?? "");
      const hc = Number((c[iHC] ?? "").trim());
      const ac = Number((c[iAC] ?? "").trim());
      if (t == null || !Number.isFinite(hc) || !Number.isFinite(ac)) continue;
      const home = (c[iH] ?? "").trim();
      const away = (c[iA] ?? "").trim();
      if (!home || !away) continue;
      out.push({ div: (c[iD] ?? "").trim(), date: t, home, away, hc, ac, season });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}

function binaryLoss(p: number, y: boolean): { ll: number; brier: number; hit: boolean } {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const t = y ? 1 : 0;
  return { ll: -(t * Math.log(q) + (1 - t) * Math.log(1 - q)), brier: (q - t) ** 2, hit: (q >= 0.5) === y };
}

function main(): void {
  const season = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1] ?? "2324";
  const metric = process.argv.find((a) => a.startsWith("--metric="))?.split("=")[1] ?? "corners";
  const rows = load();
  process.stdout.write(`metrica: ${metric} — partite: ${rows.length}\n`);

  const params: CountModelParams = { ...DEFAULT_COUNT_MODEL, halfLifeDays: 200, shrinkage: 8, iterations: 40 };
  const byDiv = new Map<string, Row[]>();
  for (const r of rows) {
    const a = byDiv.get(r.div) ?? [];
    a.push(r);
    byDiv.set(r.div, a);
  }

  const LINES = metric === "cards" ? [2.5, 3.5, 4.5, 5.5] : [8.5, 9.5, 10.5, 11.5];
  const agg = new Map<number, { m: number[]; b: number[]; mh: number; bh: number; n: number; mbr: number; bbr: number }>();
  for (const l of LINES) agg.set(l, { m: [], b: [], mh: 0, bh: 0, n: 0, mbr: 0, bbr: 0 });

  const fitCache = new Map<string, CountFit>();
  const winner = { model: [] as number[], base: [] as number[], mh: 0, bh: 0, n: 0 };
  const teamTot = { model: [] as number[], base: [] as number[], mh: 0, bh: 0, n: 0 };
  // base rate storica di chi vince i corner, da tutte le stagioni precedenti
  const pre = rows.filter((r) => r.season < season);
  const wc = { HOME: 0, DRAW: 0, AWAY: 0 };
  for (const r of pre) {
    if (r.hc > r.ac) wc.HOME += 1;
    else if (r.hc === r.ac) wc.DRAW += 1;
    else wc.AWAY += 1;
  }
  const wTot = wc.HOME + wc.DRAW + wc.AWAY || 1;
  const baseWinner = { HOME: wc.HOME / wTot, DRAW: wc.DRAW / wTot, AWAY: wc.AWAY / wTot };
  let evaluated = 0;

  for (const [div, list] of byDiv) {
    const target = list.filter((r) => r.season === season);
    for (const t of target) {
      const cut = t.date;
      const key = `${div}|${cut}`;
      let fit = fitCache.get(key);
      if (!fit) {
        const priors = list.filter((r) => r.date < cut);
        const samples: CountSample[] = priors.map((r) => ({
          home: r.home, away: r.away, homeCount: r.hc, awayCount: r.ac, timeMs: r.date,
        }));
        fit = fitCountStrength({ samples, asOfMs: cut, params });
        fitCache.set(key, fit);
      }
      if (!fit.supported) continue;
      // riferimento: sola media di lega, nessuna informazione sulle squadre
      const baseDist = totalCountDistribution(fit.mean, fit.dispersion, params.maxCount);
      const total = t.hc + t.ac;
      evaluated += 1;
      // (b) chi ottiene PIU corner: qui l'effetto squadra non si annulla
      const w = predictCountWinner({ fit, homeId: t.home, awayId: t.away, params });
      const outcome = t.hc > t.ac ? "HOME" : t.hc === t.ac ? "DRAW" : "AWAY";
      winner.model.push(-Math.log(Math.max(1e-12, w[outcome])));
      winner.base.push(-Math.log(Math.max(1e-12, baseWinner[outcome])));
      winner.mh += (w.HOME >= w.DRAW && w.HOME >= w.AWAY ? "HOME" : w.DRAW >= w.AWAY ? "DRAW" : "AWAY") === outcome ? 1 : 0;
      winner.bh += (baseWinner.HOME >= baseWinner.DRAW && baseWinner.HOME >= baseWinner.AWAY ? "HOME" : baseWinner.DRAW >= baseWinner.AWAY ? "DRAW" : "AWAY") === outcome ? 1 : 0;
      winner.n += 1;

      // (c) corner della squadra di casa sopra/sotto 4.5: effetto squadra diretto
      const lam = lambdasFromCountFit(fit, t.home, t.away);
      const teamDist = totalCountDistribution(lam.lambda_home, fit.dispersion, params.maxCount);
      let pTeamOver = 0;
      const teamLine = metric === "cards" ? 1.5 : 4.5;
      for (let k = 0; k < teamDist.length; k += 1) if (k > teamLine) pTeamOver += teamDist[k]!;
      const baseTeamDist = totalCountDistribution(fit.mean / 2, fit.dispersion, params.maxCount);
      let pTeamBase = 0;
      for (let k = 0; k < baseTeamDist.length; k += 1) if (k > teamLine) pTeamBase += baseTeamDist[k]!;
      const teamOver = t.hc > teamLine;
      const tm = binaryLoss(pTeamOver, teamOver);
      const tb = binaryLoss(pTeamBase, teamOver);
      teamTot.model.push(tm.ll); teamTot.base.push(tb.ll);
      teamTot.mh += tm.hit ? 1 : 0; teamTot.bh += tb.hit ? 1 : 0; teamTot.n += 1;

      for (const line of LINES) {
        const pm = predictCountOverUnder({ fit, homeId: t.home, awayId: t.away, line, params });
        let pb = 0;
        for (let k = 0; k < baseDist.length; k += 1) if (k > line) pb += baseDist[k]!;
        const over = total > line;
        const a = agg.get(line)!;
        const lm = binaryLoss(pm.p_over, over);
        const lb = binaryLoss(pb, over);
        a.m.push(lm.ll); a.b.push(lb.ll);
        a.mbr += lm.brier; a.bbr += lb.brier;
        if (lm.hit) a.mh += 1;
        if (lb.hit) a.bh += 1;
        a.n += 1;
      }
    }
  }

  const mean = (x: number[]) => x.reduce((p, q) => p + q, 0) / Math.max(1, x.length);
  process.stdout.write(`\nStagione ${season} — corner, modello contro media di lega  (n=${evaluated} partite, ${fitCache.size} fit)\n\n`);
  process.stdout.write(`${"linea".padEnd(8)} ${"n".padStart(7)} ${"modello ll".padStart(11)} ${"base ll".padStart(9)} ${"delta".padStart(9)} ${"acc.mod".padStart(8)} ${"acc.base".padStart(9)}\n`);
  process.stdout.write("-".repeat(66) + "\n");
  const report: unknown[] = [];
  for (const line of LINES) {
    const a = agg.get(line)!;
    const mm = mean(a.m);
    const bb = mean(a.b);
    const d = a.m.map((x, i) => x - a.b[i]!);
    const boot = sharedPairedBootstrap(d, { iters: 3000, seed: 77 });
    process.stdout.write(
      `${("O/U " + line).padEnd(8)} ${String(a.n).padStart(7)} ${mm.toFixed(5).padStart(11)} ${bb.toFixed(5).padStart(9)} ${((mm - bb >= 0 ? "+" : "") + (mm - bb).toFixed(5)).padStart(9)} ${(100 * a.mh / a.n).toFixed(1).padStart(7)}% ${(100 * a.bh / a.n).toFixed(1).padStart(8)}%\n`,
    );
    report.push({
      line, n: a.n, model_log_loss: mm, baseline_log_loss: bb, delta: mm - bb,
      model_brier: a.mbr / a.n, baseline_brier: a.bbr / a.n,
      p_model_better: boot.p_first_better, ci_low: boot.ci_low, ci_high: boot.ci_high,
    });
  }
  process.stdout.write("-".repeat(66) + "\n");
  for (const r of report as { line: number; p_model_better: number; ci_low: number; ci_high: number }[]) {
    process.stdout.write(`  O/U ${r.line}: p(modello migliore)=${r.p_model_better.toFixed(3)}  IC95 [${r.ci_low.toFixed(5)}, ${r.ci_high.toFixed(5)}]\n`);
  }
  const mw = mean(winner.model), bw = mean(winner.base);
  const bootW = sharedPairedBootstrap(winner.model.map((x, i) => x - winner.base[i]!), { iters: 3000, seed: 91 });
  const mt = mean(teamTot.model), bt = mean(teamTot.base);
  const bootT = sharedPairedBootstrap(teamTot.model.map((x, i) => x - teamTot.base[i]!), { iters: 3000, seed: 92 });
  process.stdout.write(`\nMercati dove l'effetto squadra NON si annulla:\n\n`);
  process.stdout.write(`${"mercato".padEnd(26)} ${"n".padStart(7)} ${"modello".padStart(9)} ${"base".padStart(9)} ${"delta".padStart(9)} ${"p(migl.)".padStart(9)}\n`);
  process.stdout.write("-".repeat(74) + "\n");
  process.stdout.write(`${(metric === "cards" ? "Chi prende piu gialli" : "Corner 1X2 (chi ne ha piu)").padEnd(26)} ${String(winner.n).padStart(7)} ${mw.toFixed(5).padStart(9)} ${bw.toFixed(5).padStart(9)} ${((mw - bw >= 0 ? "+" : "") + (mw - bw).toFixed(5)).padStart(9)} ${bootW.p_first_better.toFixed(3).padStart(9)}\n`);
  process.stdout.write(`${(metric === "cards" ? "Gialli casa Over 1.5" : "Corner casa Over 4.5").padEnd(26)} ${String(teamTot.n).padStart(7)} ${mt.toFixed(5).padStart(9)} ${bt.toFixed(5).padStart(9)} ${((mt - bt >= 0 ? "+" : "") + (mt - bt).toFixed(5)).padStart(9)} ${bootT.p_first_better.toFixed(3).padStart(9)}\n`);
  process.stdout.write("-".repeat(74) + "\n");
  process.stdout.write(`  Corner 1X2  IC95 [${bootW.ci_low.toFixed(5)}, ${bootW.ci_high.toFixed(5)}]   accuratezza ${(100 * winner.mh / winner.n).toFixed(1)}% contro ${(100 * winner.bh / winner.n).toFixed(1)}%\n`);
  process.stdout.write(`  Corner casa IC95 [${bootT.ci_low.toFixed(5)}, ${bootT.ci_high.toFixed(5)}]   accuratezza ${(100 * teamTot.mh / teamTot.n).toFixed(1)}% contro ${(100 * teamTot.bh / teamTot.n).toFixed(1)}%\n`);
  writeFileSync(OUT, JSON.stringify({ season, params, evaluated, lines: report,
    corners_1x2: { ...bootW, n: winner.n, model: mw, baseline: bw, delta: mw - bw },
    home_team_over_4_5: { ...bootT, n: teamTot.n, model: mt, baseline: bt, delta: mt - bt } }, null, 2));
  process.stdout.write(`\n-> ${OUT}\n`);
}

main();
