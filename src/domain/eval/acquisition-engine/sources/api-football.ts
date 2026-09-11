/**
 * API-Football / API-Sports free tier — key required.
 * Budget-capped (100/day). AUTH_REQUIRED without token. Never invents fixtures.
 */
import { getApiSportsKey057 } from "@/domain/data-sources/api-sports/config";
import { apiSportsGet057 } from "@/domain/data-sources/api-sports/client";
import { canSpend057 } from "@/domain/data-sources/api-sports/budget";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { persistCompareOnlyQuotes, registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

export type ApiFootballFixture = {
  id?: number;
  home?: string | null;
  away?: string | null;
  kickoff?: string | null;
  league?: string | null;
};

export type ApiFootballOddsBook = {
  fixtureId?: number;
  home?: string | null;
  away?: string | null;
  bookmaker: string;
  homePrice: number;
  drawPrice: number;
  awayPrice: number;
};

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function parseApiFootballFixtures(payload: unknown): ApiFootballFixture[] {
  const root = asRec(payload);
  const response = root && Array.isArray(root.response) ? root.response : Array.isArray(payload) ? payload : [];
  const out: ApiFootballFixture[] = [];
  for (const raw of response) {
    const row = asRec(raw);
    if (!row) continue;
    const fixture = asRec(row.fixture);
    const teams = asRec(row.teams);
    const home = asRec(teams?.home);
    const away = asRec(teams?.away);
    const league = asRec(row.league);
    out.push({
      id: typeof fixture?.id === "number" ? fixture.id : undefined,
      home: typeof home?.name === "string" ? home.name : null,
      away: typeof away?.name === "string" ? away.name : null,
      kickoff: typeof fixture?.date === "string" ? fixture.date : null,
      league: typeof league?.name === "string" ? league.name : null,
    });
  }
  return out;
}

function decimalOdds(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

function isMatchWinnerBet(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "match winner" || n === "win-draw-win" || n === "1x2" || n === "fulltime result" || n === "home/away";
}

/** Complete 1X2 only. Missing legs stay out. MARKET/UI — never MODEL. */
export function parseApiFootballOdds(payload: unknown): ApiFootballOddsBook[] {
  const root = asRec(payload);
  const response = root && Array.isArray(root.response) ? root.response : Array.isArray(payload) ? payload : [];
  const out: ApiFootballOddsBook[] = [];
  for (const raw of response) {
    const row = asRec(raw);
    if (!row) continue;
    const fixture = asRec(row.fixture);
    const teams = asRec(row.teams);
    const homeName = typeof asRec(teams?.home)?.name === "string" ? String(asRec(teams?.home)!.name) : null;
    const awayName = typeof asRec(teams?.away)?.name === "string" ? String(asRec(teams?.away)!.name) : null;
    const books = Array.isArray(row.bookmakers) ? row.bookmakers : [];
    for (const b of books) {
      const book = asRec(b);
      if (!book) continue;
      const bets = Array.isArray(book.bets) ? book.bets : [];
      const winner = bets.map(asRec).find((bet) => bet && isMatchWinnerBet(String(bet.name ?? "")));
      const values = Array.isArray(winner?.values) ? winner!.values : [];
      let homePrice: number | null = null;
      let drawPrice: number | null = null;
      let awayPrice: number | null = null;
      for (const v of values) {
        const cell = asRec(v);
        const label = String(cell?.value ?? "").trim().toLowerCase();
        const price = decimalOdds(cell?.odd ?? cell?.odds ?? cell?.price);
        if (price == null) continue;
        if (label === "home" || label === "1") homePrice = price;
        else if (label === "draw" || label === "x") drawPrice = price;
        else if (label === "away" || label === "2") awayPrice = price;
      }
      if (homePrice == null || drawPrice == null || awayPrice == null) continue;
      out.push({
        fixtureId: typeof fixture?.id === "number" ? fixture.id : undefined,
        home: homeName,
        away: awayName,
        bookmaker: typeof book.name === "string" && book.name.trim() ? book.name : "api-football",
        homePrice,
        drawPrice,
        awayPrice,
      });
      break;
    }
  }
  return out;
}

export async function runApiFootballLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  persistLabB?: boolean;
  labBRoot?: string;
  jsonText?: string;
  oddsJson?: string;
  fetchImpl?: typeof fetch;
  labEvents?: AcquisitionCycleInput["labEvents"];
  token?: string | null;
}): Promise<SourceLaneResult> {
  const token = input.token !== undefined ? input.token : getApiSportsKey057();
  if (!token) {
    return emptyLane({
      source_id: "api-football",
      url: input.url,
      status: "AUTH_REQUIRED",
      reason: "API_SPORTS_KEY / API_FOOTBALL_KEY is not set",
      reason_it:
        "API-Football richiede una chiave gratuita gia presente in env (API_SPORTS_KEY o API_FOOTBALL_KEY). Nessun accesso non autorizzato. Nessuna risposta inventata.",
    });
  }

  let fixtures: ApiFootballFixture[] = [];
  let http: number | null = 200;
  let fromCache = false;
  let error: string | null = null;

  if (input.jsonText != null) {
    try {
      fixtures = parseApiFootballFixtures(JSON.parse(input.jsonText));
    } catch {
      return emptyLane({
        source_id: "api-football",
        url: input.url,
        status: "PARSE_ERROR",
        reason: "INVALID_JSON",
        reason_it: "La risposta di API-Football non e interpretabile.",
      });
    }
  } else {
    const spend = canSpend057(1);
    if (!spend.ok) {
      return emptyLane({
        source_id: "api-football",
        url: input.url,
        status: "RATE_LIMITED",
        reason: "DAILY_BUDGET_EXHAUSTED",
        reason_it:
          "API-Football: budget giornaliero free (100 req) esaurito. Riprovo al ciclo successivo. Nessun hammering.",
      });
    }
    const got = await apiSportsGet057("/fixtures?next=15", { useCacheMs: 3 * 3600_000, charge: true });
    http = got.http_status;
    fromCache = got.from_cache;
    error = got.error;
    if (!got.ok) {
      return emptyLane({
        source_id: "api-football",
        url: input.url,
        status: got.http_status === 429 ? "RATE_LIMITED" : got.http_status === 401 ? "AUTH_REQUIRED" : "NETWORK_ERROR",
        http_status: got.http_status,
        reason: got.error ?? `HTTP_${got.http_status}`,
        reason_it: `API-Football non disponibile (${got.error ?? got.http_status}). Nessun dato inventato.`,
      });
    }
    fixtures = parseApiFootballFixtures(got.body);
  }

  let oddsBooks: ApiFootballOddsBook[] = [];
  if (input.oddsJson != null) {
    try {
      oddsBooks = parseApiFootballOdds(JSON.parse(input.oddsJson));
    } catch {
      oddsBooks = [];
    }
  } else if (input.jsonText == null && token) {
    const spend = canSpend057(1);
    if (spend.ok) {
      const day = input.nowIso.slice(0, 10);
      const gotOdds = await apiSportsGet057(`/odds?date=${day}`, { useCacheMs: 6 * 3600_000, charge: true });
      if (gotOdds.ok) oddsBooks = parseApiFootballOdds(gotOdds.body);
    }
  }

  const records: AcquisitionRecord[] = [
    {
      source_id: "api-football",
      kind: "fixtures",
      feature_key: "api_football_fixtures",
      value: fixtures.length,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: fromCache ? "api_football_fixtures_cache" : "api_football_fixtures_next15",
      source_url: input.url,
      identity_status: "UNBOUND",
      reason_it: `${fixtures.length} prossime partite API-Football (budget rispettato${fromCache ? ", da cache" : ""}).`,
    },
  ];
  if (oddsBooks.length) {
    records.push({
      source_id: "api-football",
      kind: "market",
      feature_key: "api_football_odds_1x2_complete",
      value: oddsBooks.length,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "api_football_odds_match_winner_market_only",
      source_url: input.url,
      identity_status: "UNBOUND",
      reason_it: `${oddsBooks.length} quote 1X2 complete da API-Football. Layer mercato/UI, mai modello indipendente.`,
    });
  }

  let quotesStored = 0;
  for (const ev of input.labEvents ?? []) {
    const hits = fixtures.filter((f) => f.home && f.away && matchEventPair(ev.home, ev.away, f.home, f.away).matched);
    if (hits.length !== 1) continue;
    const f = hits[0]!;
    records.push({
      source_id: "api-football",
      kind: "fixtures",
      feature_key: "api_football_fixture",
      value: f.id ?? null,
      event_id: ev.event_id,
      home: f.home ?? ev.home,
      away: f.away ?? ev.away,
      kickoff_iso: f.kickoff ?? ev.kickoff_utc ?? null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "api_football_fixtures_next15",
      source_url: input.url,
      identity_status: "EXACT",
      reason_it: oddsBooks.length
        ? "Fixture API-Football. Solo contesto. Quote gestite come layer mercato/UI."
        : "Fixture API-Football. Solo contesto. Quote assenti in questo ciclo (budget o AUTH).",
    });
    const book =
      (f.id != null ? oddsBooks.find((o) => o.fixtureId === f.id) : undefined) ??
      oddsBooks.find((o) => o.home && o.away && matchEventPair(ev.home, ev.away, o.home, o.away).matched);
    if (!book) continue;
    records.push({
      source_id: "api-football",
      kind: "market",
      feature_key: "api_football_event_1x2",
      value: book.homePrice,
      event_id: ev.event_id,
      home: f.home ?? ev.home,
      away: f.away ?? ev.away,
      kickoff_iso: f.kickoff ?? ev.kickoff_utc ?? null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "api_football_odds_match_winner_market_only",
      source_url: input.url,
      identity_status: "EXACT",
      reason_it: "Quota 1X2 API-Football. Solo confronto UI, non entra nel modello indipendente.",
    });
    if (input.persistLabB && input.labBRoot) {
      const persisted = persistCompareOnlyQuotes({
        labBRoot: input.labBRoot,
        eventId: ev.event_id,
        bookmaker: book.bookmaker,
        source: "api-football",
        home: book.homePrice,
        draw: book.drawPrice,
        away: book.awayPrice,
        collectedAt: input.nowIso,
      });
      quotesStored += persisted.stored;
    }
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "api-football",
      name: "API-Football",
      licenseClass: "official_api",
    });
  }

  return {
    source_id: "api-football",
    ok: fixtures.length > 0,
    fetched: true,
    status: fixtures.length > 0 ? "OK" : "NO_DATA",
    http_status: http,
    url: input.url,
    records,
    fields_extracted: fixtures.length > 0 ? [...new Set(records.map((r) => r.feature_key))] : [],
    reason: `fixtures=${fixtures.length}; market_1x2=${oddsBooks.length}${fromCache ? "; cache" : ""}${error ? `; ${error}` : ""}`,
    reason_it: `API-Football: ${fixtures.length} partite, ${oddsBooks.length} quote 1X2. Budget rispettato. Nessuna quota inventata.`,
    retries: 0,
    cache_path: null,
    neon,
    coverage: {
      leagues: [...new Set(fixtures.map((f) => f.league).filter(Boolean) as string[])],
      sports: ["football"],
      market_quotes: quotesStored || oddsBooks.length,
    },
  };
}
