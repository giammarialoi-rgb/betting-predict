/**
 * TABELLONE 7 GIORNI — le partite in arrivo, con la vista del modello.
 *
 * Calendario da football-data.org (le quote sono un pacchetto a pagamento: qui
 * NON ci sono prezzi, quindi non esiste edge e nessuna selezione e proposta).
 * Questo e il pezzo che non dipende da un acquisto: chi gioca, se il modello
 * sa prezzarlo, e cosa dice.
 *
 * Una partita entra nel tabellone SOLO se entrambe le squadre sono state
 * abbinate con certezza allo storico. Un abbinamento incerto esclude la
 * partita: una previsione sulla squadra sbagliata e peggio di nessuna previsione.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  predictStrengthDc,
  predictTotalsStrengthDc,
  type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import {
  DEFAULT_COUNT_MODEL,
  fitCountStrength,
  lambdasFromCountFit,
  predictCountWinner,
  totalCountDistribution,
  type CountSample,
} from "@/domain/eval/predictive-intelligence/models/count-model";
import { applyTemperature } from "@/domain/eval/predictive-intelligence/models/temperature";
import {
  COMPETITION_TO_DIVISION,
  matchTeam,
} from "@/domain/eval/predictive-intelligence/models/team-matching";
import { assertFresh } from "@/domain/eval/predictive-intelligence/dataset/freshness";
import {
  effectiveSample,
  informationShare,
} from "@/domain/eval/predictive-intelligence/models/effective-sample";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const DATASET = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");
const OUT = join(ROOT, "audit", "board-7days.json");

/**
 * Taratura del 20/09/2026, dopo l'ingresso degli xG nel fit.
 *
 * Con un bersaglio meno rumoroso conviene guardare piu indietro (emivita da 150
 * a 180 giorni) e regolarizzare meno (shrinkage da 9 a 4), e serve meno
 * forzatura in uscita (temperatura da 0,7 a 0,8). Sui big-5 il divario di log
 * loss dal mercato scende da 11,5 a 7,7 millesimi su tre stagioni; sulle
 * divisioni senza xG resta invariato (5,5 -> 5,6, cioe rumore).
 */
const PARAMS: StrengthDcParams = {
  ...DEFAULT_STRENGTH_DC, halfLifeDays: 180, shrinkage: 4, rho: -0.12, sotWeight: 0.8, xgWeight: 0.9, iterations: 60,
};
const TEMPERATURE = 0.8;

/**
 * Shrinkage usato SOLO per la quota di informazione, tenuto a 9 di proposito.
 *
 * Quel numero non regolarizza il fit: misura se una squadra ha abbastanza
 * storico perche valga la pena fidarsi della previsione — il filtro nato dal
 * caso Frosinone-Como. Agganciarlo a PARAMS.shrinkage lo renderebbe piu
 * permissivo per un motivo che non c'entra, e passerebbero previsioni su
 * squadre che prima venivano scartate.
 */
const INFORMATION_SHRINKAGE = 9;

type Fixture = {
  utcDate: string;
  competition: { code: string; name: string };
  homeTeam: { name: string };
  awayTeam: { name: string };
};

