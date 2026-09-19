import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COUNT_MODEL,
  fitCountStrength,
  lambdasFromCountFit,
  predictCountOverUnder,
  predictCountWinner,
  totalCountDistribution,
  type CountSample,
} from "@/domain/eval/predictive-intelligence/models/count-model";

const DAY = 86_400_000;
const T0 = Date.parse("2024-01-01T12:00:00Z");

function samples(): CountSample[] {
  // DOMINANTE prende molti corner contro chiunque, SUBITA ne concede molti.
  const out: CountSample[] = [];
  let d = 0;
  for (let i = 0; i < 30; i += 1) {
    out.push({ home: "DOMINANTE", away: "MEDIA", homeCount: 9, awayCount: 3, timeMs: T0 + d++ * DAY });
    out.push({ home: "MEDIA", away: "DOMINANTE", homeCount: 4, awayCount: 8, timeMs: T0 + d++ * DAY });
    out.push({ home: "MEDIA", away: "SUBITA", homeCount: 8, awayCount: 3, timeMs: T0 + d++ * DAY });
    out.push({ home: "SUBITA", away: "MEDIA", homeCount: 3, awayCount: 7, timeMs: T0 + d++ * DAY });
    out.push({ home: "MEDIA", away: "MEDIA2", homeCount: 6, awayCount: 5, timeMs: T0 + d++ * DAY });
  }
  return out;
}

const AS_OF = T0 + 400 * DAY;

test("le forze separano chi domina i corner da chi li concede", () => {
  const fit = fitCountStrength({ samples: samples(), asOfMs: AS_OF, params: { ...DEFAULT_COUNT_MODEL, halfLifeDays: 10_000, iterations: 200 } });
  assert.ok(fit.supported);
  const dom = fit.teams.get("DOMINANTE")!;
  const sub = fit.teams.get("SUBITA")!;
  assert.ok(dom.attack > sub.attack, `attacco: dominante ${dom.attack.toFixed(3)} vs subita ${sub.attack.toFixed(3)}`);
  assert.ok(sub.defence > dom.defence, `difesa: subita ${sub.defence.toFixed(3)} deve concedere piu di ${dom.defence.toFixed(3)}`);
  assert.ok(fit.gamma > 1, `vantaggio casa atteso positivo, ${fit.gamma}`);
});

test("la sovradispersione e rilevata e usata", () => {
  const over: CountSample[] = [];
  for (let i = 0; i < 200; i += 1) {
    const big = i % 4 === 0;
    over.push({ home: "A", away: "B", homeCount: big ? 14 : 2, awayCount: big ? 12 : 1, timeMs: T0 + i * DAY });
  }
  const fit = fitCountStrength({ samples: over, asOfMs: T0 + 400 * DAY, params: { ...DEFAULT_COUNT_MODEL, halfLifeDays: 10_000 } });
  assert.ok(fit.variance > fit.mean, "campione costruito sovradisperso");
  assert.ok(fit.dispersion != null && fit.dispersion > 0, "deve stimare r della negativa binomiale");

  // Con la stessa media, la negativa binomiale ha code piu spesse della Poisson.
  const nb = totalCountDistribution(10, fit.dispersion, 40);
  const po = totalCountDistribution(10, null, 40);
  const tailNb = nb.slice(20).reduce((a, b) => a + b, 0);
  const tailPo = po.slice(20).reduce((a, b) => a + b, 0);
  assert.ok(tailNb > tailPo, `coda NB ${tailNb.toExponential(2)} deve superare Poisson ${tailPo.toExponential(2)}`);
});

test("le distribuzioni sono proprie e le linee intere rifiutate", () => {
  const fit = fitCountStrength({ samples: samples(), asOfMs: AS_OF });
  const d = totalCountDistribution(9.8, fit.dispersion, 40);
  assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-9);

  const ou = predictCountOverUnder({ fit, homeId: "DOMINANTE", awayId: "SUBITA", line: 9.5 });
  assert.ok(Math.abs(ou.p_over + ou.p_under - 1) < 1e-9);
  assert.throws(() => predictCountOverUnder({ fit, homeId: "A", awayId: "B", line: 10 }), /rimborso/);

  const w = predictCountWinner({ fit, homeId: "DOMINANTE", awayId: "SUBITA" });
  assert.ok(Math.abs(w.HOME + w.DRAW + w.AWAY - 1) < 1e-9);
});

test("il dominatore e favorito nel mercato corner 1X2, in casa piu che fuori", () => {
  const fit = fitCountStrength({ samples: samples(), asOfMs: AS_OF, params: { ...DEFAULT_COUNT_MODEL, halfLifeDays: 10_000, iterations: 200 } });
  const casa = predictCountWinner({ fit, homeId: "DOMINANTE", awayId: "SUBITA" });
  const fuori = predictCountWinner({ fit, homeId: "SUBITA", awayId: "DOMINANTE" });
  assert.ok(casa.HOME > 0.5, `dominante in casa deve essere favorito, ${casa.HOME.toFixed(3)}`);
  assert.ok(casa.HOME > fuori.AWAY, "il vantaggio casa deve contare");

  const lamCasa = lambdasFromCountFit(fit, "DOMINANTE", "SUBITA");
  const lamFuori = lambdasFromCountFit(fit, "SUBITA", "DOMINANTE");
  assert.ok(lamCasa.lambda_home > lamFuori.lambda_home, "il dominatore in casa prende piu corner");
});

test("squadra mai vista ricade sulla media senza far esplodere nulla", () => {
  const fit = fitCountStrength({ samples: samples(), asOfMs: AS_OF });
  const l = lambdasFromCountFit(fit, "SCONOSCIUTA_A", "SCONOSCIUTA_B");
  assert.ok(Number.isFinite(l.lambda_total) && l.lambda_total > 0);
  const p = predictCountOverUnder({ fit, homeId: "SCONOSCIUTA_A", awayId: "SCONOSCIUTA_B", line: 9.5 });
  assert.ok(p.p_over > 0 && p.p_over < 1);
});
