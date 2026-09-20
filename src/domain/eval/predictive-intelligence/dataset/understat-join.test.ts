import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  joinUnderstatXg,
  matchTeamsByCalendar,
  nameSimilarity,
  type TargetFixture,
  type UnderstatFixture,
} from "@/domain/eval/predictive-intelligence/dataset/understat-join";

/**
 * Mini-campionato a quattro squadre, andata e ritorno, con anagrafiche diverse
 * fra le due fonti. "Wolverhampton Wanderers" e "Wolves" non si somigliano
 * abbastanza da accoppiarsi per nome: e il calendario a doverli unire.
 */
const NOMI: Array<[string, string]> = [
  ["Wolverhampton Wanderers", "Wolves"],
  ["Manchester United", "Man United"],
  ["Tottenham", "Spurs"],
  ["Paris Saint Germain", "Paris SG"],
];

function calendario(): Array<{ date: string; h: number; a: number }> {
  // ogni giornata due partite; sei giornate coprono andata e ritorno
  const giornate: Array<Array<[number, number]>> = [
    [[0, 1], [2, 3]],
    [[1, 2], [3, 0]],
    [[0, 2], [1, 3]],
    [[1, 0], [3, 2]],
    [[2, 1], [0, 3]],
    [[2, 0], [3, 1]],
  ];
  const out: Array<{ date: string; h: number; a: number }> = [];
  giornate.forEach((g, i) => {
    const day = new Date(Date.UTC(2024, 7, 10 + i * 7)).toISOString().slice(0, 10);
    for (const [h, a] of g) out.push({ date: day, h, a });
  });
  return out;
}

function fonti(): { understat: UnderstatFixture[]; target: TargetFixture[] } {
  const understat: UnderstatFixture[] = [];
  const target: TargetFixture[] = [];
  calendario().forEach((m, i) => {
    const gh = i % 3;
    const ga = (i + 1) % 2;
    understat.push({
      date: m.date,
      home: NOMI[m.h]![0],
      away: NOMI[m.a]![0],
      goalsHome: gh,
      goalsAway: ga,
      xgHome: 1 + i * 0.1,
      xgAway: 0.5 + i * 0.05,
    });
    target.push({
      key: `k${i}`,
      date: m.date,
      home: NOMI[m.h]![1],
      away: NOMI[m.a]![1],
      goalsHome: gh,
      goalsAway: ga,
    });
  });
  return { understat, target };
}

describe("aggancio xG Understat", () => {
  test("accoppia le squadre dal calendario, non dal nome", () => {
    const { understat, target } = fonti();
    const map = matchTeamsByCalendar(understat, target);
    for (const [u, t] of NOMI) assert.equal(map.get(u), t);
    // il nome da solo sbaglierebbe: "Spurs" somiglia a "Paris SG" quanto a "Tottenham"
    assert.equal(nameSimilarity("Tottenham", "Spurs"), 0);
  });

  test("unisce ogni partita una volta sola", () => {
    const { understat, target } = fonti();
    const { xg, report } = joinUnderstatXg(understat, target);
    assert.equal(report.joined, understat.length);
    assert.equal(report.rejectedGoals, 0);
    assert.equal(report.ambiguous, 0);
    assert.equal(xg.get("k0")?.hxg, 1);
  });

  test("tollera uno sfasamento di un giorno sulla data", () => {
    const { understat, target } = fonti();
    const spostate = understat.map((u, i) =>
      i % 2 === 0
        ? { ...u, date: new Date(Date.parse(`${u.date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10) }
        : u,
    );
    const { report } = joinUnderstatXg(spostate, target);
    assert.equal(report.joined, understat.length);
  });

  test("scarta la riga se i gol delle due fonti non coincidono", () => {
    const { understat, target } = fonti();
    const sporche = understat.map((u, i) => (i === 3 ? { ...u, goalsHome: u.goalsHome + 4 } : u));
    const { xg, report } = joinUnderstatXg(sporche, target);
    assert.equal(report.rejectedGoals, 1);
    assert.equal(report.joined, understat.length - 1);
    assert.equal(xg.has("k3"), false);
  });

  test("non inventa xG quando la partita non esiste nella destinazione", () => {
    const { understat, target } = fonti();
    const { report } = joinUnderstatXg(understat, target.slice(0, 6));
    assert.ok(report.joined <= 6);
    assert.equal(report.joined + report.ambiguous + report.rejectedGoals, understat.length);
  });
});
