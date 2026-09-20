import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBookable, locateSelection } from "@/domain/booking/planetwin/catalog";
import { driftIsAcceptable, oddsDrift } from "@/domain/booking/types";

describe("catalogo planetwin365", () => {
  it("trova l'1X2 sulla scheda principale", () => {
    const e = locateSelection("1");
    assert.equal(e.tab, "Principali");
    assert.equal(e.block, "1X2");
    assert.equal(e.outcome, "1");
    assert.equal(e.coverage, 1);
  });

  it("marca la doppia chance con copertura 2", () => {
    for (const code of ["1X", "12", "X2"]) {
      assert.equal(locateSelection(code).coverage, 2, code);
    }
  });

  it("manda gli angoli 1X2 sulla scheda Angoli", () => {
    const e = locateSelection("CORNERS_2");
    assert.equal(e.tab, "Angoli");
    assert.equal(e.block, "ANGOLI 1X2");
    assert.equal(e.outcome, "2");
  });

  it("porta la linea insieme all'esito per i mercati multilinea", () => {
    const gol = locateSelection("O2.5");
    assert.equal(gol.tab, "U/O");
    assert.equal(gol.line, "2.5");
    assert.equal(gol.outcome, "O");

    const angoli = locateSelection("CORNERS_U9.5");
    assert.equal(angoli.tab, "Angoli");
    assert.equal(angoli.block, "U/O ANGOLI");
    assert.equal(angoli.line, "9.5");
    assert.equal(angoli.outcome, "U");
  });

  it("rifiuta una linea che il book non quota, invece di prendere la più vicina", () => {
    assert.throws(() => locateSelection("CORNERS_O6.5"), /non quotata/);
    assert.throws(() => locateSelection("O9.5"), /non quotata/);
  });

  it("una selezione non mappata è un errore, non un tentativo", () => {
    assert.throws(() => locateSelection("CARDS_O3.5"), /non mappata/);
    assert.throws(() => locateSelection("CS_2_1"), /non mappata/);
    assert.equal(isBookable("CARDS_O3.5"), false);
    assert.equal(isBookable("CORNERS_1"), true);
  });

  it("ignora spazi e maiuscole", () => {
    assert.deepEqual(locateSelection(" corners_o9.5 "), locateSelection("CORNERS_O9.5"));
  });
});

describe("controllo di scostamento quota", () => {
  it("una quota che peggiora oltre la tolleranza invalida la gamba", () => {
    const d = oddsDrift(2.0, 1.9);
    assert.ok(d < 0);
    assert.equal(driftIsAcceptable(d, 0.02), false);
  });

  it("una quota che migliora non invalida mai", () => {
    const d = oddsDrift(2.0, 2.5);
    assert.ok(d > 0);
    assert.equal(driftIsAcceptable(d, 0.02), true);
  });

  it("un movimento dentro la tolleranza passa", () => {
    assert.equal(driftIsAcceptable(oddsDrift(2.0, 1.98), 0.02), true);
  });

  it("rifiuta quote impossibili", () => {
    assert.throws(() => oddsDrift(1.0, 2.0), /quota attesa non valida/);
    assert.throws(() => oddsDrift(2.0, 0.5), /quota presa non valida/);
  });
});
