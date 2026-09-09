import { createOddsApiAdapter, createFootballDataOrgAdapter, getOddsApiKey, getFootballDataOrgToken, hashRawJson036 } from "@/domain/eval/prospective-036/sources";
import type { AdapterPull036, OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";
import { unavailablePull } from "@/domain/eval/prospective-036/adapter";

export const LIVE_SOCCER_SPORTS_038 = [
  "soccer_epl",
  "soccer_italy_serie_a",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
] as const;

export { getOddsApiKey, getFootballDataOrgToken };

export function createMultiSportOddsAdapter038(deps: {
  fetch?: typeof fetch;
  key?: string;
  sports?: readonly string[];
}): OddsSourceAdapter {
  const sports = deps.sports ?? LIVE_SOCCER_SPORTS_038;
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
      for (const adapter of inner) {
        pulls.push(await adapter.pull(input));
      }
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
      const events = ok.flatMap((p) => p.events);
      const quotes = ok.flatMap((p) => p.quotes);
      return {
        source: "the-odds-api",
        status: "ok",
        error: ok.length < pulls.length ? `partial: ${pulls.length - ok.length} sports failed` : null,
        requested_at_utc: input.requestedAtUtc,
        received_at_utc: ok.at(-1)?.received_at_utc ?? null,
        events,
        quotes,
        provenance: first.getProvenance(),
        ...raw,
      };
    },
  };
}

export function resolveLiveAdapters038(): OddsSourceAdapter[] {
  return [createMultiSportOddsAdapter038({}), createFootballDataOrgAdapter({})];
}
