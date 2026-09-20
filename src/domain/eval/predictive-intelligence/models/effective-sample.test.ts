import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decayWeight,
  effectiveSample,
  informationShare,
  isInformative,
} from "@/domain/eval/predictive-intelligence/models/effective-sample";

describe("peso di una partita", () => {
  it("una partita di oggi vale uno, una di un'emivita fa vale mezzo", () => {
    assert.equal(decayWeight(0, 150), 1);
    assert.ok(Math.abs(decayWeight(150, 150) - 0.5) < 1e-12);
    assert.ok(Math.abs(decayWeight(300, 150) - 0.25) < 1e-12);
  });

  it("oltre otto dimezzamenti si azzera", () => {
    assert.equal(decayWeight(150 * 8 + 1, 150), 0);
    assert.ok(decayWeight(150 * 7, 150) > 0);
  });

  it("una partita futura non pesa", () => {
    assert.equal(decayWeight(-1, 150), 0);
  });
});

describe("quanta squadra c'è nella stima", () => {
  it("a peso pari allo shrinkage la stima è metà squadra e metà lega", () => {
    assert.ok(Math.abs(informationShare(9, 9) - 0.5) < 1e-12);
  });

  it("senza storico la stima è tutta media di lega", () => {
    assert.equal(informationShare(0, 9), 0);
  });

  it("il caso Frosinone: 4.11 contro shrinkage 9", () => {
    // Oltre due terzi della stima era la media della Serie A.
    const share = informationShare(4.11, 9);
    assert.ok(share < 0.34, `quota di informazione ${share}`);
    assert.equal(isInformative(4.11, 9), false, "non doveva entrare in un biglietto");
  });

  it("il caso Como: 18.65 contro shrinkage 9", () => {
    assert.ok(informationShare(18.65, 9) > 0.67);
    assert.equal(isInformative(18.65, 9), true);
  });

  it("rifiuta parametri impossibili", () => {
    assert.throws(() => informationShare(5, 0), /shrinkage non valido/);
    assert.throws(() => informationShare(-1, 9), /peso efficace non valido/);
    assert.throws(() => decayWeight(10, 0), /emivita non valida/);
  });
});

describe("peso efficace di una squadra", () => {
  const giorno = 86_400_000;
  const oggi = Date.UTC(2026, 8, 20);

  it("somma i pesi delle partite", () => {
    const quattroRecenti = [oggi - giorno, oggi - 2 * giorno, oggi - 3 * giorno, oggi - 4 * giorno];
    const s = effectiveSample(quattroRecenti, oggi, 150);
    assert.ok(s > 3.9 && s <= 4, `peso ${s}`);
  });

  it("una stagione vecchia conta molto meno di quattro partite di oggi", () => {
    const vecchie = Array.from({ length: 38 }, (_, i) => oggi - (900 + i) * giorno);
    const recenti = Array.from({ length: 4 }, (_, i) => oggi - (i + 1) * giorno);
    assert.ok(
      effectiveSample(vecchie, oggi, 150) < effectiveSample(recenti, oggi, 150),
      "38 partite di tre anni fa pesano meno di 4 di ieri",
    );
  });

  it("ignora le date non valide invece di propagarle", () => {
    assert.equal(effectiveSample([Number.NaN, oggi], oggi, 150), 1);
  });
});
