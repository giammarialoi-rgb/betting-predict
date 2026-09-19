/**
 * BACKTEST DELLA DISPERSIONE — gli edge trovati sono veri o sono il bias?
 *
 * La scansione live concentra il 51% delle selezioni su quote >= 6,00, con edge
 * crescente al crescere della quota. E' lo stesso andamento monotono del bias
 * favorito-outsider, rovesciato: sospetto che sia un artefatto della stima equa
 * sugli sfavoriti, non valore.
 *
 * Qui si decide sui dati. Football-Data espone, per 45.228 partite, i prezzi di
 * piu bookmaker all'apertura (B365, BW, IW, PS/Pinnacle, WH, VC), il MIGLIOR
 * prezzo di mercato (Max) e la chiusura Pinnacle (PSC). E' esattamente la stessa
 * struttura della scansione live, ma con l'esito noto.
 *
 * Due metriche, non una: ROI realizzato (dice se hai vinto) e CLV contro la
 * chiusura Pinnacle (dice se avevi ragione). Il secondo conta di piu: il primo
 * su poche migliaia di scommesse e quasi tutto varianza.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { analyseDispersion, type BookQuote } from "@/domain/markets/dispersion";
import { devigShin } from "@/domain/odds/devig";
import { makeRng } from "@/domain/eval/predictive-intelligence/validation/rng";

const ROOT = process.cwd();
const RAW = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/raw");
const OUT = join(ROOT, "audit", "dispersion-backtest.json");

const BOOKS: [string, string, string, string][] = [
  ["Bet365", "B365H", "B365D", "B365A"],
  ["Bwin", "BWH", "BWD", "BWA"],
  ["Interwetten", "IWH", "IWD", "IWA"],
  ["Pinnacle", "PSH", "PSD", "PSA"],
  ["William Hill", "WHH", "WHD", "WHA"],
  ["VCBet", "VCH", "VCD", "VCA"],
  ["1xBet", "1XBH", "1XBD", "1XBA"],
];

type Row = { cols: Record<string, string>; ftr: "H" | "D" | "A" };

function load(): Row[] {
  const out: Row[] = [];
  for (const f of readdirSync(RAW).filter((x) => /^[A-Z]+\d?-\d{4}\.csv$/.test(x))) {
    const lines = readFileSync(join(RAW, f), "utf8").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const head = lines[0]!.replace(/^﻿/, "").split(",");
    for (let i = 1; i < lines.length; i += 1) {
      const c = lines[i]!.split(",");
      const cols: Record<string, string> = {};
      for (let j = 0; j < head.length; j += 1) cols[head[j]!] = (c[j] ?? "").trim();
      const ftr = cols.FTR as "H" | "D" | "A";
      if (ftr === "H" || ftr === "D" || ftr === "A") out.push({ cols, ftr });
    }
  }
  return out;
}

const num = (v: string | undefined): number | null => {
  const x = Number((v ?? "").trim());
  return Number.isFinite(x) && x > 1.01 ? x : null;
};

function main(): void {
  const rows = load();
  const minEdge = Number(process.argv.find((a) => a.startsWith("--min-edge="))?.split("=")[1] ?? 0.02);
  process.stdout.write(`partite caricate: ${rows.length}\n`);

  type Bet = { price: number; edge: number; won: boolean; clv: number | null; side: number };
  const bets: Bet[] = [];
  let usable = 0;

  for (const r of rows) {
    const quotes: BookQuote[] = [];
    for (const [name, h, d, a] of BOOKS) {
      const ph = num(r.cols[h]);
      const pd = num(r.cols[d]);
      const pa = num(r.cols[a]);
      if (ph && pd && pa) quotes.push({ book: name, prices: [ph, pd, pa] });
    }
    if (quotes.length < 4) continue;
    // miglior prezzo di mercato: la colonna Max copre piu book di quelli nominati
    const best = [num(r.cols.MaxH), num(r.cols.MaxD), num(r.cols.MaxA)];
    if (!best.every((x) => x != null)) continue;
    usable += 1;

    const an = analyseDispersion({
      outcomes: ["H", "D", "A"],
      quotes,
      options: { sharpBook: "Pinnacle", method: "shin", minBooks: 4 },
    });
    if (!an.reliable) continue;

    // chiusura Pinnacle -> probabilita equa, per il CLV
    const ch = num(r.cols.PSCH);
    const cd = num(r.cols.PSCD);
    const ca = num(r.cols.PSCA);
    const closeFair = ch && cd && ca ? devigShin([ch, cd, ca]).probabilities : null;

    for (let i = 0; i < 3; i += 1) {
      const price = best[i]!;
      const fair = an.edges[i]!.fairProbability;
      const edge = price * fair - 1;
      if (edge < minEdge) continue;
      const won = (i === 0 && r.ftr === "H") || (i === 1 && r.ftr === "D") || (i === 2 && r.ftr === "A");
      const clv = closeFair ? price * closeFair[i]! - 1 : null;
      bets.push({ price, edge, won, clv, side: i });
    }
  }

  const buckets: [number, number, string][] = [
    [1, 2, "1.00-2.00"], [2, 3, "2.00-3.00"], [3, 4.5, "3.00-4.50"],
    [4.5, 6, "4.50-6.00"], [6, 10, "6.00-10.0"], [10, 1e9, "10.0+"],
  ];
  process.stdout.write(`\npartite utilizzabili: ${usable}   scommesse sopra edge ${(100 * minEdge).toFixed(1)}%: ${bets.length}\n\n`);
  /** IC 95% bootstrap sulla media di una serie di risultati per scommessa. */
  const ci = (xs: number[], seed: number): [number, number] => {
    if (xs.length < 20) return [NaN, NaN];
    const rnd = makeRng(seed);
    const ms: number[] = [];
    for (let it = 0; it < 2000; it += 1) {
      let s2 = 0;
      for (let i = 0; i < xs.length; i += 1) s2 += xs[Math.floor(rnd() * xs.length)]!;
      ms.push(s2 / xs.length);
    }
    ms.sort((a, b) => a - b);
    return [ms[50]!, ms[1950]!];
  };

  process.stdout.write(`${"fascia".padEnd(11)} ${"n".padStart(6)} ${"edge".padStart(7)} ${"ROI reale (IC 95%)".padStart(26)} ${"CLV (IC 95%)".padStart(24)} ${"batte".padStart(7)}\n`);
  process.stdout.write("-".repeat(80) + "\n");
  const report: unknown[] = [];
  for (const [lo, hi, label] of buckets) {
    const b = bets.filter((x) => x.price >= lo && x.price < hi);
    if (b.length < 20) continue;
    const pnl = b.reduce((a, x) => a + (x.won ? x.price - 1 : -1), 0);
    const roi = pnl / b.length;
    const withClv = b.filter((x) => x.clv != null);
    const clv = withClv.length ? withClv.reduce((a, x) => a + x.clv!, 0) / withClv.length : 0;
    const beat = withClv.length ? withClv.filter((x) => x.clv! > 0).length / withClv.length : 0;
    const eAvg = b.reduce((a, x) => a + x.edge, 0) / b.length;
    const roiCi = ci(b.map((x) => (x.won ? x.price - 1 : -1)), 100 + lo);
    const clvCi = ci(withClv.map((x) => x.clv!), 500 + lo);
    const fmt = (v: number, c: [number, number]) =>
      `${(100 * v).toFixed(2)}% [${(100 * c[0]).toFixed(1)},${(100 * c[1]).toFixed(1)}]`;
    process.stdout.write(
      `${label.padEnd(11)} ${String(b.length).padStart(6)} ${(100 * eAvg).toFixed(2).padStart(6)}% ${fmt(roi, roiCi).padStart(26)} ${fmt(clv, clvCi).padStart(24)} ${(100 * beat).toFixed(1).padStart(6)}%\n`,
    );
    report.push({ bucket: label, n: b.length, mean_edge: eAvg, roi, roi_ci: roiCi, clv, clv_ci: clvCi, beat_close_rate: beat });
  }
  const all = bets;
  const pnlAll = all.reduce((a, x) => a + (x.won ? x.price - 1 : -1), 0);
  const clvAll = all.filter((x) => x.clv != null);
  process.stdout.write("-".repeat(80) + "\n");
  const roiAllCi = ci(all.map((x) => (x.won ? x.price - 1 : -1)), 7);
  const clvAllCi = ci(clvAll.map((x) => x.clv!), 8);
  const fmtT = (v: number, c: [number, number]) =>
    `${(100 * v).toFixed(2)}% [${(100 * c[0]).toFixed(1)},${(100 * c[1]).toFixed(1)}]`;
  process.stdout.write(
    `${"TOTALE".padEnd(11)} ${String(all.length).padStart(6)} ${(100 * all.reduce((a, x) => a + x.edge, 0) / all.length).toFixed(2).padStart(6)}% ${fmtT(pnlAll / all.length, roiAllCi).padStart(26)} ${fmtT(clvAll.reduce((a, x) => a + x.clv!, 0) / clvAll.length, clvAllCi).padStart(24)} ${(100 * clvAll.filter((x) => x.clv! > 0).length / clvAll.length).toFixed(1).padStart(6)}%\n`,
  );

  mkdirSync(join(ROOT, "audit"), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    min_edge: minEdge, matches: rows.length, usable, bets: bets.length,
    by_bucket: report,
    total: { n: all.length, roi: pnlAll / all.length, clv: clvAll.reduce((a, x) => a + x.clv!, 0) / clvAll.length },
  }, null, 2));
  process.stdout.write(`\n-> ${OUT}\n`);
}

main();
