import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildSelections,
  buildVerdict,
  countForScope,
  devigTwoWay,
  resultKey,
  settleObservations,
  type CornerObs,
  type CornerResult,
} from "@/domain/eval/corners/prospective";

const GIORNO = 86_400_000;
const KICK = "2026-09-20T13:00:00Z";

function obs(p: Partial<CornerObs> = {}): CornerObs {
  return {
    division: "E0",
    event_id: "e1",
    commence_time: KICK,
    home: "Bournemouth",
    away: "Liverpool",
    bookmaker: "Book A",
    market: "alternate_totals_corners",
    scope: "total",
    side: "OVER",
    line: 10.5,
    price: 1.91,
    model_probability: 0.5,
    settled: false,
    result_corners_home: null,
    result_corners_away: null,
    ...p,
  };
}

function risultati(rs: Array<[string, CornerResult]>): Map<string, CornerResult[]> {
  const m = new Map<string, CornerResult[]>();
  for (const [k, r] of rs) {
    const cur = m.get(k);
    if (cur) cur.push(r);
    else m.set(k, [r]);
  }
  return m;
}

describe("corner prospettici — regolazione", () => {
  test("chiude la riga con i corner della partita giusta", () => {
    const rows = [obs(), obs({ side: "UNDER", price: 2.0 })];
    const n = settleObservations(
      rows,
      risultati([[resultKey("E0", "Bournemouth", "Liverpool"), { hc: 4, ac: 8, dayMs: Date.parse(KICK) }]]),
    );
    assert.equal(n, 2);
    assert.equal(rows[0]!.result_corners_home, 4);
    assert.equal(rows[0]!.result_corners_away, 8);
    assert.equal(rows[0]!.settled, true);
  });

  test("non chiude nulla se la partita non c'e ancora", () => {
    const rows = [obs()];
    assert.equal(settleObservations(rows, risultati([])), 0);
    assert.equal(rows[0]!.settled, false);
    assert.equal(rows[0]!.result_corners_home, null);
  });

  test("lascia aperta la riga se l'abbinamento e ambiguo invece di indovinare", () => {
    const k = resultKey("E0", "Bournemouth", "Liverpool");
    const rows = [obs()];
    const n = settleObservations(
      rows,
      risultati([
        [k, { hc: 4, ac: 8, dayMs: Date.parse(KICK) }],
        [k, { hc: 1, ac: 2, dayMs: Date.parse(KICK) + GIORNO }],
      ]),
    );
    assert.equal(n, 0);
    assert.equal(rows[0]!.settled, false);
  });

  test("non pesca una partita di un'altra settimana", () => {
    const rows = [obs()];
    const n = settleObservations(
      rows,
      risultati([[resultKey("E0", "Bournemouth", "Liverpool"), { hc: 4, ac: 8, dayMs: Date.parse(KICK) + 7 * GIORNO }]]),
    );
    assert.equal(n, 0);
  });

  test("non riscrive una riga gia chiusa", () => {
    const rows = [obs({ settled: true, result_corners_home: 1, result_corners_away: 1 })];
    settleObservations(
      rows,
      risultati([[resultKey("E0", "Bournemouth", "Liverpool"), { hc: 9, ac: 9, dayMs: Date.parse(KICK) }]]),
    );
    assert.equal(rows[0]!.result_corners_home, 1);
  });

  test("lo scope decide quali corner contano", () => {
    const r: CornerResult = { hc: 4, ac: 8, dayMs: 0 };
    assert.equal(countForScope("total", r), 12);
    assert.equal(countForScope("home", r), 4);
    assert.equal(countForScope("away", r), 8);
  });
});

describe("corner prospettici — prezzo e verdetto", () => {
  test("il de-vig toglie il margine e somma a uno", () => {
    const p = devigTwoWay(1.91, 1.91)!;
    assert.ok(Math.abs(p - 0.5) < 1e-9);
    const q = devigTwoWay(1.5, 3.0)!;
    assert.ok(Math.abs(q + (devigTwoWay(3.0, 1.5) ?? 0) - 1) < 1e-9);
  });

  test("un blocco che non e una partizione non produce una probabilita", () => {
    // due lati che sommano a meno del 98%: manca qualcosa, non e un regalo
    assert.equal(devigTwoWay(2.5, 2.5), null);
  });

  test("una linea colpita in pieno e un rimborso, non un esito", () => {
    const rows = [
      obs({ line: 10, settled: true, result_corners_home: 4, result_corners_away: 6 }),
      obs({ line: 10, side: "UNDER", price: 2.0, settled: true, result_corners_home: 4, result_corners_away: 6 }),
    ];
    assert.equal(buildSelections(rows).length, 0);
  });

  test("una selezione per partita-linea, col prezzo migliore fra i book", () => {
    const base = { settled: true, result_corners_home: 5, result_corners_away: 8 };
    const rows = [
      obs({ ...base, bookmaker: "A", side: "OVER", price: 1.8 }),
      obs({ ...base, bookmaker: "A", side: "UNDER", price: 2.0 }),
      obs({ ...base, bookmaker: "B", side: "OVER", price: 1.95 }),
      obs({ ...base, bookmaker: "B", side: "UNDER", price: 1.85 }),
    ];
    const sel = buildSelections(rows);
    assert.equal(sel.length, 1);
    assert.equal(sel[0]!.bestOver, 1.95);
    assert.equal(sel[0]!.bestUnder, 2.0);
    assert.equal(sel[0]!.hitOver, true); // 13 > 10.5
    assert.ok(sel[0]!.margin > 0);
  });

  test("nessun verdetto finche il campione e piccolo", () => {
    const base = { settled: true, result_corners_home: 5, result_corners_away: 8 };
    const sel = buildSelections([
      obs({ ...base, side: "OVER", price: 1.9 }),
      obs({ ...base, side: "UNDER", price: 1.9 }),
    ]);
    assert.equal(sel.length, 1);
    assert.equal(buildVerdict(sel), null);
  });

  test("un modello perfetto batte il mercato e guadagna; uno invertito perde", () => {
    const sel = Array.from({ length: 400 }, (_, i) => {
      const hit = i % 2 === 0;
      return {
        eventId: `e${i}`, line: 10.5,
        modelOver: hit ? 0.95 : 0.05,
        marketOver: 0.5, hitOver: hit, margin: 0.05,
        bestOver: 1.95, bestUnder: 1.95,
      };
    });
    const buono = buildVerdict(sel, 100)!;
    assert.ok(buono.deltaMillesimi < 0, "il modello perfetto deve stare sotto al mercato");
    assert.ok(buono.simulation[0]!.rendimento > 0);

    const invertito = buildVerdict(sel.map((s) => ({ ...s, modelOver: 1 - s.modelOver })), 100)!;
    assert.ok(invertito.deltaMillesimi > 0);
    assert.ok(invertito.simulation[0]!.rendimento < 0);
  });
});
