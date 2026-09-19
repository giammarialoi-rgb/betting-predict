import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyseDispersion,
  effectivePrice,
  type BookQuote,
} from "@/domain/markets/dispersion";

const OUT = ["HOME", "DRAW", "AWAY"];

function books(): BookQuote[] {
  return [
    { book: "Pinnacle", prices: [3.25, 3.85, 2.24] },
    { book: "Bet365", prices: [3.10, 3.70, 2.20] },
    { book: "William Hill", prices: [3.15, 3.75, 2.15] },
    { book: "Unibet", prices: [3.20, 3.80, 2.18] },
  ];
}

test("la commissione degli exchange riduce la quota netta", () => {
  assert.ok(Math.abs(effectivePrice("Betfair", 3.0) - (1 + 2 * 0.95)) < 1e-12);
  assert.ok(Math.abs(effectivePrice("Smarkets", 3.0) - (1 + 2 * 0.98)) < 1e-12);
  assert.equal(effectivePrice("Bet365", 3.0), 3.0, "un bookmaker tradizionale non ha commissione");
  assert.equal(effectivePrice("PINNACLE", 2.5), 2.5);
});

test("un exchange non vince il confronto se la commissione lo supera", () => {
  const qs: BookQuote[] = [
    ...books(),
    { book: "Betfair", prices: [3.30, 3.90, 2.26] }, // nominalmente il migliore
  ];
  const r = analyseDispersion({ outcomes: OUT, quotes: qs, options: { sharpBook: "Pinnacle" } });
  const home = r.edges[0]!;
  // 3.30 lordo -> 1 + 2.30*0.95 = 3.185 netto, sotto il 3.25 di Pinnacle
  assert.ok(Math.abs(home.bestPriceNet - 3.185) > 1e-9 || home.bestBook !== "Betfair",
    "il confronto deve avvenire sul netto");
  assert.equal(home.bestBook, "Pinnacle", `atteso Pinnacle, ottenuto ${home.bestBook} @${home.bestPriceNet}`);
});

test("il miglior prezzo combinato abbassa l'overround e il guadagno e positivo", () => {
  const r = analyseDispersion({ outcomes: OUT, quotes: books(), options: { sharpBook: "Pinnacle" } });
  assert.ok(r.bestCombinedOverround <= r.consensusOverround + 1e-12);
  assert.ok(r.executionGain >= 0, `guadagno ${r.executionGain}`);
  assert.equal(r.nBooks, 4);
  assert.ok(r.reliable);
});

test("un book scollato produce un edge positivo su quell'esito", () => {
  const qs = books();
  qs.push({ book: "BookScollato", prices: [3.25, 3.85, 2.95] }); // trasferta molto piu lunga
  const r = analyseDispersion({ outcomes: OUT, quotes: qs, options: { sharpBook: "Pinnacle" } });
  const away = r.edges[2]!;
  assert.equal(away.bestBook, "BookScollato");
  assert.ok(away.edge > 0.1, `edge atteso ampio, ottenuto ${(100 * away.edge).toFixed(2)}%`);
  // gli altri esiti restano senza vantaggio
  assert.ok(r.edges[0]!.edge < 0.02);
  assert.ok(r.edges[1]!.edge < 0.02);
});

test("con un solo book il risultato e dichiarato inaffidabile", () => {
  const r = analyseDispersion({ outcomes: OUT, quotes: [books()[0]!] });
  assert.equal(r.reliable, false);
  assert.ok(r.warnings.some((w) => /non e affidabile/.test(w)));
});

test("quote incomplete vengono scartate e segnalate", () => {
  const qs: BookQuote[] = [...books(), { book: "Rotto", prices: [2.0, 0] }];
  const r = analyseDispersion({ outcomes: OUT, quotes: qs, options: { sharpBook: "Pinnacle" } });
  assert.equal(r.nBooks, 4);
  assert.ok(r.warnings.some((w) => /scartati/.test(w)));
});

test("il de-vig Shin cambia l'edge rispetto al proporzionale sugli sfavoriti", () => {
  const qs: BookQuote[] = [
    { book: "Pinnacle", prices: [1.20, 6.50, 15.0] },
    { book: "Bet365", prices: [1.19, 6.40, 14.5] },
    { book: "Unibet", prices: [1.20, 6.30, 16.0] },
  ];
  const shin = analyseDispersion({ outcomes: OUT, quotes: qs, options: { sharpBook: "Pinnacle", method: "shin" } });
  const prop = analyseDispersion({ outcomes: OUT, quotes: qs, options: { sharpBook: "Pinnacle", method: "proportional" } });
  const sAway = shin.edges[2]!.edge;
  const pAway = prop.edges[2]!.edge;
  assert.ok(pAway > sAway, `il proporzionale deve gonfiare l'edge sullo sfavorito: prop ${(100*pAway).toFixed(2)}% vs shin ${(100*sAway).toFixed(2)}%`);
  assert.ok(pAway - sAway > 0.05, `scarto atteso rilevante, ottenuto ${(100*(pAway-sAway)).toFixed(2)} punti`);
});

test("senza book di riferimento usa la mediana ed esclude gli exchange", () => {
  const qs: BookQuote[] = [...books(), { book: "Betfair", prices: [3.30, 3.95, 2.28] }];
  const r = analyseDispersion({ outcomes: OUT, quotes: qs });
  assert.ok(/mediana di 4 book/.test(r.consensusSource), r.consensusSource);
  assert.ok(Math.abs(r.edges.reduce((a, e) => a + e.fairProbability, 0) - 1) < 1e-9);
});
