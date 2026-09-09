import { createHash } from "node:crypto";
import { PermanentError, RetryableError, classifyHttpStatus, withRetry } from "@/ingest/retry";
import { hasUtcOffset } from "@/domain/eval/prospective-036/clocks";
import {
  createOddsApiAdapter,
  getFootballDataOrgToken,
  getOddsApiKey,
  hashRawJson036,
  parseOddsApiPayload,
} from "@/domain/eval/prospective-036/sources";
import { unavailablePull, type AdapterPull036, type OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";

export { getOddsApiKey, getFootballDataOrgToken };

export const LIVE_SOCCER_SPORTS_039 = [
  "soccer_epl",
  "soccer_italy_serie_a",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
] as const;

export function failureMode039(error: string | null): string | null {
  if (!error) return null;
  const m = error.match(/HTTP (\d{3})/i);
  if (m) {
    const code = Number(m[1]);
    if (code === 401) return "401";
    if (code === 403) return "403";
    if (code === 429) return "429";
    if (code >= 500) return "5xx";
  }
  if (/timeout/i.test(error)) return "timeout";
  if (/malformed|json/i.test(error)) return "malformed JSON";
  if (/SOURCE_UNAVAILABLE|not set/i.test(error)) return "not_configured";
  return error.slice(0, 80);
}

export function createLiveOddsAdapter039(deps: {
  fetch?: typeof fetch;
  key?: string;
  sports?: readonly string[];
}): OddsSourceAdapter {
  const sports = deps.sports ?? LIVE_SOCCER_SPORTS_039;
  const inner = sports.map((sport) => createOddsApiAdapter({ fetch: deps.fetch, key: deps.key, sport }));
  const first = inner[0]!;
  return {
    ...first,
    id: "the-odds-api",
    configured() {
      return Boolean(deps.key ?? getOddsApiKey());
    },
    async pull(input) {
      if (!this.configured()) {
        return unavailablePull(
          "the-odds-api",
          input.requestedAtUtc,
          "THE_ODDS_API_KEY is not set. Live /odds last_update + commence_time required. Not bypassed.",
        );
      }
      const pulls: AdapterPull036[] = [];
      for (const adapter of inner) pulls.push(await adapter.pull(input));
      const ok = pulls.filter((p) => p.status === "ok");
      const err = pulls.find((p) => p.status === "error");
      const bundle = pulls.map((p, i) => ({ sport: sports[i], hash: p.raw_hash ?? null, body: p.raw_json ?? null }));
      const raw = hashRawJson036(bundle);
      if (ok.length === 0) {
        return {
          source: "the-odds-api",
          status: err ? "error" : "SOURCE_UNAVAILABLE",
          error: err?.error ?? pulls[0]?.error ?? "all sports unavailable",
          requested_at_utc: input.requestedAtUtc,
          received_at_utc: pulls.at(-1)?.received_at_utc ?? null,
          events: [],
          quotes: [],
          provenance: first.getProvenance(),
          ...raw,
        };
      }
      return {
        source: "the-odds-api",
        status: "ok",
        error: ok.length < pulls.length ? `partial: ${pulls.length - ok.length} sports failed` : null,
        requested_at_utc: input.requestedAtUtc,
        received_at_utc: ok.at(-1)?.received_at_utc ?? null,
        events: ok.flatMap((p) => p.events),
        quotes: ok.flatMap((p) => p.quotes),
        provenance: first.getProvenance(),
        ...raw,
      };
    },
  };
}

export type ScoreRow039 = {
  source_event_id: string;
  home_team: string;
  away_team: string;
  commence_time: string | null;
  completed: boolean;
  home_score: number | null;
  away_score: number | null;
};

export function parseOddsApiScores(payload: unknown): ScoreRow039[] {
  if (!Array.isArray(payload)) return [];
  const out: ScoreRow039[] = [];
  for (const ev of payload) {
    if (!ev || typeof ev !== "object") continue;
    const rec = ev as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : null;
    const home = typeof rec.home_team === "string" ? rec.home_team : null;
    const away = typeof rec.away_team === "string" ? rec.away_team : null;
    const kick = typeof rec.commence_time === "string" ? rec.commence_time : null;
    if (!id || !home || !away) continue;
    const scores = Array.isArray(rec.scores) ? rec.scores : [];
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    for (const s of scores) {
      if (!s || typeof s !== "object") continue;
      const row = s as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name : "";
      const sc = row.score == null ? null : Number(row.score);
      if (!Number.isFinite(sc)) continue;
      if (name === home) homeScore = sc;
      if (name === away) awayScore = sc;
    }
    out.push({
      source_event_id: id,
      home_team: home,
      away_team: away,
      commence_time: kick && hasUtcOffset(kick) ? kick : null,
      completed: rec.completed === true,
      home_score: homeScore,
      away_score: awayScore,
    });
  }
  return out;
}

export async function pullScores039(deps: {
  fetch?: typeof fetch;
  key?: string;
  sport?: string;
  requestedAtUtc: string;
}): Promise<{ status: "ok" | "SOURCE_UNAVAILABLE" | "error"; error: string | null; scores: ScoreRow039[]; raw_hash: string | null }> {
  const key = deps.key ?? getOddsApiKey();
  if (!key) {
    return { status: "SOURCE_UNAVAILABLE", error: "THE_ODDS_API_KEY is not set", scores: [], raw_hash: null };
  }
  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const sport = deps.sport ?? "soccer_epl";
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores?daysFrom=3&dateFormat=iso&apiKey=${encodeURIComponent(key)}`;
  try {
    const { value } = await withRetry(
      async () => {
        const res = await fetchImpl(url, { headers: { "user-agent": "task-039-prospective-live" } });
        const cls = classifyHttpStatus(res.status);
        if (cls === "retryable") throw new RetryableError(`odds-api scores HTTP ${res.status}`, res.status);
        if (cls === "permanent") throw new PermanentError(`odds-api scores HTTP ${res.status}`, res.status);
        return res.json() as Promise<unknown>;
      },
      { maxRetries: 2 },
    );
    const raw = createHash("sha256").update(JSON.stringify(value)).digest("hex");
    return { status: "ok", error: null, scores: parseOddsApiScores(value), raw_hash: raw };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "scores pull failed",
      scores: [],
      raw_hash: null,
    };
  }
}

export { parseOddsApiPayload };
