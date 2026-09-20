import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestSingle,
  buildTicket,
  legCost,
  PRESETS,
  targetFromStake,
  TicketBuildError,
  type RatedSelection,
} from "@/domain/booking/ticket-builder";

const ORA = new Date("2026-09-20T09:00:00Z");
const fra = (ore: number): string =>
  new Date(ORA.getTime() + ore * 3_600_000).toISOString();

const sel = (
  event: string,
  odds: number,
  probability: number,
  ore = 6,
): RatedSelection => ({
  event,
  selection: "1",
  odds,
  probability,
  kickoff: fra(ore),
  informationShare: 0.8,
});

describe("margine di una gamba", () => {
  it("vale esattamente 1 su un prezzo senza margine", () => {
    assert.ok(Math.abs(legCost(sel("A", 2, 0.5)) - 1) < 1e-12);
    assert.ok(Math.abs(legCost(sel("B", 4, 0.25)) - 1) < 1e-12);
  });

  it("cresce col margine incorporato nel prezzo", () => {
    // Probabilità equa 55% pagata 1.75 invece di 1.82: il book trattiene.
    const caro = legCost(sel("A", 1.75, 0.55));
    const meno = legCost(sel("B", 1.8, 0.55));
    assert.ok(caro > 1 && meno > 1);
    assert.ok(caro > meno, "la quota più bassa a parità di probabilità costa di più");
  });

  it("con probabilità eque di mercato non scende mai sotto 1", () => {
    // Un biglietto a valore atteso positivo su un singolo book non esiste:
    // la funzione ora lo dice invece di prometterlo.
    for (const [q, p] of [[1.75, 0.55], [3.0, 0.32], [10.0, 0.095]] as const) {
      assert.ok(legCost(sel("X", q, p)) > 1, `quota ${q} con equa ${p}`);
    }
  });

  it("rifiuta quote e probabilità impossibili", () => {
    assert.throws(() => legCost(sel("A", 1, 0.5)), /quota non valida/);
    assert.throws(() => legCost(sel("A", 2, 0)), /probabilità fuori range/);
    assert.throws(() => legCost(sel("A", 2, 1)), /probabilità fuori range/);
  });
});

describe("dalla puntata alla quota da raggiungere", () => {
  it("10 euro per vincerne 100 significa quota 10", () => {
    const t = targetFromStake(10, 100, 0.15);
    assert.ok(t.minOdds < 10 && t.maxOdds > 10);
    assert.ok(Math.abs((t.minOdds + t.maxOdds) / 2 - 10) < 1e-9);
  });

  it("non accetta di vincere meno di quanto si punta", () => {
    assert.throws(() => targetFromStake(10, 10), /deve superare/);
    assert.throws(() => targetFromStake(10, 5), /deve superare/);
    assert.throws(() => targetFromStake(0, 100), /importo non valido/);
  });
});

describe("filtro sulla quota di informazione", () => {
  const conQuota = (event: string, share: number | null): RatedSelection => ({
    event,
    selection: "1",
    odds: 2.0,
    probability: 0.55,
    kickoff: fra(6),
    informationShare: share,
  });

  it("scarta le selezioni su squadre che il modello non conosce", () => {
    // Il caso Frosinone: quota di informazione 0.31, sotto la metà.
    const pool = [conQuota("Frosinone - Como", 0.31), conQuota("Milan - Lecce", 0.31)];
    assert.throws(() => bestSingle(pool, undefined, ORA), /nessuna selezione/);
  });

  it("tiene quelle su squadre con storico vero", () => {
    const pool = [conQuota("Juventus - Atalanta", 0.68)];
    assert.equal(bestSingle(pool, undefined, ORA).legs.length, 1);
  });

  it("una selezione senza quota calcolata non passa", () => {
    // Meglio perdere una gamba che infilarne una di valore ignoto.
    assert.throws(() => bestSingle([conQuota("A - B", null)], undefined, ORA), /nessuna selezione/);
  });

  it("la soglia si può alzare ma non aggirare", () => {
    const pool = [conQuota("A - B", 0.55), conQuota("C - D", 0.9)];
    const t = buildTicket(
      pool,
      { minOdds: 1.9, maxOdds: 2.1, maxLegs: 1, minLegs: 1, minInformationShare: 0.8 },
      ORA,
    );
    assert.equal(t.legs[0]?.event, "C - D");
  });
});

