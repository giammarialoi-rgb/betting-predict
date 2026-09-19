/**
 * RICOGNIZIONE The Odds API — cosa esiste davvero, a costo quasi nullo.
 *
 * Tre domande, in ordine di costo crescente:
 *   1. quali campionati di calcio sono attivi          (gratis)
 *   2. quanti eventi hanno nei prossimi giorni          (gratis)
 *   3. quali mercati corner e cartellini esistono       (si paga solo cio che esiste)
 *
 * Il punto 3 e la domanda che decide se i corner sono una strada: la
 * documentazione avverte che i mercati aggiuntivi sono "limitati a sport USA e
 * bookmaker selezionati", quindi va verificato sui dati, non creduto sulla
 * parola. Poiche il listino addebita solo i mercati EFFETTIVAMENTE restituiti,
 * un sondaggio a vuoto costa zero.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  CARD_MARKETS,
  CORNER_MARKETS,
  OddsApiClient,
  type OddsApiEvent,
} from "@/providers/the-odds-api/client";

const ROOT = process.cwd();
const OUT = join(ROOT, "audit", "odds-api-probe.json");

function apiKey(): string {
  const fromEnv = process.env.THE_ODDS_API_KEY;
  if (fromEnv) return fromEnv.trim();
  try {
    const text = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^THE_ODDS_API_KEY=(.*)$/.exec(line.trim());
      if (m && (m[1] ?? "").trim()) return (m[1] ?? "").trim();
    }
  } catch {
    /* ignora */
  }
  throw new Error(
    "THE_ODDS_API_KEY non trovata. Mettila in .env.local (il file e gia in .gitignore) oppure esportala nell'ambiente.",
  );
}

/** Campionati che il modello sa prezzare, per titolo dell'API. */
const WANTED = [
  "EPL", "Championship", "League 1", "League 2", "National League",
  "La Liga", "La Liga 2", "Segunda",
  "Serie A", "Serie B",
  "Bundesliga", "Bundesliga 2",
  "Ligue 1", "Ligue 2",
  "Eredivisie", "Primeira Liga", "Belgium", "Turkey", "Greece", "Scotland",
];

async function main(): Promise<void> {
  const client = new OddsApiClient(apiKey());
  const days = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7);
  const probePerLeague = Number(process.argv.find((a) => a.startsWith("--probe="))?.split("=")[1] ?? 1);

  // ---- 1. sport attivi (gratis) ----
  const sports = await client.listSports();
  const soccer = sports.filter((s) => s.group === "Soccer" && s.active && !s.has_outrights);
  const relevant = soccer.filter((s) => WANTED.some((w) => s.title.toLowerCase().includes(w.toLowerCase())));
  process.stdout.write(`campionati di calcio attivi: ${soccer.length}  (rilevanti per il modello: ${relevant.length})\n\n`);

  // ---- 2. eventi in finestra (gratis) ----
  const from = new Date().toISOString().slice(0, 19) + "Z";
  const to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19) + "Z";
  const perLeague: { key: string; title: string; events: OddsApiEvent[] }[] = [];
  for (const s of relevant) {
    try {
      const evs = await client.listEvents(s.key, { from, to });
      if (evs.length) perLeague.push({ key: s.key, title: s.title, events: evs });
    } catch (e) {
      process.stdout.write(`  ${s.key}: ${(e as Error).message.slice(0, 80)}\n`);
    }
  }
  perLeague.sort((a, b) => b.events.length - a.events.length);
  const totalEvents = perLeague.reduce((a, b) => a + b.events.length, 0);
  process.stdout.write(`${"lega".padEnd(34)} ${"chiave".padEnd(32)} ${"eventi".padStart(6)}\n`);
  process.stdout.write("-".repeat(76) + "\n");
  for (const l of perLeague) {
    process.stdout.write(`${l.title.slice(0, 34).padEnd(34)} ${l.key.padEnd(32)} ${String(l.events.length).padStart(6)}\n`);
  }
  process.stdout.write("-".repeat(76) + "\n");
  process.stdout.write(`totale eventi nei prossimi ${days} giorni: ${totalEvents}\n`);
  process.stdout.write(`costo finora: ${client.ledger.spent} crediti\n\n`);

  // ---- 3. sondaggio mercati aggiuntivi (si paga solo cio che esiste) ----
  process.stdout.write(`sondaggio mercati aggiuntivi su ${probePerLeague} evento/i per lega\n\n`);
  const probe: Record<string, unknown>[] = [];
  const marketsWanted = [...CORNER_MARKETS, ...CARD_MARKETS];
  for (const l of perLeague) {
    for (const ev of l.events.slice(0, probePerLeague)) {
      const before = client.ledger.spent;
      let found: string[] = [];
      let books: string[] = [];
      let error: string | null = null;
      try {
        const detail = await client.eventOdds(l.key, ev.id, marketsWanted);
        const set = new Set<string>();
        const bset = new Set<string>();
        for (const b of detail.bookmakers ?? []) {
          for (const m of b.markets) {
            set.add(m.key);
            bset.add(b.title);
          }
        }
        found = [...set].sort();
        books = [...bset].sort();
      } catch (e) {
        error = (e as Error).message.slice(0, 120);
      }
      const cost = client.ledger.spent - before;
      probe.push({
        league: l.title, sport_key: l.key, event: `${ev.home_team} - ${ev.away_team}`,
        commence: ev.commence_time, markets_found: found, bookmakers: books, credits: cost, error,
      });
      const label = found.length ? found.join(", ") : error ? `ERRORE: ${error}` : "nessuno";
      process.stdout.write(`  ${l.title.slice(0, 26).padEnd(26)} ${String(cost).padStart(3)} cr  ${label}\n`);
    }
  }

  // ---- riepilogo ----
  const withCorners = probe.filter((p) => (p.markets_found as string[]).some((m) => m.includes("corners")));
  const withCards = probe.filter((p) => (p.markets_found as string[]).some((m) => m.includes("cards")));
  process.stdout.write(`\nleghe sondate: ${probe.length}\n`);
  process.stdout.write(`  con mercati CORNER:     ${withCorners.length}\n`);
  process.stdout.write(`  con mercati CARTELLINI: ${withCards.length}\n\n`);
  process.stdout.write(client.report() + "\n");

  mkdirSync(join(ROOT, "audit"), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(), days,
    soccer_active: soccer.length,
    leagues: perLeague.map((l) => ({ key: l.key, title: l.title, events: l.events.length })),
    total_events: totalEvents,
    probe,
    credits: { spent: client.ledger.spent, calls: client.ledger.calls, remaining: client.ledger.remaining, used: client.ledger.used },
  }, null, 2));
  process.stdout.write(`\n-> ${OUT}\n`);
}

void main();
