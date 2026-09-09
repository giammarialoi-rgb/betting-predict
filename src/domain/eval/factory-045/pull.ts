import { createHash } from "node:crypto";
import { hasUtcOffset } from "@/domain/eval/prospective-036/clocks";
import { fetchOddsApi042 } from "@/domain/eval/collector-042/api";
import { getOddsApiKey } from "@/domain/eval/prospective-036/sources";
import { applyCreditObservation042 } from "@/domain/eval/collector-042/credit";
import type { CreditState042 } from "@/domain/eval/collector-042/types";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";

export type SportRow045 = {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
};

export type ParsedEvent045 = {
  source_event_id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  kickoff_at_utc: string;
};

export type ParsedQuote045 = {
  source_event_id: string;
  market_raw: string;
  market: string;
  selection: string;
  line: number | null;
  odds_decimal: number;
  bookmaker: string;
  available_at: string | null;
  source_record_id: string;
};

function mapMarket045(key: string): string {
  if (key === "h2h") return "1X2";
  if (key === "h2h_lay") return "H2H_LAY";
  if (key === "totals") return "OU";
  if (key === "spreads") return "AH";
  if (key === "btts") return "BTTS";
  if (key === "draw_no_bet") return "DNB";
  if (key === "double_chance") return "DC";
  return key ? key.toUpperCase() : "OTHER";
}

function mapSel045(name: string, home: string, away: string): string {
  if (name === home) return "HOME";
  if (name === away) return "AWAY";
  const n = name.toLowerCase();
  if (n === "draw" || n === "tie") return "DRAW";
  if (n === "over") return "OVER";
  if (n === "under") return "UNDER";
  return name;
}

/** Parse Odds API /odds payload — keep all real markets; never invent. */
export function parseOddsPayload045(payload: unknown): { events: ParsedEvent045[]; quotes: ParsedQuote045[] } {
  if (!Array.isArray(payload)) return { events: [], quotes: [] };
  const events: ParsedEvent045[] = [];
  const quotes: ParsedQuote045[] = [];
  for (const ev of payload) {
    if (!ev || typeof ev !== "object") continue;
    const rec = ev as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : null;
    const home = typeof rec.home_team === "string" ? rec.home_team : null;
    const away = typeof rec.away_team === "string" ? rec.away_team : null;
    const kick = typeof rec.commence_time === "string" ? rec.commence_time : null;
    const sport = typeof rec.sport_key === "string" ? rec.sport_key : "unknown";
    if (!id || !home || !away || !kick || !hasUtcOffset(kick)) continue;
    events.push({
      source_event_id: id,
      sport_key: sport,
      home_team: home,
      away_team: away,
      kickoff_at_utc: kick,
    });
    const books = Array.isArray(rec.bookmakers) ? rec.bookmakers : [];
    for (const book of books) {
      if (!book || typeof book !== "object") continue;
      const b = book as Record<string, unknown>;
      const bookKey = typeof b.key === "string" ? b.key : "unknown";
      const bookTs = typeof b.last_update === "string" && hasUtcOffset(b.last_update) ? b.last_update : null;
      const markets = Array.isArray(b.markets) ? b.markets : [];
      for (const m of markets) {
        if (!m || typeof m !== "object") continue;
        const mk = m as Record<string, unknown>;
        const rawKey = typeof mk.key === "string" ? mk.key : "";
        if (!rawKey) continue;
        const market = mapMarket045(rawKey);
        const mTs = typeof mk.last_update === "string" && hasUtcOffset(mk.last_update) ? mk.last_update : bookTs;
        const outcomes = Array.isArray(mk.outcomes) ? mk.outcomes : [];
        for (const o of outcomes) {
          if (!o || typeof o !== "object") continue;
          const oc = o as Record<string, unknown>;
          const name = typeof oc.name === "string" ? oc.name : "";
          const price = typeof oc.price === "number" ? oc.price : Number(oc.price);
          if (!Number.isFinite(price) || price <= 1) continue;
          const point = typeof oc.point === "number" ? oc.point : null;
          const sel = mapSel045(name, home, away);
          quotes.push({
            source_event_id: id,
            market_raw: rawKey,
            market,
            selection: sel,
            line: point,
            odds_decimal: price,
            bookmaker: bookKey,
            available_at: mTs,
            source_record_id: `${id}|${bookKey}|${rawKey}|${sel}|${point ?? ""}`,
          });
        }
      }
    }
  }
  return { events, quotes };
}

