import { createHash } from "node:crypto";
import { PermanentError, RetryableError, classifyHttpStatus, withRetry } from "@/ingest/retry";
import { hasUtcOffset } from "@/domain/eval/prospective-036/clocks";
import { parseOddsApiPayload, getOddsApiKey } from "@/domain/eval/prospective-036/sources";
import { parseOddsApiScores, type ScoreRow039 } from "@/domain/eval/live-039/sources";
import { LIVE_SOCCER_SPORTS_039 } from "@/domain/eval/live-039/sources";
import { applyCreditObservation042, parseCreditHeaders042 } from "@/domain/eval/collector-042/credit";
import type { CreditHeaders042, CreditState042 } from "@/domain/eval/collector-042/types";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";

export { LIVE_SOCCER_SPORTS_039 };

export type FetchResult042 = {
  status: number;
  json: unknown;
  headers: CreditHeaders042;
};

export async function fetchOddsApi042(input: {
  url: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}): Promise<FetchResult042> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const { value } = await withRetry(
    async () => {
      const res = await fetchImpl(input.url, { headers: { "user-agent": "task-042-persistent-collector" } });
      const cls = classifyHttpStatus(res.status);
      if (cls === "retryable") throw new RetryableError(`odds-api HTTP ${res.status}`, res.status);
      if (cls === "permanent") throw new PermanentError(`odds-api HTTP ${res.status}`, res.status);
      const headers = parseCreditHeaders042(res.headers);
      const json = (await res.json()) as unknown;
      return { status: res.status, json, headers };
    },
    { maxRetries: input.maxRetries ?? 2 },
  );
  return value;
}

export async function pullSportOdds042(input: {
  sport: string;
  key?: string;
  regions?: string;
  fetchImpl?: typeof fetch;
  creditState: CreditState042;
}): Promise<{
  creditState: CreditState042;
  events: ReturnType<typeof parseOddsApiPayload>["events"];
  quotes: ReturnType<typeof parseOddsApiPayload>["quotes"];
  headers: CreditHeaders042;
  raw_hash: string;
  error: string | null;
  httpStatus: number | null;
}> {
  const cfg = loadGovernorConfig042();
  const key = input.key ?? getOddsApiKey();
  if (!key) {
    return {
      creditState: input.creditState,
      events: [],
      quotes: [],
      headers: { remaining: null, used: null, last: null },
      raw_hash: "",
      error: "THE_ODDS_API_KEY is not set",
      httpStatus: null,
    };
  }
  const regions = input.regions ?? cfg.regions;
  const url = `https://api.the-odds-api.com/v4/sports/${input.sport}/odds?regions=${encodeURIComponent(regions)}&markets=h2h&oddsFormat=decimal&dateFormat=iso&apiKey=${encodeURIComponent(key)}`;
  try {
    const res = await fetchOddsApi042({ url, fetchImpl: input.fetchImpl });
    const parsed = parseOddsApiPayload(res.json);
    const fallback = cfg.estimatedOddsCreditsPerSport;
    const creditState = applyCreditObservation042(input.creditState, res.headers, fallback, cfg);
    const raw_hash = createHash("sha256").update(JSON.stringify(res.json)).digest("hex");
    return {
      creditState,
      events: parsed.events,
      quotes: parsed.quotes,
      headers: res.headers,
      raw_hash,
      error: null,
      httpStatus: res.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "odds pull failed";
    const code = /HTTP (\d{3})/.exec(msg)?.[1];
    return {
      creditState: input.creditState,
      events: [],
      quotes: [],
      headers: { remaining: null, used: null, last: null },
      raw_hash: "",
      error: msg,
      httpStatus: code ? Number(code) : null,
    };
  }
}

export async function pullSportScores042(input: {
  sport: string;
  key?: string;
  fetchImpl?: typeof fetch;
  creditState: CreditState042;
  daysFrom?: number;
}): Promise<{
  creditState: CreditState042;
  scores: ScoreRow039[];
  headers: CreditHeaders042;
  raw_hash: string;
  error: string | null;
  httpStatus: number | null;
}> {
  const cfg = loadGovernorConfig042();
  const key = input.key ?? getOddsApiKey();
  if (!key) {
    return {
      creditState: input.creditState,
      scores: [],
      headers: { remaining: null, used: null, last: null },
      raw_hash: "",
      error: "THE_ODDS_API_KEY is not set",
      httpStatus: null,
    };
  }
  const days = input.daysFrom ?? 3;
  const url = `https://api.the-odds-api.com/v4/sports/${input.sport}/scores?daysFrom=${days}&dateFormat=iso&apiKey=${encodeURIComponent(key)}`;
  try {
    const res = await fetchOddsApi042({ url, fetchImpl: input.fetchImpl });
    const scores = parseOddsApiScores(res.json).filter((s) => !s.commence_time || hasUtcOffset(s.commence_time));
    const fallback = cfg.estimatedScoresCreditsPerSport;
    const creditState = applyCreditObservation042(input.creditState, res.headers, fallback, cfg);
    const raw_hash = createHash("sha256").update(JSON.stringify(res.json)).digest("hex");
    return {
      creditState,
      scores,
      headers: res.headers,
      raw_hash,
      error: null,
      httpStatus: res.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scores pull failed";
    const code = /HTTP (\d{3})/.exec(msg)?.[1];
    return {
      creditState: input.creditState,
      scores: [],
      headers: { remaining: null, used: null, last: null },
      raw_hash: "",
      error: msg,
      httpStatus: code ? Number(code) : null,
    };
  }
}
