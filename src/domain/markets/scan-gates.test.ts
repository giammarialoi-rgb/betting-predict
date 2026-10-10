import { test } from "node:test";
import assert from "node:assert/strict";
import { GATE_DEFAULTS, eventWindow, gateEdges } from "@/domain/markets/scan-gates";

const NOW = Date.parse("2026-10-10T10:00:00Z");
const h = (x: number): string => new Date(NOW + x * 3_600_000).toISOString();
const cfg = GATE_DEFAULTS;

test("finestra: scarta le partite iniziate, quelle imminenti e quelle oltre 48 ore", () => {
  assert.equal(eventWindow(h(-1), NOW, cfg), "iniziata");
  assert.equal(eventWindow(h(0.05), NOW, cfg), "iniziata", "a meno di 10 minuti dal via non si gioca piu");
  assert.equal(eventWindow(h(2), NOW, cfg), "ok");
  assert.equal(eventWindow(h(47), NOW, cfg), "ok");
  assert.equal(eventWindow(h(49), NOW, cfg), "oltre_orizzonte");
  assert.equal(eventWindow("boh", NOW, cfg), "data_non_valida");
});

test("gate: un edge plausibile passa, uno del 40% va in quarantena", () => {
  const edges = [{ edge: 0.03 }, { edge: -0.05 }, { edge: 0.4 }];
  const g = gateEdges(edges, 12, cfg);
  assert.deepEqual(g.accepted, [{ edge: 0.03 }]);
  assert.equal(g.quarantined.length, 1);
  assert.equal(g.quarantined[0]!.reason, "edge_oltre_soglia");
});

test("gate: pochi book mettono in quarantena tutto", () => {
  const g = gateEdges([{ edge: 0.05 }, { edge: -0.1 }, { edge: -0.2 }], 5, cfg);
  assert.equal(g.accepted.length, 0);
  assert.equal(g.quarantined[0]!.reason, "pochi_book");
});

test("gate: tutti e tre gli esiti sopra soglia sono prezzi guasti, non vantaggio", () => {
  const g = gateEdges([{ edge: 0.04 }, { edge: 0.03 }, { edge: 0.05 }], 14, cfg);
  assert.equal(g.accepted.length, 0);
  assert.equal(g.quarantined.length, 3);
  assert.ok(g.quarantined.every((q) => q.reason === "tutti_gli_esiti"));
});

test("gate: nessun candidato, nessuna quarantena", () => {
  const g = gateEdges([{ edge: 0.01 }, { edge: -0.02 }, { edge: -0.1 }], 14, cfg);
  assert.equal(g.accepted.length + g.quarantined.length, 0);
});
