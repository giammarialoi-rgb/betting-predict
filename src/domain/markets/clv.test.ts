import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLV_MIN_N,
  clvVerdict,
  computeClv,
  summarise,
  type ClvEntry,
  type Snapshot,
  type SnapshotMark,
  type SnapshotRow,
} from "@/domain/markets/clv";
import { isExchangeBook } from "@/domain/markets/exchanges";

const VIA = "2026-10-10T18:00:00Z";
const at = (hoursBeforeVia: number): string => new Date(Date.parse(VIA) - hoursBeforeVia * 3_600_000).toISOString();

function row(over: Partial<SnapshotRow> = {}): SnapshotRow {
  return {
    eventId: "e1", outcome: "Casa", commence: VIA, home: "A", away: "B",
    bestBook: "Bet365", priceNet: 3.2, fairPrice: 3.0, edge: 0.0667, nBooks: 12,
    ...over,
  };
}
function mark(over: Partial<SnapshotMark> = {}): SnapshotMark {
  return { eventId: "e1", outcome: "Casa", commence: VIA, fairPrice: 3.0, nBooks: 12, ...over };
}
const run = (h: number, rows: SnapshotRow[], marks?: SnapshotMark[]): Snapshot => ({ run_at: at(h), rows, marks });
const calc = (snaps: Snapshot[]) => computeClv(snaps, isExchangeBook, 0.02);

test("il CLV puo essere negativo: il consenso si muove contro la presa", () => {
  // presa a 3.20, la chiusura equa sale a 3.60 (la selezione e diventata meno probabile)
  const r = calc([run(8, [row({ priceNet: 3.2 })], [mark({ fairPrice: 3.0 })]), run(4, [], [mark({ fairPrice: 3.6 })])]);
  assert.equal(r.entries.length, 1);
  assert.ok(Math.abs(r.entries[0]!.clv - (3.2 / 3.6 - 1)) < 1e-12);
  assert.ok(r.entries[0]!.clv < 0);
  assert.equal(r.clean!.share_negative, 1);
});

test("piu istantanee non gonfiano il CLV: conta la prima presa, non il massimo", () => {
  const base = [run(10, [row({ priceNet: 3.2 })], [mark({ fairPrice: 3.1 })])];
  const few = calc([...base, run(4, [row({ priceNet: 3.2 })], [mark({ fairPrice: 3.1 })])]);
  // aggiungo osservazioni intermedie con prezzi molto piu alti: non devono cambiare nulla
  const many = calc([
    base[0]!,
    run(9, [row({ priceNet: 4.5 })], [mark({ fairPrice: 3.1 })]),
    run(8, [row({ priceNet: 4.8 })], [mark({ fairPrice: 3.1 })]),
    run(7, [row({ priceNet: 5.0 })], [mark({ fairPrice: 3.1 })]),
    run(4, [row({ priceNet: 3.2 })], [mark({ fairPrice: 3.1 })]),
  ]);
  assert.equal(few.entries[0]!.clv, many.entries[0]!.clv);
  assert.equal(many.entries[0]!.takePrice, 3.2);
});

test("la selezione che esce dalle righe ma resta nei marks ha comunque la sua chiusura", () => {
  const r = calc([run(10, [row()], [mark()]), run(3, [], [mark({ fairPrice: 3.4 })])]);
  assert.equal(r.entries[0]!.closeSource, "marks");
  assert.equal(r.entries[0]!.closeFair, 3.4);
});

test("senza chiusura la selezione non sparisce in silenzio: e contata", () => {
  const r = calc([run(10, [row()], [mark()])]);
  assert.equal(r.taken, 1);
  assert.equal(r.withoutClose, 1);
  assert.equal(r.entries.length, 0);
  assert.equal(r.clean, null);
});

test("la stessa istantanea non fa da chiusura a se stessa (distanza minima)", () => {
  const r = calc([run(10, [row()], [mark()]), run(9.9, [], [mark({ fairPrice: 2.9 })])]);
  assert.equal(r.entries.length, 0);
  assert.equal(r.withoutClose, 1);
});

test("una chiusura troppo lontana dal via non conta", () => {
  const r = calc([run(30, [row()], [mark()]), run(20, [], [mark({ fairPrice: 3.0 })])]);
  assert.equal(r.entries.length, 0, "20 ore prima del via non e una chiusura");
});

test("le istantanee vecchie (solo righe) vanno nel gruppo legacy, non nel pulito", () => {
  const r = calc([run(10, [row()]), run(4, [row({ priceNet: 3.1, fairPrice: 3.05 })])]);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0]!.closeSource, "rows");
  assert.equal(r.clean, null);
  assert.equal(r.legacy!.n, 1);
  assert.equal(clvVerdict(r.clean).ready, false);
});

test("filtri: quote guaste, mercati sottili, exchange, partite iniziate, tutti gli esiti", () => {
  const rows = [
    row({ eventId: "guasta", edge: 0.6, priceNet: 6 }),
    row({ eventId: "sottile", nBooks: 4 }),
    row({ eventId: "exch", bestBook: "Matchbook" }),
    row({ eventId: "tre", outcome: "Casa", edge: 0.05 }),
    row({ eventId: "tre", outcome: "Pareggio", edge: 0.05 }),
    row({ eventId: "tre", outcome: "Trasferta", edge: 0.05 }),
    row({ eventId: "ok" }),
  ];
  const r = calc([run(10, rows, []), run(4, [], [mark({ eventId: "ok" })])]);
  assert.equal(r.excludedRows.edge_oltre_soglia, 1);
  assert.equal(r.excludedRows.pochi_book, 1);
  assert.equal(r.excludedRows.exchange, 1);
  assert.equal(r.excludedRows.tutti_gli_esiti, 3);
  assert.equal(r.taken, 1);
  // partita gia iniziata
  const live = calc([{ run_at: at(-1), rows: [row({ eventId: "live" })] }]);
  assert.equal(live.excludedRows.gia_iniziata, 1);
});

test("oltre l'orizzonte di 48 ore la presa non vale", () => {
  const r = calc([run(60, [row({ eventId: "lontana" })]), run(4, [], [mark({ eventId: "lontana" })])]);
  assert.equal(r.excludedRows.oltre_orizzonte, 1);
  assert.equal(r.taken, 0);
});

test("il verdetto non esiste sotto la soglia e l'IC decide sopra", () => {
  const mk = (n: number, clv: number): ClvEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      eventId: `e${i % 150}`, event: "x", outcome: "o", book: "b", takenAt: "", takePrice: 2, closedAt: "",
      closeFair: 2 / (1 + clv), closeSource: "marks" as const, closeToKickoffH: 2, takeToKickoffH: 8,
      clv: clv + (i % 2 ? 0.01 : -0.01),
    }));
  assert.equal(clvVerdict(summarise(mk(CLV_MIN_N - 1, 0.03))).ready, false);
  const up = clvVerdict(summarise(mk(400, 0.03)));
  assert.ok(up.ready && up.supports_backtest === true);
  const down = clvVerdict(summarise(mk(400, -0.03)));
  assert.ok(down.ready && down.supports_backtest === false);
  const flat = clvVerdict(summarise(mk(400, 0)));
  assert.ok(flat.ready && flat.supports_backtest === null);
});