export async function fetchSportsCatalog045(input: {
  fetchImpl?: typeof fetch;
  creditState: CreditState042;
}): Promise<{
  sports: SportRow045[];
  creditState: CreditState042;
  error: string | null;
  raw_hash: string;
}> {
  const key = getOddsApiKey();
  if (!key) {
    return { sports: [], creditState: input.creditState, error: "THE_ODDS_API_KEY is not set", raw_hash: "" };
  }
  const cfg = loadGovernorConfig042();
  const url = `https://api.the-odds-api.com/v4/sports?apiKey=${encodeURIComponent(key)}`;
  try {
    const res = await fetchOddsApi042({ url, fetchImpl: input.fetchImpl });
    const creditState = applyCreditObservation042(input.creditState, res.headers, 1, cfg);
    const sports: SportRow045[] = [];
    if (Array.isArray(res.json)) {
      for (const row of res.json) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        if (typeof r.key !== "string") continue;
        sports.push({
          key: r.key,
          group: typeof r.group === "string" ? r.group : "",
          title: typeof r.title === "string" ? r.title : r.key,
          active: Boolean(r.active),
          has_outrights: Boolean(r.has_outrights),
        });
      }
    }
    return {
      sports,
      creditState,
      error: null,
      raw_hash: createHash("sha256").update(JSON.stringify(res.json)).digest("hex"),
    };
  } catch (e) {
    return {
      sports: [],
      creditState: input.creditState,
      error: e instanceof Error ? e.message : "sports catalog failed",
      raw_hash: "",
    };
  }
}

export async function pullSportOddsMulti045(input: {
  sport: string;
  markets: string;
  regions?: string;
  fetchImpl?: typeof fetch;
  creditState: CreditState042;
}): Promise<{
  events: ParsedEvent045[];
  quotes: ParsedQuote045[];
  creditState: CreditState042;
  error: string | null;
  httpStatus: number | null;
  raw_hash: string;
  market_status: "OK" | "SPORT_UNAVAILABLE" | "EMPTY" | "ERROR";
}> {
  const key = getOddsApiKey();
  if (!key) {
    return {
      events: [],
      quotes: [],
      creditState: input.creditState,
      error: "THE_ODDS_API_KEY is not set",
      httpStatus: null,
      raw_hash: "",
      market_status: "ERROR",
    };
  }
  const cfg = loadGovernorConfig042();
  const regions = input.regions ?? cfg.regions;
  const url = `https://api.the-odds-api.com/v4/sports/${input.sport}/odds?regions=${encodeURIComponent(regions)}&markets=${encodeURIComponent(input.markets)}&oddsFormat=decimal&dateFormat=iso&apiKey=${encodeURIComponent(key)}`;
  try {
    const res = await fetchOddsApi042({ url, fetchImpl: input.fetchImpl });
    const creditState = applyCreditObservation042(
      input.creditState,
      res.headers,
      cfg.estimatedOddsCreditsPerSport,
      cfg,
    );
    if (res.status === 404) {
      return {
        events: [],
        quotes: [],
        creditState,
        error: `SPORT_UNAVAILABLE:${input.sport}`,
        httpStatus: 404,
        raw_hash: "",
        market_status: "SPORT_UNAVAILABLE",
      };
    }
    const parsed = parseOddsPayload045(res.json);
    return {
      events: parsed.events,
      quotes: parsed.quotes,
      creditState,
      error: null,
      httpStatus: res.status,
      raw_hash: createHash("sha256").update(JSON.stringify(res.json)).digest("hex"),
      market_status: parsed.events.length ? "OK" : "EMPTY",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "odds pull failed";
    const code = /HTTP (\d{3})/.exec(msg)?.[1];
    const status = code ? Number(code) : null;
    return {
      events: [],
      quotes: [],
      creditState: input.creditState,
      error: msg,
      httpStatus: status,
      raw_hash: "",
      market_status: status === 404 ? "SPORT_UNAVAILABLE" : "ERROR",
    };
  }
}

/** Select sports to pull: all active soccer_* + active tennis_*; never invent keys. */
export function selectSportsForPull045(catalog: SportRow045[]): {
  soccer: string[];
  tennis: string[];
  other: string[];
  unavailable_note: string[];
} {
  const active = catalog.filter((s) => s.active);
  const soccer = active.filter((s) => s.key.startsWith("soccer_")).map((s) => s.key);
  const tennis = active.filter((s) => s.key.startsWith("tennis_")).map((s) => s.key);
  const other = active
    .filter((s) => !s.key.startsWith("soccer_") && !s.key.startsWith("tennis_") && !s.has_outrights)
    .map((s) => s.key)
    .slice(0, 0); // architecture ready; do not pull other sports yet (budget)
  const unavailable_note: string[] = [];
  if (!tennis.length) unavailable_note.push("TENNIS_NO_ACTIVE_KEYS_IN_PROVIDER");
  if (!soccer.length) unavailable_note.push("SOCCER_NO_ACTIVE_KEYS_IN_PROVIDER");
  return { soccer, tennis, other, unavailable_note };
}
