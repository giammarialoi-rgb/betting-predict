/**
 * Compare-only book 1X2 for the UI path.
 *
 * Priority: quotes.jsonl (already bound to event_id) → cached free market
 * files (football-data.co.uk Bet365 columns, ESPN scoreboard when a complete
 * 1X2 is present). Identity is fail-closed. Same calendar day is required
 * when both sides have a date. Incomplete books stay missing.
 *
 * Never invents prices. Never writes MOCK. Never enters the independent model.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFdoukDate, parseFdoukRows } from "@/domain/eval/acquisition-engine/sources/football-data-co-uk";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import type { CompareBook1x2 } from "@/domain/eval/betmind-runtime/compare-odds";

export type MarketCandidate = {
  home: string;
  away: string;
  date: string | null;
  bookmaker: string;
  source: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  collected_at_utc: string;
};

export type CompareQuoteSlot = {
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  bookmaker: string | null;
  odds_market: "1X2" | null;
  odds_collected_at: string | null;
  odds_compare_only: true;
  odds_source: string | null;
  odds_status: "BOOK" | "MISSING";
};

export const EMPTY_QUOTE_SLOT: CompareQuoteSlot = {
  odds_home: null,
  odds_draw: null,
  odds_away: null,
  bookmaker: null,
  odds_market: null,
  odds_collected_at: null,
  odds_compare_only: true,
  odds_source: null,
  odds_status: "MISSING",
};

function dayKey(iso: string | null | undefined, timeZone = "Europe/Rome"): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

function completeBook(c: MarketCandidate): CompareBook1x2 {
  return {
    bookmaker: c.bookmaker,
    market: "1X2",
    line: null,
    odds_home: c.odds_home,
    odds_draw: c.odds_draw,
    odds_away: c.odds_away,
    collected_at_utc: c.collected_at_utc,
    odds_compare_only: true,
  };
}

export function quoteSlotFromBook(
  book: CompareBook1x2 | null,
  source: string | null = null,
): CompareQuoteSlot {
  if (!book) return EMPTY_QUOTE_SLOT;
  return {
    odds_home: book.odds_home,
    odds_draw: book.odds_draw,
    odds_away: book.odds_away,
    bookmaker: book.bookmaker,
    odds_market: "1X2",
    odds_collected_at: book.collected_at_utc || null,
    odds_compare_only: true,
    odds_source: source,
    odds_status: "BOOK",
  };
}

/** Load complete 1X2 rows from on-disk free caches. No network. No invented legs. */
export function loadCachedMarketCandidates(cwd = process.cwd()): MarketCandidate[] {
  const out: MarketCandidate[] = [];

  const fdDir = join(cwd, "data", "acquisition", "football-data-co-uk");
  if (existsSync(fdDir)) {
    for (const file of readdirSync(fdDir)) {
      if (!file.toLowerCase().endsWith(".csv")) continue;
      let text = "";
      try {
        text = readFileSync(join(fdDir, file), "utf8");
      } catch {
        continue;
      }
      const hint = file.replace(/\.csv$/i, "");
      for (const row of parseFdoukRows(text, hint)) {
        if (row.b365h == null || row.b365d == null || row.b365a == null) continue;
        out.push({
          home: row.home,
          away: row.away,
          date: parseFdoukDate(row.date),
          bookmaker: "bet365",
          source: "football-data-co-uk",
          odds_home: row.b365h,
          odds_draw: row.b365d,
          odds_away: row.b365a,
          collected_at_utc: parseFdoukDate(row.date) ? `${parseFdoukDate(row.date)}T00:00:00.000Z` : "",
        });
      }
    }
  }

  const espnDir = join(cwd, "data", "acquisition", "espn");
  if (existsSync(espnDir)) {
    for (const file of readdirSync(espnDir)) {
      if (!file.toLowerCase().endsWith(".json")) continue;
      let text = "";
      try {
        text = readFileSync(join(espnDir, file), "utf8");
      } catch {
        continue;
      }
      const hint = file.replace(/\.json$/i, "");
      for (const ev of parseEspnScoreboard(text, hint)) {
        if (ev.oddsHome == null || ev.oddsDraw == null || ev.oddsAway == null) continue;
        if (!ev.home || !ev.away) continue;
        out.push({
          home: ev.home,
          away: ev.away,
          date: dayKey(ev.date ?? null),
          bookmaker: ev.bookmaker || "espn-scoreboard",
          source: "espn",
          odds_home: ev.oddsHome,
          odds_draw: ev.oddsDraw,
          odds_away: ev.oddsAway,
          collected_at_utc: ev.date ?? "",
        });
      }
    }
  }

  return out;
}

/**
 * Unique fail-closed match. If the event has a calendar day, only that day
 * may attach — another round of the same pair is not this fixture.
 */
export function attachCachedCompareBook(input: {
  home?: string | null;
  away?: string | null;
  kickoff_utc?: string | null;
  calendar_day?: string | null;
  candidates: readonly MarketCandidate[];
}): { book: CompareBook1x2; source: string } | null {
  const home = String(input.home ?? "").trim();
  const away = String(input.away ?? "").trim();
  if (!home || !away || !input.candidates.length) return null;

  const named = input.candidates.filter((c) => matchEventPair(home, away, c.home, c.away).matched);
  if (!named.length) return null;

  const day =
    (typeof input.calendar_day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.calendar_day)
      ? input.calendar_day
      : null) ?? dayKey(input.kickoff_utc ?? null);

  const pool = day ? named.filter((c) => c.date === day) : named;
  if (pool.length !== 1) return null;
  const hit = pool[0]!;
  return { book: completeBook(hit), source: hit.source };
}

export function resolveCompareBook(input: {
  quotesBook?: CompareBook1x2 | null;
  home?: string | null;
  away?: string | null;
  kickoff_utc?: string | null;
  calendar_day?: string | null;
  candidates?: readonly MarketCandidate[];
}): { book: CompareBook1x2; source: string } | null {
  if (input.quotesBook) {
    return { book: input.quotesBook, source: "quotes.jsonl" };
  }
  return attachCachedCompareBook({
    home: input.home,
    away: input.away,
    kickoff_utc: input.kickoff_utc,
    calendar_day: input.calendar_day,
    candidates: input.candidates ?? [],
  });
}

export function summarizeMarketAttach(input: {
  events: Array<{
    event_id: string;
    home?: string | null;
    away?: string | null;
    kickoff_utc?: string | null;
    odds_home?: number | null;
    odds_draw?: number | null;
    odds_away?: number | null;
  }>;
}): {
  events: number;
  with_real_book: number;
  missing_honest: number;
  mock_sold_as_real: 0;
} {
  let with_real_book = 0;
  let missing_honest = 0;
  for (const e of input.events) {
    const complete =
      typeof e.odds_home === "number" &&
      e.odds_home > 1 &&
      typeof e.odds_draw === "number" &&
      e.odds_draw > 1 &&
      typeof e.odds_away === "number" &&
      e.odds_away > 1;
    if (complete) with_real_book += 1;
    else missing_honest += 1;
  }
  return {
    events: input.events.length,
    with_real_book,
    missing_honest,
    mock_sold_as_real: 0,
  };
}
