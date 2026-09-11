/**
 * The Odds API — MARKET/UI layer only. Never independent MODEL.
 * AUTH_REQUIRED without THE_ODDS_API_KEY. Never invents prices.
 */
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { persistCompareOnlyQuotes, registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

function getOddsApiKey(): string | undefined {
  const key = process.env.THE_ODDS_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

export type OddsApiEvent = {
  id?: string;
  home?: string | null;
  away?: string | null;
  commence?: string | null;
  bookmaker?: string | null;
  homePrice?: number | null;
  drawPrice?: number | null;
  awayPrice?: number | null;
};

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function decimalOdds(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

export function parseOddsApiEvents(payload: unknown): OddsApiEvent[] {
  const list = Array.isArray(payload) ? payload : [];
  const out: OddsApiEvent[] = [];
  for (const raw of list) {
    const ev = asRec(raw);
    if (!ev) continue;
    const books = Array.isArray(ev.bookmakers) ? ev.bookmakers : [];
    let bookmaker: string | null = null;
    let homePrice: number | null = null;
    let drawPrice: number | null = null;
    let awayPrice: number | null = null;
    const homeName = typeof ev.home_team === "string" ? ev.home_team : null;
    const awayName = typeof ev.away_team === "string" ? ev.away_team : null;
    for (const b of books) {
      const book = asRec(b);
      const markets = Array.isArray(book?.markets) ? book!.markets : [];
      const h2h = markets.map(asRec).find((m) => m && (m.key === "h2h" || m.key === "h2h_3_way"));
      const outcomes = Array.isArray(h2h?.outcomes) ? h2h!.outcomes : [];
      let h: number | null = null;
      let d: number | null = null;
      let a: number | null = null;
      for (const o of outcomes) {
        const row = asRec(o);
        const name = String(row?.name ?? "");
        const price = decimalOdds(row?.price);
        if (!price) continue;
        if (homeName && name === homeName) h = price;
        else if (awayName && name === awayName) a = price;
        else if (/^draw$/i.test(name)) d = price;
      }
      if (h && d && a) {
        bookmaker = typeof book?.title === "string" ? book.title : typeof book?.key === "string" ? book.key : "odds-api";
        homePrice = h;
        drawPrice = d;
        awayPrice = a;
        break;
      }
    }
    out.push({
      id: typeof ev.id === "string" ? ev.id : undefined,
      home: homeName,
      away: awayName,
      commence: typeof ev.commence_time === "string" ? ev.commence_time : null,
      bookmaker,
      homePrice,
      drawPrice,
      awayPrice,
    });
  }
  return out;
}

export async function runOddsApiLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  persistLabB?: boolean;
  labBRoot?: string;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  labEvents?: AcquisitionCycleInput["labEvents"];
  token?: string | null;
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  const token = input.token !== undefined ? input.token : getOddsApiKey();
  if (!token) {
    return emptyLane({
      source_id: "the-odds-api",
      url: input.url,
      status: "AUTH_REQUIRED",
      reason: "THE_ODDS_API_KEY is not set",
      reason_it:
        "The Odds API richiede THE_ODDS_API_KEY. Senza chiave le quote restano assenti (NO fake). Layer mercato/UI only, mai modello indipendente.",
    });
  }

  let events: OddsApiEvent[] = [];
  let http = 200;
  let retries = 0;
  let url = input.url;

  if (input.jsonText != null) {
    try {
      events = parseOddsApiEvents(JSON.parse(input.jsonText));
    } catch {
      return emptyLane({
        source_id: "the-odds-api",
        url,
        status: "PARSE_ERROR",
        reason: "INVALID_JSON",
        reason_it: "La risposta di The Odds API non e interpretabile. Nessuna quota inventata.",
      });
    }
  } else {
    const liveUrl = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso&apiKey=${encodeURIComponent(token)}`;
    const got = await acquisitionGet({
      url: liveUrl,
      sourceId: "the-odds-api",
      minIntervalMs: input.fetchImpl ? 0 : 8_000,
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    http = got.status;
    retries = got.retries;
    url = input.url;
    if (!got.ok) {
      return emptyLane({
        source_id: "the-odds-api",
        url: input.url,
        status: got.status === 401 ? "AUTH_REQUIRED" : got.status === 429 ? "RATE_LIMITED" : "NETWORK_ERROR",
        http_status: got.status || null,
        retries,
        reason: got.error ?? `HTTP_${got.status}`,
        reason_it: `The Odds API non disponibile (HTTP ${got.status || "?"}). Nessuna quota inventata.`,
      });
    }
    try {
      events = parseOddsApiEvents(JSON.parse(got.text));
    } catch {
      return emptyLane({
        source_id: "the-odds-api",
        url: input.url,
        status: "PARSE_ERROR",
        http_status: got.status,
        retries,
        reason: "INVALID_JSON",
        reason_it: "La risposta di The Odds API non e interpretabile. Nessuna quota inventata.",
      });
    }
  }

  const complete = events.filter((e) => e.homePrice && e.drawPrice && e.awayPrice);
  const records: AcquisitionRecord[] = [
    {
      source_id: "the-odds-api",
      kind: "market",
      feature_key: "odds_api_events",
      value: events.length,
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
      extraction_method: "the_odds_api_h2h_market_only",
      source_url: input.url,
      identity_status: "UNBOUND",
      reason_it: `${events.length} eventi The Odds API, ${complete.length} con 1X2 completo. Solo layer mercato/UI.`,
    },
  ];

  let quotesStored = 0;
  for (const ev of input.labEvents ?? []) {
    const hits = events.filter((e) => e.home && e.away && matchEventPair(ev.home, ev.away, e.home, e.away).matched);
    if (hits.length !== 1) continue;
    const e = hits[0]!;
    if (!e.homePrice || !e.drawPrice || !e.awayPrice) continue;
    records.push({
      source_id: "the-odds-api",
      kind: "market",
      feature_key: "odds_api_event_1x2",
      value: e.homePrice,
      event_id: ev.event_id,
      home: e.home ?? ev.home,
      away: e.away ?? ev.away,
      kickoff_iso: e.commence ?? ev.kickoff_utc ?? null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "the_odds_api_h2h_market_only",
      source_url: input.url,
      identity_status: "EXACT",
      reason_it: "Quota 1X2 The Odds API. Solo confronto UI, non entra nel modello indipendente.",
    });
    if (input.persistLabB && input.labBRoot) {
      const persisted = persistCompareOnlyQuotes({
        labBRoot: input.labBRoot,
        eventId: ev.event_id,
        bookmaker: e.bookmaker ?? "the-odds-api",
        source: "the-odds-api",
        home: e.homePrice,
        draw: e.drawPrice,
        away: e.awayPrice,
        collectedAt: input.nowIso,
      });
      quotesStored += persisted.stored;
    }
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "the-odds-api",
      name: "The Odds API",
      licenseClass: "official_api",
    });
  }

  return {
    source_id: "the-odds-api",
    ok: events.length > 0,
    fetched: true,
    status: events.length > 0 ? "OK" : "NO_DATA",
    http_status: http,
    url,
    records,
    fields_extracted: events.length > 0 ? [...new Set(records.map((r) => r.feature_key))] : [],
    reason: `events=${events.length}; complete_1x2=${complete.length}; market_layer`,
    reason_it: `The Odds API: ${complete.length} quote 1X2 complete. Layer mercato/UI, mai modello indipendente.`,
    retries,
    cache_path: null,
    neon,
    coverage: { leagues: ["soccer_epl"], sports: ["football"], market_quotes: quotesStored || complete.length },
  };
}
