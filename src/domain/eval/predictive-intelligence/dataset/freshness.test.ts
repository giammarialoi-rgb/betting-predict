import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFresh,
  assessFreshness,
  currentSeasonCode,
} from "@/domain/eval/predictive-intelligence/dataset/freshness";

test("il codice stagione segue il calendario europeo", () => {
  assert.equal(currentSeasonCode(new Date("2026-09-20T00:00:00Z")), "2627");
  assert.equal(currentSeasonCode(new Date("2026-07-01T00:00:00Z")), "2627");
  assert.equal(currentSeasonCode(new Date("2026-06-30T00:00:00Z")), "2526");
  assert.equal(currentSeasonCode(new Date("2027-05-15T00:00:00Z")), "2627");
  assert.equal(currentSeasonCode(new Date("2030-01-10T00:00:00Z")), "2930");
});

test("riproduce il difetto reale del 20 settembre 2026", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  const v = assessFreshness({
    seasons: ["1920", "2021", "2122", "2223", "2324", "2425"],
    latestMatchIso: "2025-05-25T00:00:00Z",
    now,
  });
  assert.equal(v.ok, false);
  assert.equal(v.latestSeason, "2425");
  assert.equal(v.expectedSeason, "2627");
  assert.equal(v.seasonsBehind, 2);
  assert.ok(v.problems.some((p) => /2 stagione/.test(p)));
  assert.ok(v.problems.some((p) => /giorni fa/.test(p)));
});

test("il dataset corretto passa", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  const v = assessFreshness({
    seasons: ["2324", "2425", "2526", "2627"],
    latestMatchIso: "2026-09-18T00:00:00Z",
    now,
  });
  assert.equal(v.ok, true, v.problems.join("; "));
  assert.equal(v.seasonsBehind, 0);
});

test("una stagione sola di ritardo viene comunque segnalata", () => {
  const v = assessFreshness({ seasons: ["2425", "2526"], now: new Date("2026-09-20T00:00:00Z") });
  assert.equal(v.ok, false);
  assert.equal(v.seasonsBehind, 1);
});

test("in pausa estiva l'ultima partita vecchia non e un errore di stagione", () => {
  // Il 10 luglio la stagione appena iniziata non ha ancora partite: il codice
  // stagione e corretto, ma l'ultima partita risale a maggio.
  const v = assessFreshness({
    seasons: ["2526", "2627"],
    latestMatchIso: "2026-05-25T00:00:00Z",
    now: new Date("2026-07-10T00:00:00Z"),
    maxDaysSinceMatch: 90,
  });
  assert.equal(v.seasonsBehind, 0);
  assert.equal(v.ok, true, v.problems.join("; "));
});

test("assertFresh interrompe con un messaggio che dice cosa fare", () => {
  assert.throws(
    () => assertFresh({ seasons: ["2425"], now: new Date("2026-09-20T00:00:00Z") }),
    /DATASET NON AGGIORNATO[\s\S]*data:build-expanded/,
  );
  assert.doesNotThrow(() =>
    assertFresh({ seasons: ["2627"], now: new Date("2026-09-20T00:00:00Z") }),
  );
});
