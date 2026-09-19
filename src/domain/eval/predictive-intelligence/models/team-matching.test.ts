import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchTeam,
  normalizeTeamName,
  similarity,
} from "@/domain/eval/predictive-intelligence/models/team-matching";

const E0 = ["Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Liverpool", "Man City", "Man United",
  "Newcastle", "Nott'm Forest", "Tottenham", "West Ham", "Wolves"];
const E1 = ["Cardiff", "Charlton", "Millwall", "Sheffield United", "Sheffield Weds",
  "Stoke", "Wrexham", "Southampton", "Bristol City", "Bristol Rovers"];
const D1 = ["M'gladbach", "Mainz", "Ein Frankfurt", "Freiburg", "Werder Bremen",
  "Augsburg", "Hamburg", "FC Koln", "Bayern Munich", "Dortmund"];
const I1 = ["Udinese", "Cagliari", "Bologna", "Torino", "Inter", "Milan", "Juventus"];
const SP1 = ["Osasuna", "Vallecano", "Real Madrid", "Barcelona", "Sociedad", "Betis",
  "Ath Madrid", "Ath Bilbao", "Espanol", "Celta", "Sevilla", "Villarreal"];

test("i nomi reali del calendario trovano la squadra giusta", () => {
  const cases: [string, string[], string][] = [
    ["Cardiff City FC", E1, "Cardiff"],
    ["Charlton Athletic FC", E1, "Charlton"],
    ["Millwall FC", E1, "Millwall"],
    ["Wrexham AFC", E1, "Wrexham"],
    ["Southampton FC", E1, "Southampton"],
    ["Tottenham Hotspur FC", E0, "Tottenham"],
    ["Aston Villa FC", E0, "Aston Villa"],
    ["Borussia Mönchengladbach", D1, "M'gladbach"],
    ["1. FSV Mainz 05", D1, "Mainz"],
    ["Eintracht Frankfurt", D1, "Ein Frankfurt"],
    ["SC Freiburg", D1, "Freiburg"],
    ["SV Werder Bremen", D1, "Werder Bremen"],
    ["FC Augsburg", D1, "Augsburg"],
    ["Hamburger SV", D1, "Hamburg"],
    ["1. FC Köln", D1, "FC Koln"],
    ["Udinese Calcio", I1, "Udinese"],
    ["Bologna FC 1909", I1, "Bologna"],
    ["Cagliari Calcio", I1, "Cagliari"],
    ["Torino FC", I1, "Torino"],
    ["CA Osasuna", SP1, "Osasuna"],
    ["Rayo Vallecano de Madrid", SP1, "Vallecano"],
    ["Real Madrid CF", SP1, "Real Madrid"],
    ["Club Atlético de Madrid", SP1, "Ath Madrid"],
    ["Real Sociedad de Fútbol", SP1, "Sociedad"],
    ["Real Betis Balompié", SP1, "Betis"],
    ["Athletic Club", SP1, "Ath Bilbao"],
  ];
  for (const [query, pool, want] of cases) {
    const r = matchTeam(query, pool);
    assert.equal(r.status, "MATCHED", `${query}: stato ${r.status}`);
    assert.equal(r.status === "MATCHED" && r.candidate, want, `${query} -> atteso ${want}`);
  }
});

test("nomi che si somigliano NON vengono confusi", () => {
  const a = matchTeam("Sheffield United FC", E1);
  assert.equal(a.status, "MATCHED");
  assert.equal(a.status === "MATCHED" && a.candidate, "Sheffield United");

  const b = matchTeam("Sheffield Wednesday FC", E1);
  if (b.status === "MATCHED") assert.equal(b.candidate, "Sheffield Weds");

  const c = matchTeam("Bristol City FC", E1);
  assert.equal(c.status === "MATCHED" && c.candidate, "Bristol City");
  const d = matchTeam("Bristol Rovers FC", E1);
  assert.equal(d.status === "MATCHED" && d.candidate, "Bristol Rovers");

  const e = matchTeam("Manchester City FC", E0);
  const f = matchTeam("Manchester United FC", E0);
  assert.notEqual(
    e.status === "MATCHED" ? e.candidate : "x",
    f.status === "MATCHED" ? f.candidate : "y",
  );
});

test("una squadra estranea al campionato viene rifiutata, non approssimata", () => {
  const r = matchTeam("Paris Saint-Germain FC", E0);
  assert.notEqual(r.status, "MATCHED", `PSG non e in Premier League, stato ${r.status}`);
  const s = matchTeam("Flamengo", I1);
  assert.notEqual(s.status, "MATCHED");
  // Betis non gioca in Premier League: l'alias esplicito non deve scavalcare il campionato
  const u = matchTeam("Real Betis Balompié", E0);
  assert.notEqual(u.status, "MATCHED", `Betis non e in E0, stato ${u.status}`);
  const t = matchTeam("", E0);
  assert.notEqual(t.status, "MATCHED");
});

test("la normalizzazione toglie sigle, numeri e accenti", () => {
  assert.equal(normalizeTeamName("1. FC Köln").normalized, "koln");
  assert.equal(normalizeTeamName("Bologna FC 1909").normalized, "bologna");
  assert.equal(normalizeTeamName("Borussia Mönchengladbach").normalized, "borussiamonchengladbach");
  assert.ok(similarity("Bologna FC 1909", "Bologna") === 1);
});

test("due candidati indistinguibili danno AMBIGUOUS, mai una scelta", () => {
  const r = matchTeam("United", ["United A", "United B"]);
  assert.notEqual(r.status, "MATCHED", `atteso rifiuto, ottenuto ${r.status}`);
});
