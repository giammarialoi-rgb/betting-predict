import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cellMatchesOutcome,
  findCellInPage,
  markSearchNode,
  markSlipBin,
  oddsFromCellText,
  TARGET_ATTR,
} from "@/domain/booking/planetwin/cell-finder";

describe("lettura della cella", () => {
  it("prende la quota in coda al testo della cella", () => {
    assert.equal(oddsFromCellText("1 3.20"), 3.2);
    assert.equal(oddsFromCellText("O\n1,80"), 1.8);
    assert.equal(oddsFromCellText("  U   2.55  "), 2.55);
  });

  it("non inventa una quota dove non c'è", () => {
    assert.equal(oddsFromCellText("1"), null);
    assert.equal(oddsFromCellText(""), null);
    assert.equal(oddsFromCellText("lucchetto"), null);
    assert.equal(oddsFromCellText("0.95"), null, "sotto 1 non è una quota");
  });
});

describe("corrispondenza dell'esito", () => {
  it("accetta l'esito giusto", () => {
    assert.equal(cellMatchesOutcome("1 3.20", "1"), true);
    assert.equal(cellMatchesOutcome("O 1.80", "O"), true);
    assert.equal(cellMatchesOutcome("Disp. 1.77", "Disp."), true);
  });

  it("non confonde 1 con X, con 2, o con 10", () => {
    assert.equal(cellMatchesOutcome("X 3.40", "1"), false);
    assert.equal(cellMatchesOutcome("2 2.25", "1"), false);
    // La trappola vera: un esito che comincia con la stessa cifra.
    assert.equal(cellMatchesOutcome("12 1.30", "1"), false);
    assert.equal(cellMatchesOutcome("1X 1.63", "1"), false);
  });

  it("non scambia U con O", () => {
    assert.equal(cellMatchesOutcome("U 1.90", "O"), false);
    assert.equal(cellMatchesOutcome("O 1.77", "U"), false);
  });

  it("rifiuta una cella senza quota", () => {
    assert.equal(cellMatchesOutcome("1", "1"), false);
  });
});

describe("la funzione eseguita nella pagina", () => {
  it("nessuna delle funzioni serializzate chiude sul modulo", () => {
    // Playwright ne serializza il sorgente e lo esegue nel browser, dove questo
    // modulo non esiste: un riferimento esterno esplode lì dentro. È già
    // successo con una costante di legature lasciata fuori dalla funzione, e il
    // controllo copriva solo findCellInPage.
    const fuori = [
      "TARGET_ATTR",
      "NAV_ATTR",
      "BIN_ATTR",
      "BIN_LIGATURES",
      "oddsFromCellText",
      "cellMatchesOutcome",
    ];
    for (const fn of [findCellInPage, markSearchNode, markSlipBin]) {
      const src = fn.toString();
      for (const nome of fuori) {
        assert.ok(
          !new RegExp(`\\b${nome}\\b`).test(src),
          `${fn.name} fa riferimento a ${nome}, che nel browser non esiste`,
        );
      }
      assert.ok(!/\bimport\b/.test(src), `${fn.name} contiene un import`);
    }
  });

  it("ripulisce le marcature precedenti prima di marcare", () => {
    assert.ok(
      findCellInPage.toString().includes("removeAttribute"),
      "una marcatura vecchia verrebbe cliccata al posto di questa",
    );
  });

  it("l'attributo di marcatura è specifico nostro", () => {
    assert.ok(TARGET_ATTR.startsWith("data-"));
    assert.ok(TARGET_ATTR.includes("betmind"));
  });
});
