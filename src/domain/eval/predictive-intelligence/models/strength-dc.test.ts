import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  fitLeagueStrength,
  predictStrengthDc,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const NO_ODDS = {
  odds_open: { B365: { home: null, draw: null, away: null }, PS: { home: null, draw: null, away: null }, Avg: { home: null, draw: null, away: null } },
  research_odds_close: { B365C: { home: null, draw: null, away: null }, PSC: { home: null, draw: null, away: null } },
} as const;

function match(input: {
  id: string;
  day: number;
  home: string;
  away: string;
  gh: number;
  ga: number;
}): PiMatchRow {
  const d = new Date(Date.UTC(2024, 0, input.day));
  const iso = d.toISOString();
  const next = new Date(d.getTime() + 86_400_000).toISOString();
  return {
    canonical_id: input.id,
    source: "football-data-co-uk",
    season: "2324",
    league: "E0",
    match_date: iso.slice(0, 10),
    event_time: iso,
    home_team: input.home,
    away_team: input.away,
    home_team_id: input.home,
    away_team_id: input.away,
    fthg: input.gh,
    ftag: input.ga,
    ftr: input.gh > input.ga ? "HOME" : input.gh === input.ga ? "DRAW" : "AWAY",
    hthg: null, htag: null, htr: null,
    hs: null, as: null, hst: null, ast: null,
    hc: null, ac: null, hy: null, ay: null, hr: null, ar: null,
    ...NO_ODDS,
    label_time: next,
    result_available_at: next,
  } as PiMatchRow;
}

/** Round-robin so every team has a comparable schedule, then inject the contrast. */
function league(): PiMatchRow[] {
  const teams = ["STRONG_A", "STRONG_B", "WEAK_A", "WEAK_B", "MID_A", "MID_B"];
  const rows: PiMatchRow[] = [];
  let day = 1;
  let n = 0;
  for (let rep = 0; rep < 4; rep += 1) {
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = 0; j < teams.length; j += 1) {
        if (i === j) continue;
        const h = teams[i]!;
        const a = teams[j]!;
        const rank = (t: string) => (t.startsWith("STRONG") ? 2 : t.startsWith("MID") ? 1 : 0);
        const gh = 1 + rank(h);
        const ga = 1 + rank(a) - 1;
        rows.push(match({ id: `m${n++}`, day: day++, home: h, away: a, gh, ga: Math.max(0, ga) }));
      }
    }
  }
  return rows;
}

test("temporal firewall: fit ignores matches whose result is not yet available", () => {
  const rows = league();
  const cutIso = rows[40]!.event_time;
  const cutMs = Date.parse(cutIso);
  const priors = rows.filter((m) => Date.parse(m.result_available_at) < cutMs);

  const fitted = fitLeagueStrength({ league: "E0", matches: priors, asOfIso: cutIso });
  // Poison every match at or after the cutoff with an absurd scoreline.
  const poisoned = rows.map((m) =>
    Date.parse(m.result_available_at) >= cutMs ? { ...m, fthg: 9, ftag: 0 } : m,
  );
  const cache = new StrengthFitCache(poisoned, DEFAULT_STRENGTH_DC);
  const viaCache = cache.get("E0", cutIso);

  assert.equal(viaCache.n, fitted.n, "as-of slice must be identical");
  assert.ok(
    Math.abs(viaCache.mu - fitted.mu) < 1e-9,
    `future results must not move mu (${viaCache.mu} vs ${fitted.mu})`,
  );
  for (const [id, t] of fitted.teams) {
    const other = viaCache.teams.get(id)!;
    assert.ok(Math.abs(t.attack - other.attack) < 1e-9, `attack leaked for ${id}`);
    assert.ok(Math.abs(t.defence - other.defence) < 1e-9, `defence leaked for ${id}`);
  }
});

