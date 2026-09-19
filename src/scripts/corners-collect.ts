/**
 * RACCOLTA PROSPETTICA SUI CORNER.
 *
 * Non esistono prezzi corner storici, quindi il modello finora e stato
 * confrontato solo con la media di lega. Con la media di lega vince; con il
 * mercato non si sa, ed e l'unica domanda che conta. L'unico modo onesto di
 * rispondere e guardare avanti: registrare, prima del fischio, la linea del book
 * e la probabilita del modello, e liquidare dopo.
 *
 * Nessuna scommessa viene proposta e nessun capitale e coinvolto: si costruisce
 * un registro. Fra qualche settimana i numeri diranno se il modello batte
 * davvero la linea corner, e a quel punto il margine del 5-7% diventera una
 * domanda legittima invece di un ostacolo teorico.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OddsApiClient } from "@/providers/the-odds-api/client";
import {
  DEFAULT_COUNT_MODEL,
  fitCountStrength,
  lambdasFromCountFit,
  totalCountDistribution,
  type CountSample,
} from "@/domain/eval/predictive-intelligence/models/count-model";
import { matchTeam } from "@/domain/eval/predictive-intelligence/models/team-matching";
import { assertFresh } from "@/domain/eval/predictive-intelligence/dataset/freshness";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");
const DIR = join(ROOT, "audit/external/task-044/corners-prospective");
const LEDGER = join(DIR, "observations.jsonl");

/** Solo i campionati dove i mercati corner esistono davvero (verificato). */
const LEAGUES: [string, string][] = [
  ["soccer_epl", "E0"],
  ["soccer_efl_champ", "E1"],
  ["soccer_italy_serie_a", "I1"],
  ["soccer_spain_la_liga", "SP1"],
  ["soccer_france_ligue_one", "F1"],
  ["soccer_germany_bundesliga", "D1"],
];

const MARKETS = ["alternate_totals_corners", "alternate_team_totals_corners"];

function apiKey(): string {
  const fromEnv = process.env.THE_ODDS_API_KEY;
  if (fromEnv) return fromEnv.trim();
  const text = readFileSync(join(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^THE_ODDS_API_KEY=(.*)$/.exec(line.trim());
    if (m && (m[1] ?? "").trim()) return (m[1] ?? "").trim();
  }
  throw new Error("THE_ODDS_API_KEY non trovata");
}

async function main(): Promise<void> {
  const client = new OddsApiClient(apiKey());
  const runAt = new Date().toISOString();
  const history = readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow);

  const byLeague = new Map<string, PiMatchRow[]>();
  for (const m of history) {
    const a = byLeague.get(m.league) ?? [];
    a.push(m);
    byLeague.set(m.league, a);
  }
  const seasons = [...new Set(history.map((m) => m.season))].sort();
  const recent = new Set(seasons.slice(-2));
  const roster: string[] = [];
  const nameToId = new Map<string, string>();
  for (const m of history) {
    if (!recent.has(m.season)) continue;
    for (const [nm, id] of [[m.home_team, m.home_team_id], [m.away_team, m.away_team_id]] as const) {
      if (!nameToId.has(nm)) roster.push(nm);
      nameToId.set(nm, id);
    }
  }

  // Nessuna previsione live con dati vecchi: un dataset fermo supera tutti i
  // backtest e sbaglia solo sul presente, che e l'unico momento che conta.
  const fresh = assertFresh({
    seasons: [...new Set(history.map((m) => m.season))],
    latestMatchIso: history.map((m) => m.event_time).sort().at(-1) ?? null,
  });
  process.stdout.write(`dataset: stagione ${fresh.latestSeason}, ultima partita ${fresh.daysSinceLatestMatch} giorni fa\n`);

  let written = 0;
  let noMatch = 0;
  mkdirSync(DIR, { recursive: true });

  for (const [sportKey, div] of LEAGUES) {
    const events = await client.listEvents(sportKey);
    const list = (byLeague.get(div) ?? []).filter((m) => m.hc != null && m.ac != null);
    for (const ev of events) {
      const mh = matchTeam(ev.home_team, roster);
      const ma = matchTeam(ev.away_team, roster);
      if (mh.status !== "MATCHED" || ma.status !== "MATCHED") {
        noMatch += 1;
        continue;
      }
      const homeId = nameToId.get(mh.candidate)!;
      const awayId = nameToId.get(ma.candidate)!;
      const cutMs = Date.parse(ev.commence_time);
      const samples: CountSample[] = list
        .filter((m) => Date.parse(m.result_available_at) < cutMs)
        .map((m) => ({ home: m.home_team_id, away: m.away_team_id, homeCount: m.hc!, awayCount: m.ac!, timeMs: Date.parse(m.event_time) }));
      const fit = fitCountStrength({ samples, asOfMs: cutMs, params: { ...DEFAULT_COUNT_MODEL, halfLifeDays: 200, shrinkage: 8 } });
      if (!fit.supported) continue;

      const detail = await client.eventOdds(sportKey, ev.id, MARKETS);
      const lam = lambdasFromCountFit(fit, homeId, awayId);
      const distTotal = totalCountDistribution(lam.lambda_total, fit.dispersion, DEFAULT_COUNT_MODEL.maxCount);
      const distHome = totalCountDistribution(lam.lambda_home, fit.dispersion, DEFAULT_COUNT_MODEL.maxCount);
      const distAway = totalCountDistribution(lam.lambda_away, fit.dispersion, DEFAULT_COUNT_MODEL.maxCount);
      const pOver = (d: number[], line: number) => d.reduce((a, v, k) => (k > line ? a + v : a), 0);

      for (const b of detail.bookmakers ?? []) {
        for (const m of b.markets) {
          for (const o of m.outcomes) {
            if (o.point == null) continue;
            const isOver = /over/i.test(o.name);
            const isUnder = /under/i.test(o.name);
            if (!isOver && !isUnder) continue;
            let dist = distTotal;
            let scope = "total";
            if (m.key === "alternate_team_totals_corners") {
              const isHome = o.description ? matchTeam(o.description, [mh.candidate, ma.candidate]).status === "MATCHED" && o.description.includes(ev.home_team.split(" ")[0]!) : false;
              dist = isHome ? distHome : distAway;
              scope = isHome ? "home" : "away";
            }
            const p = isOver ? pOver(dist, o.point) : 1 - pOver(dist, o.point);
            appendFileSync(LEDGER, JSON.stringify({
              run_at: runAt, sport_key: sportKey, division: div, event_id: ev.id,
              commence_time: ev.commence_time,
              source_home: ev.home_team, source_away: ev.away_team,
              home: mh.candidate, away: ma.candidate,
              bookmaker: b.title, market: m.key, scope,
              side: isOver ? "OVER" : "UNDER", line: o.point, price: o.price,
              model_probability: p, model_lambda_total: lam.lambda_total,
              model_lambda_home: lam.lambda_home, model_lambda_away: lam.lambda_away,
              dispersion: fit.dispersion, train_n: fit.n,
              settled: false, result_corners_home: null, result_corners_away: null,
            }) + "\n");
            written += 1;
          }
        }
      }
    }
  }

  process.stdout.write(`\nosservazioni registrate: ${written}\n`);
  process.stdout.write(`eventi scartati per abbinamento non certo: ${noMatch}\n`);
  process.stdout.write(`registro: ${LEDGER}\n\n`);
  process.stdout.write(client.report() + "\n");
}

void main();
