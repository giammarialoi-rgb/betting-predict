/**
 * POOL — dalle probabilità del modello alle selezioni giocabili.
 *
 * Il costruttore di biglietti ha bisogno di tre cose per ogni selezione: che
 * probabilità le dà il modello, a che prezzo la paga il book, e quando si
 * gioca. Il tabellone porta la prima, The Odds API la seconda. Questo script
 * le unisce e scrive il pool.
 *
 * Il punto delicato è l'abbinamento: i nomi delle squadre sono diversi in tre
 * sistemi (lo storico, The Odds API, il bookmaker). Un abbinamento sbagliato
 * non produce un errore, produce una scommessa sulla squadra sbagliata — che è
 * il guasto peggiore possibile. Quindi qui un evento entra nel pool solo se
 * entrambe le squadre corrispondono; gli scarti vengono contati e mostrati,
 * non nascosti.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { OddsApiClient, type OddsApiEvent } from "@/providers/the-odds-api/client";
import { matchTeam, normalizeTeamName } from "@/domain/eval/predictive-intelligence/models/team-matching";
import { devig } from "@/domain/odds/devig";
import type { RatedSelection } from "@/domain/booking/ticket-builder";

const ROOT = process.cwd();
const BOARD = join(ROOT, "audit", "board-7days.json");
const OUT = join(ROOT, "audit", "selection-pool.json");

/** Competizioni del tabellone -> chiavi lega di The Odds API. */
const COMPETITION_TO_SPORT: Record<string, string> = {
  PL: "soccer_epl",
  ELC: "soccer_efl_champ",
  PD: "soccer_spain_la_liga",
  SA: "soccer_italy_serie_a",
  BL1: "soccer_germany_bundesliga",
  FL1: "soccer_france_ligue_one",
  DED: "soccer_netherlands_eredivisie",
  PPL: "soccer_portugal_primeira_liga",
};

type BoardRow = {
  kickoff: string;
  competition: string;
  home: string;
  away: string;
  information_share?: number;
  model: {
    home: number;
    draw: number;
    away: number;
    over_2_5: number;
  } | null;
};