function env(key: string): string | null {
  const text = readFileSync(join(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = new RegExp(`^${key}=(.*)$`).exec(line.trim());
    if (m) return (m[1] ?? "").trim() || null;
  }
  return null;
}

async function fetchFixtures(days: number): Promise<Fixture[]> {
  const token = env("FOOTBALL_DATA_ORG_TOKEN");
  if (!token) throw new Error("FOOTBALL_DATA_ORG_TOKEN assente in .env.local");
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`,
    { headers: { "X-Auth-Token": token } },
  );
  if (!res.ok) throw new Error(`football-data.org ha risposto ${res.status}`);
  const json = (await res.json()) as { matches?: Fixture[] };
  return json.matches ?? [];
}

async function main(): Promise<void> {
  const days = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7);
  const history = readFileSync(DATASET, "utf8").trim().split("\n").map((l) => JSON.parse(l) as PiMatchRow);

  const byLeague = new Map<string, PiMatchRow[]>();
  for (const m of history) {
    const a = byLeague.get(m.league) ?? [];
    a.push(m);
    byLeague.set(m.league, a);
  }
  for (const a of byLeague.values()) {
    a.sort((x, y) => Date.parse(x.result_available_at) - Date.parse(y.result_available_at));
  }
  // Rosa GLOBALE, non per divisione: promosse e retrocesse cambiano categoria
  // ogni anno, e cercarle solo nella divisione di destinazione le rende
  // invisibili. Le ultime due stagioni di tutte le divisioni, e l'identita di
  // squadra e la stessa fra categorie.
  const seasonsAll = [...new Set(history.map((m) => m.season))].sort();
  const recent = new Set(seasonsAll.slice(-2));
  const names = new Set<string>();
  const nameToId = new Map<string, string>();
  const divisionsOfTeam = new Map<string, Set<string>>();
  for (const m of history) {
    if (!recent.has(m.season)) continue;
    for (const [nm, id] of [[m.home_team, m.home_team_id], [m.away_team, m.away_team_id]] as const) {
      names.add(nm);
      nameToId.set(nm, id);
      const ds = divisionsOfTeam.get(id) ?? new Set<string>();
      ds.add(m.league);
      divisionsOfTeam.set(id, ds);
    }
  }
  const globalRoster = [...names].sort();

  // Nessuna previsione live con dati vecchi: un dataset fermo supera tutti i
  // backtest e sbaglia solo sul presente, che e l'unico momento che conta.
  const fresh = assertFresh({
    seasons: [...new Set(history.map((m) => m.season))],
    latestMatchIso: history.map((m) => m.event_time).sort().at(-1) ?? null,
  });
  process.stdout.write(`dataset: stagione ${fresh.latestSeason}, ultima partita ${fresh.daysSinceLatestMatch} giorni fa\n`);

  const fixtures = await fetchFixtures(days);
  process.stdout.write(`calendario: ${fixtures.length} partite nei prossimi ${days} giorni\n\n`);

  const priors = (lg: string, cut: number) =>
    (byLeague.get(lg) ?? []).filter((m) => Date.parse(m.result_available_at) < cut);
  const goalCache = new StrengthFitCache(priors, PARAMS);
  const cornerFits = new Map<string, ReturnType<typeof fitCountStrength>>();

  const rows: Record<string, unknown>[] = [];
  const skipped: { fixture: string; reason: string }[] = [];

  for (const f of fixtures) {
    const div = COMPETITION_TO_DIVISION[f.competition.code];
    if (!div) {
      skipped.push({ fixture: `${f.homeTeam.name} - ${f.awayTeam.name}`, reason: `campionato fuori copertura (${f.competition.code})` });
      continue;
    }
    const mh = matchTeam(f.homeTeam.name, globalRoster);
    const ma = matchTeam(f.awayTeam.name, globalRoster);
    if (mh.status !== "MATCHED" || ma.status !== "MATCHED") {
      skipped.push({
        fixture: `${f.homeTeam.name} - ${f.awayTeam.name}`,
        reason: `abbinamento non certo (casa ${mh.status}, trasferta ${ma.status})`,
      });
      continue;
    }
    const homeId = nameToId.get(mh.candidate)!;
    const awayId = nameToId.get(ma.candidate)!;

    // Quanta squadra c'è davvero nella stima. Il flag "senza storico" non basta:
    // il Frosinone aveva 42 partite in Serie A e pesava 4.11 contro uno
    // shrinkage di 9, cioè due terzi di media di lega. Il flag valeva 0 e la
    // previsione sembrava una previsione.
    const kickoffMs = Date.parse(f.utcDate);
    const partiteDi = (nome: string): number[] =>
      (byLeague.get(div) ?? [])
        .filter((m) => m.home_team === nome || m.away_team === nome)
        .map((m) => Date.parse(m.match_date))
        .filter((t) => Number.isFinite(t) && t < kickoffMs);
    const pesoCasa = effectiveSample(partiteDi(mh.candidate), kickoffMs, PARAMS.halfLifeDays);
    const pesoOspite = effectiveSample(partiteDi(ma.candidate), kickoffMs, PARAMS.halfLifeDays);
    const quotaInformazione = Math.min(
      informationShare(pesoCasa, INFORMATION_SHRINKAGE),
      informationShare(pesoOspite, INFORMATION_SHRINKAGE),
    );
    // Una squadra appena promossa o retrocessa non ha storico in QUESTA
    // divisione: lo shrinkage la riporta alla media di lega, quindi la previsione
    // esiste ma vale poco. Va detto, non nascosto.
    const newToDivision = [homeId, awayId].filter((id) => !(divisionsOfTeam.get(id)?.has(div) ?? false));
    const cutIso = `${f.utcDate.slice(0, 10)}T00:00:00.000Z`;
    const cutMs = Date.parse(cutIso);

    const fit = goalCache.get(div, cutIso);
    if (!fit.supported) {
      skipped.push({ fixture: `${mh.candidate} - ${ma.candidate}`, reason: "storico insufficiente" });
      continue;
    }
    const p = predictStrengthDc({ fit, homeTeamId: homeId, awayTeamId: awayId, params: PARAMS });
    const prob = applyTemperature(p.probability, TEMPERATURE);
    const tot = predictTotalsStrengthDc({ fit, homeTeamId: homeId, awayTeamId: awayId, line: 2.5, params: PARAMS });

    const ckey = `${div}|${cutIso}`;
    let cfit = cornerFits.get(ckey);
    if (!cfit) {
      const samples: CountSample[] = priors(div, cutMs)
        .filter((m) => m.hc != null && m.ac != null)
        .map((m) => ({ home: m.home_team_id, away: m.away_team_id, homeCount: m.hc!, awayCount: m.ac!, timeMs: Date.parse(m.event_time) }));
      cfit = fitCountStrength({ samples, asOfMs: cutMs, params: { ...DEFAULT_COUNT_MODEL, halfLifeDays: 200, shrinkage: 8 } });
      cornerFits.set(ckey, cfit);
    }
    const cw = cfit.supported ? predictCountWinner({ fit: cfit, homeId, awayId }) : null;
    let homeCornersOver45: number | null = null;
    if (cfit.supported) {
      const lam = lambdasFromCountFit(cfit, homeId, awayId);
      const d = totalCountDistribution(lam.lambda_home, cfit.dispersion, DEFAULT_COUNT_MODEL.maxCount);
      homeCornersOver45 = d.reduce((acc, v, k) => (k > 4.5 ? acc + v : acc), 0);
    }

    rows.push({
      kickoff: f.utcDate,
      competition: f.competition.code,
      division: div,
      home: mh.candidate,
      away: ma.candidate,
      source_home: f.homeTeam.name,
      source_away: f.awayTeam.name,
      match_confidence: Math.min(mh.score, ma.score),
      teams_without_history_in_division: newToDivision.length,
      effective_sample_home: pesoCasa,
      effective_sample_away: pesoOspite,
      information_share: quotaInformazione,
      model: {
        home: prob.HOME, draw: prob.DRAW, away: prob.AWAY,
        over_2_5: tot.p_over,
        lambda_home: p.lambda_home, lambda_away: p.lambda_away,
        corners_home_more: cw?.HOME ?? null,
        corners_draw: cw?.DRAW ?? null,
        corners_away_more: cw?.AWAY ?? null,
        home_corners_over_4_5: homeCornersOver45,
      },
      market: null,
      edge: null,
      note: newToDivision.length
        ? `nessun prezzo disponibile; inoltre ${newToDivision.length} squadra/e senza storico in ${div}: previsione vicina alla media di lega`
        : "nessun prezzo disponibile: edge non calcolabile",
    });
  }

  rows.sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
  process.stdout.write(
    `${"quando".padEnd(17)} ${"lega".padEnd(5)} ${"partita".padEnd(34)} ${"1".padStart(6)} ${"X".padStart(6)} ${"2".padStart(6)} ${"O2.5".padStart(6)} ${"cor.1".padStart(6)}\n`,
  );
  process.stdout.write("-".repeat(96) + "\n");
  for (const r of rows.slice(0, 25)) {
    const m = r.model as Record<string, number | null>;
    const when = String(r.kickoff).slice(5, 16).replace("T", " ");
    const flag = (r.teams_without_history_in_division as number) > 0 ? " *" : "";
    const game = `${r.home} - ${r.away}${flag}`;
    process.stdout.write(
      `${when.padEnd(17)} ${String(r.division).padEnd(5)} ${game.slice(0, 34).padEnd(34)} ${(m.home! * 100).toFixed(1).padStart(5)}% ${(m.draw! * 100).toFixed(1).padStart(5)}% ${(m.away! * 100).toFixed(1).padStart(5)}% ${(m.over_2_5! * 100).toFixed(1).padStart(5)}% ${m.corners_home_more != null ? (m.corners_home_more * 100).toFixed(1).padStart(5) + "%" : "    -"}\n`,
    );
  }
  if (rows.length > 25) process.stdout.write(`... e altre ${rows.length - 25}\n`);

  const weak = rows.filter((r) => (r.teams_without_history_in_division as number) > 0).length;
  process.stdout.write(`\nnel tabellone: ${rows.length} / ${fixtures.length}   (* = ${weak} con almeno una squadra senza storico nella divisione)\n`);
  const byReason = new Map<string, number>();
  for (const s of skipped) {
    const k = s.reason.replace(/\(.*\)/, "").trim();
    byReason.set(k, (byReason.get(k) ?? 0) + 1);
  }
  for (const [k, v] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  escluse ${v}: ${k}\n`);
  }
  for (const s of skipped.filter((x) => x.reason.startsWith("abbinamento"))) {
    process.stdout.write(`    ${s.fixture} — ${s.reason}\n`);
  }

  mkdirSync(join(ROOT, "audit"), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), days, fixtures: fixtures.length, board: rows, skipped }, null, 2));
  process.stdout.write(`\n-> ${OUT}\n`);
}

void main();
