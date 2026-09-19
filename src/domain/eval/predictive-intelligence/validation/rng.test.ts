import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng, pairedBootstrap } from "@/domain/eval/predictive-intelligence/validation/rng";

test("il generatore e uniforme sui decili", () => {
  const rnd = makeRng(1);
  const bins = new Array(10).fill(0) as number[];
  const N = 200_000;
  for (let i = 0; i < N; i += 1) bins[Math.min(9, Math.floor(rnd() * 10))]! += 1;
  for (const b of bins) {
    assert.ok(Math.abs(b / N - 0.1) < 0.005, `decile fuori scala: ${(b / N).toFixed(4)}`);
  }
});

test("il vecchio LCG copre solo una parte degli indici (regressione)", () => {
  // Il difetto non e la uniformita marginale, che il vecchio LCG supera: e la
  // COPERTURA. Ricampionando 50.000 volte su 7.247 elementi raggiunge meno
  // indici distinti, quindi ogni iterazione bootstrap pesca da un sottoinsieme
  // e la distribuzione risultante e spostata.
  const n = 7247;
  let seed = 77;
  const bad = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const badSet = new Set<number>();
  for (let i = 0; i < 50_000; i += 1) badSet.add(Math.floor(bad() * n));

  const good = makeRng(12345);
  const goodSet = new Set<number>();
  for (let i = 0; i < 50_000; i += 1) goodSet.add(Math.floor(good() * n));

  assert.ok(goodSet.size > badSet.size + 500,
    `copertura attesa migliore: mulberry32 ${goodSet.size}, vecchio LCG ${badSet.size} su ${n}`);
  assert.ok(goodSet.size / n > 0.99, `mulberry32 deve coprire quasi tutto: ${goodSet.size}/${n}`);
});

test("l'intervallo di confidenza contiene la stima puntuale", () => {
  const rnd = makeRng(7);
  const diffs = Array.from({ length: 4000 }, () => (rnd() - 0.5) * 0.2 - 0.001);
  const r = pairedBootstrap(diffs, { iters: 2000, seed: 3 });
  assert.ok(r.ci_low <= r.mean_diff && r.mean_diff <= r.ci_high,
    `media ${r.mean_diff} fuori da [${r.ci_low}, ${r.ci_high}]`);
});

test("riconosce una differenza vera e una nulla", () => {
  const rnd = makeRng(11);
  const better = Array.from({ length: 3000 }, () => (rnd() - 0.5) * 0.1 - 0.02);
  assert.ok(pairedBootstrap(better, { seed: 5 }).p_first_better > 0.99);

  // Campione a media esattamente nulla: centrato, altrimenti si sta misurando
  // il rumore campionario e non il comportamento del bootstrap.
  const raw = Array.from({ length: 3000 }, () => (rnd() - 0.5) * 0.1);
  const m = raw.reduce((a, b) => a + b, 0) / raw.length;
  const none = raw.map((x) => x - m);
  const p = pairedBootstrap(none, { seed: 5 }).p_first_better;
  assert.ok(p > 0.3 && p < 0.7, `atteso circa 0,5 su differenza nulla, ottenuto ${p}`);
});
