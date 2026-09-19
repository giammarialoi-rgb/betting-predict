import { test } from "node:test";
import assert from "node:assert/strict";
import {
  devigPower,
  devigProportional,
  devigShin,
  fairOdds,
} from "@/domain/odds/devig";

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

test("tutti i metodi restituiscono probabilita proprie", () => {
  const books: number[][] = [
    [2.1, 3.4, 3.6],
    [1.2, 6.5, 15.0],
    [1.05, 12.0, 34.0],
    [2.0, 2.0],
    [1.9, 1.9],
  ];
  for (const odds of books) {
    for (const f of [devigProportional, devigShin, devigPower]) {
      const r = f(odds);
      assert.ok(Math.abs(sum(r.probabilities) - 1) < 1e-9, `${r.method} su ${odds}: somma ${sum(r.probabilities)}`);
      for (const p of r.probabilities) assert.ok(p > 0 && p < 1, `${r.method}: probabilita ${p}`);
    }
  }
});

test("su un mercato simmetrico i tre metodi coincidono", () => {
  const odds = [1.9, 1.9];
  const a = devigProportional(odds).probabilities;
  const b = devigShin(odds).probabilities;
  const c = devigPower(odds).probabilities;
  for (let i = 0; i < 2; i += 1) {
    assert.ok(Math.abs(a[i]! - 0.5) < 1e-9);
    assert.ok(Math.abs(b[i]! - 0.5) < 1e-9);
    assert.ok(Math.abs(c[i]! - 0.5) < 1e-9);
  }
});

test("il proporzionale sovrastima lo sfavorito e sottostima il favorito", () => {
  // Mercato molto sbilanciato: e qui che i metodi divergono.
  const odds = [1.2, 6.5, 15.0];
  const prop = devigProportional(odds).probabilities;
  const shin = devigShin(odds).probabilities;
  const pow = devigPower(odds).probabilities;

  assert.ok(shin[0]! > prop[0]!, `favorito: Shin ${shin[0]!.toFixed(4)} deve superare proporzionale ${prop[0]!.toFixed(4)}`);
  assert.ok(shin[2]! < prop[2]!, `sfavorito: Shin ${shin[2]!.toFixed(4)} deve stare sotto proporzionale ${prop[2]!.toFixed(4)}`);
  assert.ok(pow[0]! > prop[0]!, "anche power alza il favorito");
  assert.ok(pow[2]! < prop[2]!, "anche power abbassa lo sfavorito");

  // L'errore relativo sullo sfavorito e la parte che conta: e li che si cercano gli edge.
  const relError = (prop[2]! - shin[2]!) / shin[2]!;
  assert.ok(relError > 0.02, `scarto relativo sullo sfavorito troppo piccolo: ${(100 * relError).toFixed(2)}%`);
});

test("piu il mercato e sbilanciato, piu i metodi divergono", () => {
  const gap = (odds: number[]) => {
    const p = devigProportional(odds).probabilities;
    const s = devigShin(odds).probabilities;
    return Math.abs(p[p.length - 1]! - s[s.length - 1]!) / s[s.length - 1]!;
  };
  const equilibrato = gap([2.9, 3.0, 3.1]);
  const sbilanciato = gap([1.1, 9.0, 26.0]);
  assert.ok(sbilanciato > equilibrato, `sbilanciato ${sbilanciato.toFixed(4)} deve superare equilibrato ${equilibrato.toFixed(4)}`);
});

test("senza margine i metodi non cambiano nulla", () => {
  const odds = [2, 4, 4]; // somma delle implicite = 1 esatto
  const r = devigShin(odds);
  assert.ok(Math.abs(r.probabilities[0]! - 0.5) < 1e-9);
  assert.ok(Math.abs(r.overround - 1) < 1e-12);
});

test("le quote eque sono sempre piu lunghe di quelle offerte", () => {
  const odds = [2.1, 3.4, 3.6];
  const fair = fairOdds(odds, "shin");
  for (let i = 0; i < odds.length; i += 1) {
    assert.ok(fair[i]! > odds[i]!, `quota equa ${fair[i]} deve superare l'offerta ${odds[i]}`);
  }
});

test("quote non valide vengono rifiutate", () => {
  assert.throws(() => devigShin([1.0, 3.0]), /quota decimale non valida/);
  assert.throws(() => devigShin([2.0, -1]), /quota decimale non valida/);
});