test("no market input: predictions are unchanged when every odds field is stripped", () => {
  const rows = league();
  const cutIso = rows[rows.length - 1]!.event_time;
  const withOdds = rows.map((m) => ({
    ...m,
    odds_open: { B365: { home: 1.5, draw: 4, away: 6 }, PS: { home: 1.5, draw: 4, away: 6 }, Avg: { home: 1.5, draw: 4, away: 6 } },
    research_odds_close: { B365C: { home: 1.2, draw: 5, away: 9 }, PSC: { home: 1.2, draw: 5, away: 9 } },
  })) as PiMatchRow[];

  const a = fitLeagueStrength({ league: "E0", matches: rows, asOfIso: cutIso });
  const b = fitLeagueStrength({ league: "E0", matches: withOdds, asOfIso: cutIso });
  const pa = predictStrengthDc({ fit: a, homeTeamId: "STRONG_A", awayTeamId: "WEAK_A" });
  const pb = predictStrengthDc({ fit: b, homeTeamId: "STRONG_A", awayTeamId: "WEAK_A" });
  assert.ok(Math.abs(pa.probability.HOME - pb.probability.HOME) < 1e-12);
  assert.ok(Math.abs(pa.probability.DRAW - pb.probability.DRAW) < 1e-12);
  assert.ok(Math.abs(pa.probability.AWAY - pb.probability.AWAY) < 1e-12);
});

test("opponent adjustment: identical goal record against tougher opponents yields higher attack", () => {
  // TOUGH_SCORER and EASY_SCORER both score exactly 2 per game, 8 games each.
  // TOUGH_SCORER faces the best defence in the league, EASY_SCORER the worst.
  const rows: PiMatchRow[] = [];
  let day = 1;
  let n = 0;
  for (let i = 0; i < 8; i += 1) {
    rows.push(match({ id: `t${n++}`, day: day++, home: "TOUGH_SCORER", away: "IRON_D", gh: 2, ga: 1 }));
    rows.push(match({ id: `e${n++}`, day: day++, home: "EASY_SCORER", away: "SIEVE_D", gh: 2, ga: 1 }));
    // give the two defences their reputations against a neutral filler side
    rows.push(match({ id: `f${n++}`, day: day++, home: "FILLER", away: "IRON_D", gh: 0, ga: 1 }));
    rows.push(match({ id: `g${n++}`, day: day++, home: "FILLER", away: "SIEVE_D", gh: 5, ga: 1 }));
  }
  const cutIso = new Date(Date.UTC(2024, 0, day + 1)).toISOString();
  const fit = fitLeagueStrength({
    league: "E0",
    matches: rows,
    asOfIso: cutIso,
    params: { ...DEFAULT_STRENGTH_DC, sotWeight: 0, halfLifeDays: 10_000, iterations: 200 },
  });

  const tough = fit.teams.get("TOUGH_SCORER")!;
  const easy = fit.teams.get("EASY_SCORER")!;
  const iron = fit.teams.get("IRON_D")!;
  const sieve = fit.teams.get("SIEVE_D")!;

  assert.ok(iron.defence < sieve.defence, "IRON_D must be rated the better defence");
  assert.ok(
    tough.attack > easy.attack,
    `same goals vs harder defence must rate higher: tough=${tough.attack.toFixed(4)} easy=${easy.attack.toFixed(4)}`,
  );
});

test("probabilities are proper and home advantage is positive", () => {
  const rows = league();
  const cutIso = rows[rows.length - 1]!.event_time;
  const fit = fitLeagueStrength({ league: "E0", matches: rows, asOfIso: cutIso });
  assert.ok(fit.gamma > 1, `home advantage should exceed 1, got ${fit.gamma}`);

  const p = predictStrengthDc({ fit, homeTeamId: "STRONG_A", awayTeamId: "WEAK_A" });
  const s = p.probability.HOME + p.probability.DRAW + p.probability.AWAY;
  assert.ok(Math.abs(s - 1) < 1e-9, `probabilities must sum to 1, got ${s}`);
  for (const v of Object.values(p.probability)) {
    assert.ok(v > 0 && v < 1, `probability out of range: ${v}`);
  }

  const reverse = predictStrengthDc({ fit, homeTeamId: "WEAK_A", awayTeamId: "STRONG_A" });
  assert.ok(
    p.probability.HOME > reverse.probability.HOME,
    "the stronger side at home must be favoured more than the weaker side at home",
  );
});