function apiKey(): string {
  const text = readFileSync(join(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^THE_ODDS_API_KEY=(.*)$/.exec(line.trim());
    if (m) return (m[1] ?? "").trim();
  }
  throw new Error("THE_ODDS_API_KEY mancante in .env.local");
}

/**
 * Abbina l'evento del tabellone a quello quotato.
 *
 * Si usa matchTeam, che il repo ha gia' e che gestisce alias e somiglianza:
 * "Man City" e "Manchester City" sono la stessa squadra e un confronto
 * letterale non lo vede. Servono ENTRAMBE le squadre abbinate con certezza —
 * un abbinamento sbagliato non dà errore, dà una scommessa sulla squadra
 * sbagliata.
 */
function findEvent(row: BoardRow, eventi: readonly OddsApiEvent[]): OddsApiEvent | null {
  const case_ = eventi.map((e) => e.home_team);
  const casa = matchTeam(row.home, case_);
  if (casa.status !== "MATCHED") return null;
  const candidati = eventi.filter((e) => e.home_team === casa.candidate);
  for (const ev of candidati) {
    if (matchTeam(row.away, [ev.away_team]).status === "MATCHED") return ev;
  }
  return null;
}

function priceOf(ev: OddsApiEvent, marketKey: string, outcome: string, point?: number): number | null {
  let best: number | null = null;
  for (const b of ev.bookmakers ?? []) {
    const m = b.markets.find((x) => x.key === marketKey);
    if (!m) continue;
    for (const o of m.outcomes) {
      if (point !== undefined && o.point !== point) continue;
      if (normalizeTeamName(o.name).normalized !== normalizeTeamName(outcome).normalized) continue;
      if (best === null || o.price > best) best = o.price;
    }
  }
  return best;
}

async function main(): Promise<void> {
  const board = JSON.parse(readFileSync(BOARD, "utf8")) as {
    generated_at: string;
    board: BoardRow[];
  };
  const righe = board.board.filter((r) => r.model !== null);
  const competizioni = [...new Set(righe.map((r) => r.competition))].filter(
    (c) => COMPETITION_TO_SPORT[c] !== undefined,
  );

  process.stdout.write(
    `tabellone del ${board.generated_at}: ${righe.length} partite con modello, ` +
      `${competizioni.length} competizioni con prezzi disponibili\n\n`,
  );

  const client = new OddsApiClient(apiKey());
  const quotate = new Map<string, OddsApiEvent[]>();
  for (const c of competizioni) {
    const key = COMPETITION_TO_SPORT[c] as string;
    try {
      // h2h e totals in una sola chiamata: il costo è per mercato, non per evento.
      quotate.set(c, await client.leagueOdds(key, ["h2h", "totals"], "eu"));
    } catch (e) {
      process.stdout.write(`  ${c}: prezzi non disponibili (${(e as Error).message.slice(0, 80)})\n`);
    }
  }

  const pool: RatedSelection[] = [];
  const scartate: string[] = [];

  for (const r of righe) {
    const eventi = quotate.get(r.competition);
    const m = r.model;
    if (!eventi || !m) continue;

    const ev = findEvent(r, eventi);
    if (!ev) {
      scartate.push(`${r.home} - ${r.away} (${r.competition}): nessun prezzo abbinato`);
      continue;
    }

    // Il nome dell'evento è quello del BOOK, non del nostro storico: è la
    // stringa con cui il driver andrà a cercarlo.
    const nome = `${ev.home_team} - ${ev.away_team}`;

    // La probabilità che conta è quella EQUA DEL MERCATO: il prezzo ripulito
    // dal margine. Il modello resta accanto, per confronto, ma non sceglie —
    // misurato che il suo disaccordo punta dalla parte sbagliata.
    const q1 = priceOf(ev, "h2h", ev.home_team);
    const qx = priceOf(ev, "h2h", "Draw");
    const q2 = priceOf(ev, "h2h", ev.away_team);
    const qo = priceOf(ev, "totals", "Over", 2.5);
    const qu = priceOf(ev, "totals", "Under", 2.5);

    const candidati: Array<[string, number | null, number | null, number]> = [];
    if (q1 !== null && qx !== null && q2 !== null) {
      const eque = devig([q1, qx, q2], "shin").probabilities;
      candidati.push(
        ["1", q1, eque[0] ?? null, m.home],
        ["X", qx, eque[1] ?? null, m.draw],
        ["2", q2, eque[2] ?? null, m.away],
      );
    }
    if (qo !== null && qu !== null) {
      const eque = devig([qo, qu], "shin").probabilities;
      candidati.push(
        ["O2.5", qo, eque[0] ?? null, m.over_2_5],
        ["U2.5", qu, eque[1] ?? null, 1 - m.over_2_5],
      );
    }

    for (const [selection, odds, fair, modello] of candidati) {
      if (odds === null || fair === null || !(fair > 0) || fair >= 1) continue;
      pool.push({
        event: nome,
        selection,
        odds,
        probability: fair,
        modelProbability: modello,
        kickoff: ev.commence_time,
        informationShare: r.information_share ?? null,
      });
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        from_board: board.generated_at,
        selections: pool.length,
        events: new Set(pool.map((p) => p.event)).size,
        discarded: scartate.length,
        pool,
      },
      null,
      2,
    ),
  );

  process.stdout.write(
    `\n${pool.length} selezioni su ${new Set(pool.map((p) => p.event)).size} eventi\n`,
  );
  if (scartate.length > 0) {
    process.stdout.write(`${scartate.length} partite scartate:\n`);
    for (const s of scartate.slice(0, 12)) process.stdout.write(`  ${s}\n`);
    if (scartate.length > 12) process.stdout.write(`  ... e altre ${scartate.length - 12}\n`);
  }
  process.stdout.write(`\n${client.report()}\n-> ${OUT}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exitCode = 1;
});
