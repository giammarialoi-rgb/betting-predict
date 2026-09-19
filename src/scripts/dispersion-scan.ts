/**
 * SCANSIONE DISPERSIONE — dove un book si e scollato dal consenso.
 *
 * Non prevede nulla: prende il consenso di mercato come stima equa e cerca chi
 * offre un prezzo migliore. E' la leva misurata due volte (+3,5 punti sullo
 * storico Over/Under, +3,5/+3,9 sui prezzi live), l'unica che superi di gran
 * lunga qualunque modello predittivo di questo repo.
 *
 * Ogni scansione salva uno snapshot con l'ora esatta: e la base del registro CLV,
 * che e l'unico modo onesto di sapere se questi edge sono veri prima di
 * rischiare capitale.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OddsApiClient, type OddsApiEvent } from "@/providers/the-odds-api/client";
import { analyseDispersion, type BookQuote } from "@/domain/markets/dispersion";

const ROOT = process.cwd();
const SNAP_DIR = join(ROOT, "audit/external/task-044/dispersion");

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

const LEAGUES = [
  "soccer_epl", "soccer_efl_champ", "soccer_england_league1", "soccer_england_league2",
  "soccer_spain_la_liga", "soccer_spain_segunda_division",
  "soccer_italy_serie_a", "soccer_italy_serie_b",
  "soccer_germany_bundesliga", "soccer_germany_bundesliga2",
  "soccer_france_ligue_one", "soccer_netherlands_eredivisie",
  "soccer_portugal_primeira_liga", "soccer_belgium_first_div",
  "soccer_turkey_super_league", "soccer_greece_super_league", "soccer_spl",
];

function quotesFor(ev: OddsApiEvent, marketKey: string, outcomeNames: string[]): BookQuote[] {
  const out: BookQuote[] = [];
  for (const b of ev.bookmakers ?? []) {
    const m = b.markets.find((x) => x.key === marketKey);
    if (!m) continue;
    const prices = outcomeNames.map((n) => m.outcomes.find((o) => o.name === n)?.price);
    if (prices.every((p) => typeof p === "number" && p > 1)) {
      out.push({ book: b.title, prices: prices as number[] });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const client = new OddsApiClient(apiKey());
  const minEdge = Number(process.argv.find((a) => a.startsWith("--min-edge="))?.split("=")[1] ?? 0.02);
  const regions = process.argv.find((a) => a.startsWith("--regions="))?.split("=")[1] ?? "eu,uk";
  const runAt = new Date().toISOString();

  type Row = {
    sport: string; eventId: string; commence: string; home: string; away: string;
    outcome: string; bestBook: string; priceRaw: number; priceNet: number;
    fairPrice: number; edge: number; nBooks: number; consensus: string; executionGain: number;
  };
  const rows: Row[] = [];
  const perLeague: { league: string; events: number; withEdge: number }[] = [];

  for (const key of LEAGUES) {
    let evs: OddsApiEvent[];
    try {
      evs = await client.leagueOdds(key, ["h2h"], regions);
    } catch (e) {
      process.stdout.write(`  ${key}: ${(e as Error).message.slice(0, 90)}\n`);
      continue;
    }
    let withEdge = 0;
    for (const ev of evs) {
      const names = [ev.home_team, "Draw", ev.away_team];
      const quotes = quotesFor(ev, "h2h", names);
      if (quotes.length < 3) continue;
      const r = analyseDispersion({
        outcomes: names,
        quotes,
        options: { sharpBook: "Pinnacle", method: "shin" },
      });
      if (!r.reliable) continue;
      let any = false;
      for (const e of r.edges) {
        if (e.edge < minEdge) continue;
        any = true;
        rows.push({
          sport: key, eventId: ev.id, commence: ev.commence_time,
          home: ev.home_team, away: ev.away_team, outcome: e.outcome,
          bestBook: e.bestBook, priceRaw: e.bestPriceRaw, priceNet: e.bestPriceNet,
          fairPrice: e.fairPrice, edge: e.edge, nBooks: r.nBooks,
          consensus: r.consensusSource, executionGain: r.executionGain,
        });
      }
      if (any) withEdge += 1;
    }
    if (evs.length) perLeague.push({ league: key, events: evs.length, withEdge });
  }

  rows.sort((a, b) => b.edge - a.edge);
  process.stdout.write(`\nscansione ${runAt}   soglia edge ${(100 * minEdge).toFixed(1)}%   regioni ${regions}\n\n`);
  process.stdout.write(`${"partita".padEnd(40)} ${"esito".padEnd(22)} ${"book".padEnd(18)} ${"quota".padStart(7)} ${"equa".padStart(7)} ${"edge".padStart(7)} ${"n".padStart(3)}\n`);
  process.stdout.write("-".repeat(110) + "\n");
  for (const r of rows.slice(0, 20)) {
    const game = `${r.home} - ${r.away}`;
    process.stdout.write(
      `${game.slice(0, 40).padEnd(40)} ${r.outcome.slice(0, 22).padEnd(22)} ${r.bestBook.slice(0, 18).padEnd(18)} ${r.priceNet.toFixed(2).padStart(7)} ${r.fairPrice.toFixed(2).padStart(7)} ${(100 * r.edge).toFixed(2).padStart(6)}% ${String(r.nBooks).padStart(3)}\n`,
    );
  }
  if (rows.length > 20) process.stdout.write(`... e altre ${rows.length - 20} selezioni sopra soglia\n`);

  const totalEvents = perLeague.reduce((a, b) => a + b.events, 0);
  const gains = rows.map((r) => r.executionGain);
  process.stdout.write(`\neventi analizzati: ${totalEvents} in ${perLeague.length} campionati\n`);
  process.stdout.write(`selezioni sopra ${(100 * minEdge).toFixed(1)}%: ${rows.length}\n`);
  if (gains.length) {
    const avg = gains.reduce((a, b) => a + b, 0) / gains.length;
    process.stdout.write(`guadagno medio da esecuzione: ${(100 * avg).toFixed(2)} punti di margine\n`);
  }
  process.stdout.write(`\n${client.report()}\n`);

  mkdirSync(SNAP_DIR, { recursive: true });
  const snapPath = join(SNAP_DIR, `scan-${runAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(snapPath, JSON.stringify({ run_at: runAt, regions, min_edge: minEdge, per_league: perLeague, rows }, null, 2));
  // registro append-only: ogni riga e una selezione osservata, da liquidare poi
  appendFileSync(join(SNAP_DIR, "observations.jsonl"),
    rows.map((r) => JSON.stringify({ ...r, run_at: runAt, settled: false })).join("\n") + (rows.length ? "\n" : ""));
  process.stdout.write(`snapshot -> ${snapPath}\n`);
}

void main();
