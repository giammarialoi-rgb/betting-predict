import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  impliedProbability,
  marginPerOutcome,
  marketMargin,
  requireMargin,
} from "@/domain/markets/margin";

describe("margin", () => {
  it("rifiuta quote non valide", () => {
    assert.throws(() => impliedProbability(1), /non valida/);
    assert.throws(() => impliedProbability(0.5), /non valida/);
    assert.throws(() => impliedProbability(Number.NaN), /non valida/);
  });

  it("un mercato equo a due vie ha margine zero", () => {
    const v = marketMargin([2, 2]);
    assert.equal(v.kind, "ok");
    if (v.kind !== "ok") return;
    assert.ok(Math.abs(v.overround) < 1e-12);
  });

  it("misura il margine 1X2 reale di Fiorentina-Napoli su Planetwin365", () => {
    const v = marketMargin([3.2, 3.4, 2.25]);
    assert.equal(v.kind, "ok");
    if (v.kind !== "ok") return;
    assert.ok(v.overround > 0.05 && v.overround < 0.052, `overround ${v.overround}`);
  });

  it("gli angoli 1X2 costano il doppio dell'1X2 sulla stessa partita", () => {
    const esito = requireMargin([3.2, 3.4, 2.25], "1X2");
    const angoli = requireMargin([2.25, 8.5, 1.8], "ANGOLI 1X2");
    assert.ok(angoli > 2 * esito, `angoli ${angoli} vs esito ${esito}`);
  });

  it("dichiara incompleto un blocco con esiti mancanti invece di inventare un arbitraggio", () => {
    // "SQUADRA CON PIÙ ANGOLI NEL 1T E 2T" quota solo 1 e 2: manca l'esito in cui
    // la condizione non si verifica. La somma sta sotto 1.
    const v = marketMargin([6.0, 3.75]);
    assert.equal(v.kind, "incomplete");
    if (v.kind !== "incomplete") return;
    assert.ok(v.shortfall > 0.5, `shortfall ${v.shortfall}`);
  });

  it("requireMargin non lascia passare un mercato incompleto", () => {
    assert.throws(() => requireMargin([6.0, 3.75], "SQ. PIU ANGOLI"), /esiti mancanti/);
  });

  it("la doppia chance letta come partizione darebbe un margine assurdo", () => {
    // DC reale, Fiorentina-Napoli: 1X 1.63, 12 1.30, X2 1.35.
    const dc = [1.63, 1.3, 1.35] as const;

    const comePartizione = marketMargin(dc);
    assert.equal(comePartizione.kind, "ok");
    if (comePartizione.kind !== "ok") return;
    assert.ok(comePartizione.overround > 1, "sarebbe oltre il 100% di margine");

    // Con la copertura giusta: ogni risultato è coperto due volte.
    const corretto = marketMargin(dc, 2);
    assert.equal(corretto.kind, "ok");
    if (corretto.kind !== "ok") return;
    assert.ok(
      corretto.overround > 0.11 && corretto.overround < 0.13,
      `overround ${corretto.overround}`,
    );
  });

  it("una copertura impossibile per il numero di esiti è un errore", () => {
    assert.throws(() => marketMargin([2.0, 2.0], 2), /copertura 2 impossibile/);
    assert.throws(() => marketMargin([2.0, 2.0], 0), /copertura non valida/);
  });

  it("serve almeno un mercato a due esiti", () => {
    assert.throws(() => marketMargin([2.0]), /almeno 2 esiti/);
  });

  it("l'overround totale misura il numero di esiti, non quanto è caro il mercato", () => {
    // Misurato su Fiorentina-Napoli, board angoli Planetwin365 del 20/09/2026.
    // Le bande TOTALE ANGOLI hanno overround 22.8% contro il 9.1% di un due-vie:
    // sembrano cinque volte più care. Non lo sono — hanno cinque esiti invece di
    // due. Per esito la tassa è la stessa. Confrontare gli overround grezzi di
    // mercati con n diverso è un errore, e questo test lo fissa.
    const bande = marginPerOutcome([6.0, 2.5, 2.45, 5.5, 14.0], "TOTALE ANGOLI");
    const dueVie = marginPerOutcome([1.9, 1.77], "U/O ANGOLI 8.5");
    const treVie = marginPerOutcome([2.25, 8.5, 1.8], "ANGOLI 1X2");

    const overroundBande = requireMargin([6.0, 2.5, 2.45, 5.5, 14.0]);
    const overroundDueVie = requireMargin([1.9, 1.77]);
    assert.ok(overroundBande > 2 * overroundDueVie, "l'overround grezzo suggerisce bande molto più care");

    // Ma per esito i tre mercati stanno in una fascia stretta: 4.56% (5 bande),
    // 4.56% (due vie), 3.92% (tre vie). Un punto percentuale di spread, non il
    // fattore 2.5 che suggerisce l'overround grezzo.
    const spread = Math.max(bande, dueVie, treVie) - Math.min(bande, dueVie, treVie);
    assert.ok(spread < 0.01, `spread per esito ${(spread * 100).toFixed(3)} punti`);
    assert.ok(Math.min(bande, dueVie, treVie) > 0.035, "nessun mercato angoli scende sotto il 3.5% per esito");
  });
});
