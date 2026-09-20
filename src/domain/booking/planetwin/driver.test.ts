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

describe("nome evento", () => {
  it("separa le squadre qualunque trattino usi il book", async () => {
    const { splitEvent } = await import("@/domain/booking/planetwin/driver");
    assert.deepEqual(splitEvent("Fiorentina - Napoli"), ["Fiorentina", "Napoli"]);
    assert.deepEqual(splitEvent("Milan – Lecce"), ["Milan", "Lecce"]);
    assert.deepEqual(splitEvent("Deportivo La Coruña - Real Betis"), [
      "Deportivo La Coruña",
      "Real Betis",
    ]);
  });

  it("non spezza un nome che contiene un trattino attaccato", async () => {
    const { splitEvent } = await import("@/domain/booking/planetwin/driver");
    assert.deepEqual(splitEvent("Saint-Etienne - Paris FC"), ["Saint-Etienne", "Paris FC"]);
  });

  it("rifiuta un nome senza avversario invece di cercare a caso", async () => {
    const { splitEvent } = await import("@/domain/booking/planetwin/driver");
    assert.throws(() => splitEvent("Fiorentina"), /non interpretabile/);
  });
});

describe("selettore della ricerca", () => {
  it("esclude la casella di ricerca del banner cookie da ogni candidato", async () => {
    const { searchSelector } = await import("@/domain/booking/planetwin/driver");
    const parts = searchSelector().split(", ");
    assert.ok(parts.length >= 3, "più di un candidato");
    // È l'input che ha fatto fallire il primo giro reale: nascosto, dentro il
    // widget di consenso, con aria-label "Ricerca nell'elenco dei cookie".
    for (const part of parts) {
      assert.ok(part.includes(':not([aria-label*="cookie" i])'), `esclusione mancante in: ${part}`);
      assert.ok(part.includes(':not([id*="vendor" i])'), `esclusione mancante in: ${part}`);
    }
  });

  it("non concatena le esclusioni come discendenti", async () => {
    const { searchSelector } = await import("@/domain/booking/planetwin/driver");
    // Uno spazio prima di ":not" trasformerebbe il filtro in un selettore di
    // discendenti e non escluderebbe niente.
    assert.ok(!/\s:not\(/.test(searchSelector()), searchSelector());
  });
});

describe("controllo aritmetico della schedina", () => {
  it("la quota totale attesa è il prodotto delle gambe", async () => {
    const { expectedTotalOdds } = await import("@/domain/booking/planetwin/driver");
    assert.ok(Math.abs(expectedTotalOdds([3.2, 1.27]) - 4.064) < 1e-9);
    assert.ok(Math.abs(expectedTotalOdds([2]) - 2) < 1e-9);
  });

  it("tollera l'arrotondamento del book ma non una gamba in più", async () => {
    const { expectedTotalOdds, totalOddsMatches } = await import(
      "@/domain/booking/planetwin/driver"
    );
    const atteso = expectedTotalOdds([3.2, 1.27]); // 4.064
    assert.equal(totalOddsMatches(4.06, atteso), true, "arrotondamento a due decimali");
    assert.equal(totalOddsMatches(4.07, atteso), true);

    // Una quarta gamba a 1.50 intrufolata: il prodotto salta e va rifiutato.
    const conIntrusa = expectedTotalOdds([3.2, 1.27, 1.5]);
    assert.equal(totalOddsMatches(conIntrusa, atteso), false);

    // Anche una gamba MANCANTE va rifiutata.
    assert.equal(totalOddsMatches(3.2, atteso), false);
  });

  it("rifiuta una quota totale assente o impossibile", async () => {
    const { totalOddsMatches } = await import("@/domain/booking/planetwin/driver");
    assert.equal(totalOddsMatches(0, 4.064), false);
    assert.equal(totalOddsMatches(1, 4.064), false);
    assert.equal(totalOddsMatches(Number.NaN, 4.064), false);
  });

  it("senza gambe non c'è prodotto da verificare", async () => {
    const { expectedTotalOdds } = await import("@/domain/booking/planetwin/driver");
    assert.throws(() => expectedTotalOdds([]), /nessuna gamba/);
  });
});

describe("uscita per l'utente", () => {
  it("toglie le legature delle icone dalla scadenza", async () => {
    const { cleanExpiry } = await import("@/domain/booking/planetwin/driver");
    // È quello che è uscito davvero alla prima prenotazione riuscita.
    assert.equal(cleanExpiry("14 GIORNI E 23 ORE schedule"), "14 GIORNI E 23 ORE");
    assert.equal(cleanExpiry("7 GIORNI timer"), "7 GIORNI");
    assert.equal(cleanExpiry("  "), "non indicata");
  });

  it("legge il bonus multipla dalla schedina", async () => {
    const { parseSlipBonus } = await import("@/domain/booking/planetwin/driver");
    assert.equal(parseSlipBonus("Quota Tot 9.52 Bonus 0,00€ Vincita"), 0);
    assert.equal(parseSlipBonus("Quota Tot 12.00 Bonus 1,20€"), 1.2);
    assert.equal(parseSlipBonus("niente bonus qui"), 0);
  });

  it("legge il totale della schedina", async () => {
    const { parseSlipTotal } = await import("@/domain/booking/planetwin/driver");
    assert.equal(parseSlipTotal("Quota Tot 9,52 Bonus 0,00"), 9.52);
    assert.equal(parseSlipTotal("Quota Tot. 3.25"), 3.25);
    assert.equal(parseSlipTotal("schedina vuota"), null);
    assert.equal(parseSlipTotal("Quota Tot 1,00"), null, "1.00 non è un totale valido");
  });
});
