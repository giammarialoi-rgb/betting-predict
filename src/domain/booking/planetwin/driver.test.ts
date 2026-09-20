import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBookingCode, parseOdds, planTicket } from "@/domain/booking/planetwin/driver";
import type { TicketLeg } from "@/domain/booking/types";

describe("lettura quote", () => {
  it("legge una quota dal testo della cella", () => {
    assert.equal(parseOdds("3.20"), 3.2);
    assert.equal(parseOdds("1\n3.20"), 3.2);
    assert.equal(parseOdds("  O   1,80 "), 1.8);
  });

  it("rifiuta una cella senza quota invece di restituire zero", () => {
    assert.throws(() => parseOdds("1"), /non leggibile/);
    assert.throws(() => parseOdds(""), /non leggibile/);
    assert.throws(() => parseOdds("lucchetto"), /non leggibile/);
  });

  it("rifiuta una quota impossibile", () => {
    assert.throws(() => parseOdds("0.95"), /fuori range/);
  });
});

describe("codice di prenotazione", () => {
  it("normalizza il codice reale emesso da Planetwin365", () => {
    assert.equal(normalizeBookingCode("RE 02 79 89 19 53"), "RE0279891953");
    assert.equal(normalizeBookingCode("RE0279891953"), "RE0279891953");
  });

  it("accetta il formato Sisal, solo cifre e spazi", () => {
    assert.equal(normalizeBookingCode("D 463 5637 050"), "D4635637050");
  });

  it("rifiuta qualcosa che non è un codice", () => {
    assert.throws(() => normalizeBookingCode("PRENOTAZIONE CONFERMATA"), /non riconosciuto/);
    assert.throws(() => normalizeBookingCode("RE 12"), /non riconosciuto/);
  });
});

describe("pianificazione del biglietto", () => {
  const leg = (event: string, selection: string): TicketLeg => ({
    event,
    selection,
    expectedOdds: 2,
  });

  it("risolve ogni gamba prima di aprire il browser", () => {
    const plan = planTicket([
      leg("Fiorentina - Napoli", "1"),
      leg("Milan - Lecce", "O2.5"),
      leg("Juventus - Atalanta", "CORNERS_O9.5"),
    ]);
    assert.equal(plan.length, 3);
    assert.equal(plan[2]?.block, "U/O ANGOLI");
  });

  it("si ferma sulla prima gamba non mappabile, senza aprire niente", () => {
    assert.throws(
      () => planTicket([leg("Fiorentina - Napoli", "1"), leg("Milan - Lecce", "CARDS_O3.5")]),
      /non mappata/,
    );
  });

  it("rifiuta una gamba duplicata", () => {
    assert.throws(
      () => planTicket([leg("Milan - Lecce", "1"), leg("Milan - Lecce", "1")]),
      /duplicata/,
    );
  });

  it("consente due mercati diversi sulla stessa partita", () => {
    const plan = planTicket([leg("Milan - Lecce", "1"), leg("Milan - Lecce", "O2.5")]);
    assert.equal(plan.length, 2);
  });

  it("rifiuta un biglietto vuoto", () => {
    assert.throws(() => planTicket([]), /vuoto/);
  });
});