describe("composizione del biglietto", () => {
  // Probabilità EQUE di mercato: ogni prezzo incorpora un margine, quindi
  // p * quota < 1 sempre. Cambia solo quanto margine si paga.
  const pool: readonly RatedSelection[] = [
    sel("A - B", 1.5, 0.65), // margine contenuto
    sel("C - D", 1.6, 0.60),
    sel("E - F", 2.0, 0.48),
    sel("G - H", 3.0, 0.31),
    sel("I - J", 1.4, 0.68),
  ];

  it("la singola prende quella che paga meno margine", () => {
    const t = bestSingle(pool, undefined, ORA);
    assert.equal(t.legs.length, 1);
    // Col prezzo equo di mercato nessuna singola è in vantaggio: si sceglie la
    // meno tassata, e il valore atteso resta negativo. Dirlo è il punto.
    const costi = pool.map((p) => legCost(p));
    assert.ok(Math.abs(legCost(t.legs[0]!) - Math.min(...costi)) < 1e-12);
  });

  it("il raddoppio cade nell'intervallo e non lo sfora mai", () => {
    const adatte = [
      sel("A - B", 1.45, 0.67),
      sel("C - D", 1.42, 0.68),
      sel("E - F", 1.30, 0.75),
    ];
    const t = buildTicket(adatte, PRESETS.raddoppio(), ORA);
    assert.ok(t.totalOdds >= 1.9 && t.totalOdds <= 2.2, `quota ${t.totalOdds}`);
    assert.ok(t.legs.length >= 2);
  });

  it("preferisce fallire piuttosto che sforare il tetto", () => {
    // 1.5 x 1.6 = 2.40, oltre il massimo di 2.20: nessuna coppia va bene.
    const troppo = [sel("A - B", 1.5, 0.65), sel("C - D", 1.6, 0.60)];
    assert.throws(() => buildTicket(troppo, PRESETS.raddoppio(), ORA), /nessuna combinazione/);
  });

  it("trova il raddoppio che l'avidità pura si perdeva", () => {
    // 1.30 ha il costo più basso, ma prenderla per prima blocca a 1.85.
    // La coppia giusta è 1.45 x 1.42 = 2.06.
    const trappola = [
      sel("A - B", 1.45, 0.67),
      sel("C - D", 1.42, 0.68),
      sel("E - F", 1.30, 0.75),
    ];
    const t = buildTicket(trappola, PRESETS.raddoppio(), ORA);
    assert.equal(t.legs.length, 2);
    assert.ok(t.totalOdds >= 1.9 && t.totalOdds <= 2.2, `quota ${t.totalOdds}`);
  });

  it("non mette mai due gambe sulla stessa partita", () => {
    const stessoEvento = [
      sel("A - B", 1.45, 0.67),
      { ...sel("A - B", 1.42, 0.68), selection: "O2.5" },
      sel("C - D", 1.42, 0.68),
    ];
    const t = buildTicket(stessoEvento, PRESETS.raddoppio(), ORA);
    const eventi = t.legs.map((l) => l.event);
    assert.equal(new Set(eventi).size, eventi.length, "gambe correlate moltiplicate");
  });

  it("il valore atteso di una multipla è sempre negativo, e lo dice", () => {
    const t = buildTicket(pool, PRESETS.multipla(5), ORA);
    assert.ok(t.edgePerEuro < 0, `valore atteso ${t.edgePerEuro}`);
    assert.ok(Math.abs(t.breakEvenProbability - 1 / t.totalOdds) < 1e-12);
    assert.ok(Math.abs(t.oneWinEvery - 1 / t.probability) < 1e-9);
    assert.ok(Math.abs(t.edgePerEuro - (t.probability * t.totalOdds - 1)) < 1e-12);
  });

  it("esclude gli eventi fuori orizzonte", () => {
    const lontani = [sel("A - B", 2.0, 0.55, 24 * 20), sel("C - D", 2.0, 0.55, 24 * 21)];
    assert.throws(
      () => bestSingle(lontani, 14, ORA),
      /nessuna selezione disponibile/,
    );
    // Senza orizzonte gli stessi eventi sono ammessi.
    assert.equal(bestSingle(lontani, undefined, ORA).legs.length, 1);
  });

  it("esclude gli eventi già iniziati", () => {
    const passati = [sel("A - B", 2.0, 0.55, -1), sel("C - D", 2.0, 0.55, -2)];
    assert.throws(() => buildTicket(passati, PRESETS.raddoppio(), ORA), /nessuna selezione/);
    assert.throws(() => bestSingle(passati, undefined, ORA), /nessuna selezione/);
  });

  it("dice che la quota non è raggiungibile invece di consegnare un biglietto sbagliato", () => {
    const corti = [sel("A - B", 1.1, 0.88), sel("C - D", 1.1, 0.88)];
    assert.throws(
      () => buildTicket(corti, { minOdds: 50, maxOdds: 60, maxLegs: 2 }, ORA),
      /sotto il minimo richiesto/,
    );
  });

  it("rifiuta un intervallo invertito o gambe impossibili", () => {
    assert.throws(
      () => buildTicket(pool, { minOdds: 10, maxOdds: 2, maxLegs: 3 }, ORA),
      /intervallo invertito/,
    );
    assert.throws(
      () => buildTicket(pool, { minOdds: 2, maxOdds: 3, maxLegs: 0 }, ORA),
      /numero di gambe non valido/,
    );
  });

  it("un listone lungo è improbabile, e lo dichiara", () => {
    const tanti = Array.from({ length: 20 }, (_, i) => sel(`E${i} - F${i}`, 1.8, 0.53));
    const t = buildTicket(tanti, { minOdds: 100, maxOdds: 400, maxLegs: 20 }, ORA);
    assert.ok(t.totalOdds >= 100);
    assert.ok(t.probability < 0.05, `p = ${t.probability}`);
    assert.ok(t.oneWinEvery > 20, `una vincita ogni ${t.oneWinEvery}`);
  });
});
