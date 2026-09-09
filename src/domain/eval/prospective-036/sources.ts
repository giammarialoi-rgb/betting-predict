import { createHash } from "node:crypto";
import { PermanentError, RetryableError, classifyHttpStatus, withRetry } from "@/ingest/retry";
import { unavailablePull, type AdapterEvent036, type AdapterPull036, type AdapterQuote036, type OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";

export function hashRawJson036(value: unknown): { raw_hash: string; raw_bytes: number; raw_json: unknown } {
  const text = JSON.stringify(value);
  return {
    raw_hash: createHash("sha256").update(text).digest("hex"),
    raw_bytes: Buffer.byteLength(text),
    raw_json: value,
  };
}

export { unavailablePull };
import { hasUtcOffset } from "@/domain/eval/prospective-036/clocks";

export function getOddsApiKey(): string | undefined {
  const k = process.env.THE_ODDS_API_KEY;
  return k && k.length > 0 ? k : undefined;
}

export function getFootballDataOrgToken(): string | undefined {
  const k = process.env.FOOTBALL_DATA_ORG_TOKEN;
  return k && k.length > 0 ? k : undefined;
}

function mapMarket(key: string): string | null {
  if (key === "h2h") return "1X2";
  if (key === "totals") return "OU25";
  if (key === "spreads") return "AH";
  if (key === "btts") return "BTTS";
  return null;
}

function mapSel(name: string, home: string, away: string): string {
  if (name === home) return "HOME";
  if (name === away) return "AWAY";
  const n = name.toLowerCase();
  if (n === "draw" || n === "tie") return "DRAW";
  if (n === "over") return "OVER";
  if (n === "under") return "UNDER";
  return name;
}

export function parseOddsApiPayload(payload: unknown): { events: AdapterEvent036[]; quotes: AdapterQuote036[] } {
  if (!Array.isArray(payload)) return { events: [], quotes: [] };
  const events: AdapterEvent036[] = [];
  const quotes: AdapterQuote036[] = [];
  for (const ev of payload) {
    if (!ev || typeof ev !== "object") continue;
    const rec = ev as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : null;
    const home = typeof rec.home_team === "string" ? rec.home_team : null;
    const away = typeof rec.away_team === "string" ? rec.away_team : null;
    const kick = typeof rec.commence_time === "string" ? rec.commence_time : null;
    const sport = typeof rec.sport_key === "string" ? rec.sport_key : "soccer";
    if (!id || !home || !away || !kick || !hasUtcOffset(kick)) continue;
    events.push({
      source_event_id: id,
      competition: sport,
      season: null,
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
        const market = mapMarket(typeof mk.key === "string" ? mk.key : "");
        if (!market) continue;
        const mTs = typeof mk.last_update === "string" && hasUtcOffset(mk.last_update) ? mk.last_update : bookTs;
        const outcomes = Array.isArray(mk.outcomes) ? mk.outcomes : [];
        for (const o of outcomes) {
          if (!o || typeof o !== "object") continue;
          const oc = o as Record<string, unknown>;
          const name = typeof oc.name === "string" ? oc.name : "";
          const price = typeof oc.price === "number" ? oc.price : Number(oc.price);
          if (!Number.isFinite(price) || price <= 1) continue;
          const sel = mapSel(name, home, away);
          quotes.push({
            source_event_id: id,
            market,
            selection: sel,
            odds_decimal: price,
            bookmaker: bookKey,
            source_record_id: `${id}|${bookKey}|${market}|${sel}`,
            source_timestamp_utc: mTs,
          });
        }
      }
    }
  }
  return { events, quotes };
}

const ODDS_API_PROVENANCE =
  "The Odds API v4 /odds ISO dateFormat. last_update=SOURCE_TIMESTAMP. received_at=COLLECTOR_TIMESTAMP.";

function adapterFromPullFactory(
  id: string,
  provenance: string,
  configured: () => boolean,
  pullFn: (input: { requestedAtUtc: string }) => Promise<AdapterPull036>,
): OddsSourceAdapter {
  return {
    id,
    configured,
    async pull(input) {
      return pullFn(input);
    },
    async discoverEvents() {
      return (await pullFn({ requestedAtUtc: new Date().toISOString() })).events;
    },
    async getEvent(sourceEventId) {
      return (await this.discoverEvents()).find((e) => e.source_event_id === sourceEventId) ?? null;
    },
    async getMarkets(sourceEventId) {
      const quotes = await this.getQuotes(sourceEventId);
      return [...new Set(quotes.map((q) => q.market))].sort();
    },
    async getQuotes(sourceEventId) {
      const quotes = (await pullFn({ requestedAtUtc: new Date().toISOString() })).quotes;
      return sourceEventId ? quotes.filter((q) => q.source_event_id === sourceEventId) : quotes;
    },
    getTimestamp(quote) {
      return quote.source_timestamp_utc;
    },
    getKickoff(event) {
      return event.kickoff_at_utc;
    },
    getProvenance() {
      return provenance;
    },
  };
}

export function createOddsApiAdapter(deps: {
  fetch?: typeof fetch;
  key?: string;
  sport?: string;
}): OddsSourceAdapter {
  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const sport = deps.sport ?? "soccer_epl";
  return adapterFromPullFactory("the-odds-api", ODDS_API_PROVENANCE, () => Boolean(deps.key ?? getOddsApiKey()), async (input) => {
      const key = deps.key ?? getOddsApiKey();
      if (!key) {
        return unavailablePull(
          "the-odds-api",
          input.requestedAtUtc,
          "THE_ODDS_API_KEY is not set. Free/paid key required for live odds with last_update + commence_time. Not bypassed.",
        );
      }
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=uk,eu&markets=h2h&oddsFormat=decimal&dateFormat=iso&apiKey=${encodeURIComponent(key)}`;
      try {
        const { value } = await withRetry(
          async () => {
            const res = await fetchImpl(url, { headers: { "user-agent": "task-036-prospective-collector" } });
            const cls = classifyHttpStatus(res.status);
            if (cls === "retryable") throw new RetryableError(`odds-api HTTP ${res.status}`, res.status);
            if (cls === "permanent") throw new PermanentError(`odds-api HTTP ${res.status}`, res.status);
            return res.json() as Promise<unknown>;
          },
          { maxRetries: 2 },
        );
        const received = new Date().toISOString();
        const parsed = parseOddsApiPayload(value);
        const raw = hashRawJson036(value);
        return {
          source: "the-odds-api",
          status: "ok",
          error: null,
          requested_at_utc: input.requestedAtUtc,
          received_at_utc: received,
          events: parsed.events,
          quotes: parsed.quotes,
          provenance: ODDS_API_PROVENANCE,
          ...raw,
        };
      } catch (err) {
        return {
          source: "the-odds-api",
          status: "error",
          error: err instanceof Error ? err.message : "pull failed",
          requested_at_utc: input.requestedAtUtc,
          received_at_utc: new Date().toISOString(),
          events: [],
          quotes: [],
          provenance: "The Odds API pull failed. No synthetic quotes written.",
        };
      }
  });
}

export function createFootballDataOrgAdapter(deps: { fetch?: typeof fetch; token?: string } = {}): OddsSourceAdapter {
  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const provenance = "football-data.org /matches utcDate kickoff only. Quotes empty — not STRICT odds.";
  return adapterFromPullFactory("football-data-org", provenance, () => Boolean(deps.token ?? getFootballDataOrgToken()), async (input) => {
      const token = deps.token ?? getFootballDataOrgToken();
      if (!token) {
        return unavailablePull(
          "football-data-org",
          input.requestedAtUtc,
          "FOOTBALL_DATA_ORG_TOKEN is not set. Fixture/kickoff only even when set; no bookmaker quote clock on the free catalog.",
        );
      }
      try {
        const { value } = await withRetry(
          async () => {
            const res = await fetchImpl("https://api.football-data.org/v4/matches?status=SCHEDULED", {
              headers: { "X-Auth-Token": token, "user-agent": "task-036-prospective-collector" },
            });
            const cls = classifyHttpStatus(res.status);
            if (cls === "retryable") throw new RetryableError(`fd-org HTTP ${res.status}`, res.status);
            if (cls === "permanent") throw new PermanentError(`fd-org HTTP ${res.status}`, res.status);
            return res.json() as Promise<{ matches?: Record<string, unknown>[] }>;
          },
          { maxRetries: 2 },
        );
        const received = new Date().toISOString();
        const raw = hashRawJson036(value);
        const events: AdapterEvent036[] = [];
        for (const m of value.matches ?? []) {
          const utc = typeof m.utcDate === "string" ? m.utcDate : null;
          const home = (m.homeTeam as { name?: string } | undefined)?.name;
          const away = (m.awayTeam as { name?: string } | undefined)?.name;
          const id = m.id != null ? String(m.id) : null;
          const comp = (m.competition as { code?: string } | undefined)?.code ?? "UNK";
          if (!id || !home || !away || !utc || !hasUtcOffset(utc)) continue;
          events.push({
            source_event_id: id,
            competition: comp,
            season: null,
            home_team: home,
            away_team: away,
            kickoff_at_utc: utc,
          });
        }
        return {
          source: "football-data-org",
          status: "ok",
          error: null,
          requested_at_utc: input.requestedAtUtc,
          received_at_utc: received,
          events,
          quotes: [],
          provenance,
          ...raw,
        };
      } catch (err) {
        return {
          source: "football-data-org",
          status: "error",
          error: err instanceof Error ? err.message : "pull failed",
          requested_at_utc: input.requestedAtUtc,
          received_at_utc: new Date().toISOString(),
          events: [],
          quotes: [],
          provenance: "football-data.org pull failed.",
        };
      }
  });
}

export function createFixtureAdapter(pull: AdapterPull036): OddsSourceAdapter {
  return adapterFromPullFactory(pull.source, pull.provenance, () => pull.status === "ok", async () => pull);
}

export function resolveLiveAdapters(): OddsSourceAdapter[] {
  return [createOddsApiAdapter({}), createFootballDataOrgAdapter({})];
}
