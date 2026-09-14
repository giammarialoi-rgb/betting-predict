/**
 * Resolve API-Sports fixture ids from team names + date + competition.
 * Never invents fixture IDs. Budget-aware. Reuses cache.
 */
import { apiSportsGet057 } from "@/domain/data-sources/api-sports/client";
import { normalizeFixtures057 } from "@/domain/data-sources/api-sports/normalize";
import { resolveCompetitionMatrix, europeanSeasonYear } from "@/domain/eval/data-intelligence/research/identity-normalize";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import {
  getSourceEventIdentity,
  mergeSourceEventIdentity,
  type SourceEventIdentity,
} from "@/domain/eval/data-intelligence/research/source-identity-cache";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

export type FixtureResolveStatus =
  | "RESOLVED"
  | "CACHED"
  | "NO_EVENT"
  | "AMBIGUOUS_EVENT"
  | "NO_KEY"
  | "HTTP_ERROR"
  | "EMPTY";

export type FixtureResolveResult = {
  event_id: string;
  status: FixtureResolveStatus;
  fixture_id: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  referee: string | null;
  venue: string | null;
  reason: string;
  from_cache: boolean;
  requests_charged: number;
};

type FixtureRow = {
  fixture?: {
    id?: number;
    date?: string;
    referee?: string | null;
    venue?: { name?: string | null };
  };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
};

function parseReferee(body: unknown, fixtureId: number): { referee: string | null; venue: string | null } {
  const response = (body as { response?: FixtureRow[] })?.response;
  if (!Array.isArray(response)) return { referee: null, venue: null };
  const row = response.find((r) => r.fixture?.id === fixtureId);
  return {
    referee: typeof row?.fixture?.referee === "string" && row.fixture.referee.trim() ? row.fixture.referee.trim() : null,
    venue: row?.fixture?.venue?.name?.trim() || null,
  };
}

function matchFixture(
  body: unknown,
  home: string,
  away: string,
): { status: FixtureResolveStatus; row: ReturnType<typeof normalizeFixtures057>[number] | null; reason: string } {
  const all = normalizeFixtures057(body);
  const hits = all.filter((e) => matchEventPair(home, away, e.home_team, e.away_team).matched);
  if (hits.length === 1) {
    const pair = matchEventPair(home, away, hits[0]!.home_team, hits[0]!.away_team);
    return {
      status: "RESOLVED",
      row: hits[0]!,
      reason: `matched fixture ${hits[0]!.provider_event_id} (${pair.method})`,
    };
  }
  if (hits.length > 1) {
    return {
      status: "AMBIGUOUS_EVENT",
      row: null,
      reason: `AMBIGUOUS_EVENT — ${hits.length} fixtures matched names. Identità ambigua: nessun aggancio.`,
    };
  }
  // swapped names / short-name collisions are a different event — do not bind
  const short = all.some(
    (e) =>
      matchEventPair(home, away, e.home_team, e.away_team).status === "SHORT_NAME_BLOCKED" ||
      matchEventPair(home, away, e.home_team, e.away_team).status === "AMBIGUOUS",
  );
  return {
    status: "NO_EVENT",
    row: null,
    reason: short
      ? "NO_EVENT — IDENTITY_SHORT_NAME / IDENTITY_AMBIGUOUS — home/away not unique. Nessun aggancio."
      : "NO_EVENT — date payload did not contain this home/away pair",
  };
}

export async function resolveApiSportsFixture(input: {
  event: PermanentEvent044;
  labBRoot?: string;
  nowIso?: string;
  deps?: {
    fixturesBody?: unknown;
    skipNetwork?: boolean;
  };
}): Promise<FixtureResolveResult> {
  const ev = input.event;
  const cached = getSourceEventIdentity(ev.event_id, input.labBRoot);
  if (cached?.api_sports_fixture_id) {
    return {
      event_id: ev.event_id,
      status: "CACHED",
      fixture_id: cached.api_sports_fixture_id,
      home_team_id: cached.api_sports_home_id,
      away_team_id: cached.api_sports_away_id,
      referee: cached.referee_name,
      venue: cached.venue_name,
      reason: `cached api_sports_fixture_id=${cached.api_sports_fixture_id}`,
      from_cache: true,
      requests_charged: 0,
    };
  }

  const day = (ev.kickoff_utc ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return {
      event_id: ev.event_id,
      status: "NO_EVENT",
      fixture_id: null,
      home_team_id: null,
      away_team_id: null,
      referee: null,
      venue: null,
      reason: "IDENTITY_FAILURE — kickoff date missing",
      from_cache: false,
      requests_charged: 0,
    };
  }

  const comp = resolveCompetitionMatrix(ev.competition);
  const season = europeanSeasonYear(ev.kickoff_utc);
  let body: unknown = input.deps?.fixturesBody ?? null;
  let charged = 0;
  let from_cache = false;

  if (!body && !input.deps?.skipNetwork) {
    const leagueQ = comp.api_sports_league_id
      ? `&league=${comp.api_sports_league_id}&season=${season}`
      : "";
    const path = `/fixtures?date=${day}${leagueQ}`;
    const res = await apiSportsGet057(path, { useCacheMs: 6 * 3600_000 });
    charged += res.requests_charged;
    from_cache = res.from_cache;
    if (!res.ok) {
      const err = res.error ?? "HTTP_ERROR";
      return {
        event_id: ev.event_id,
        status: err === "API_KEY_NOT_CONFIGURED" ? "NO_KEY" : "HTTP_ERROR",
        fixture_id: null,
        home_team_id: null,
        away_team_id: null,
        referee: null,
        venue: null,
        reason: err,
        from_cache,
        requests_charged: charged,
      };
    }
    body = res.body;
  }

  if (!body) {
    return {
      event_id: ev.event_id,
      status: "EMPTY",
      fixture_id: null,
      home_team_id: null,
      away_team_id: null,
      referee: null,
      venue: null,
      reason: "EMPTY — no fixtures body",
      from_cache,
      requests_charged: charged,
    };
  }

  const matched = matchFixture(body, ev.home_or_a, ev.away_or_b);
  if (!matched.row) {
    // If league-filtered missed, try date-only once (still no invented id)
    if (comp.api_sports_league_id && !input.deps?.skipNetwork && !input.deps?.fixturesBody) {
      const res2 = await apiSportsGet057(`/fixtures?date=${day}`, { useCacheMs: 6 * 3600_000 });
      charged += res2.requests_charged;
      if (res2.ok) {
        const m2 = matchFixture(res2.body, ev.home_or_a, ev.away_or_b);
        if (m2.row) {
          const extra = parseReferee(res2.body, Number(m2.row.provider_event_id));
          persistResolved(ev.event_id, m2.row, extra, input.labBRoot, input.nowIso);
          return pack(ev.event_id, m2, extra, charged, res2.from_cache);
        }
        return {
          event_id: ev.event_id,
          status: m2.status,
          fixture_id: null,
          home_team_id: null,
          away_team_id: null,
          referee: null,
          venue: null,
          reason: m2.reason,
          from_cache: res2.from_cache,
          requests_charged: charged,
        };
      }
    }
    return {
      event_id: ev.event_id,
      status: matched.status,
      fixture_id: null,
      home_team_id: null,
      away_team_id: null,
      referee: null,
      venue: null,
      reason: matched.reason,
      from_cache,
      requests_charged: charged,
    };
  }

  const extra = parseReferee(body, Number(matched.row.provider_event_id));
  persistResolved(ev.event_id, matched.row, extra, input.labBRoot, input.nowIso);
  return pack(ev.event_id, matched, extra, charged, from_cache);
}

function persistResolved(
  eventId: string,
  row: ReturnType<typeof normalizeFixtures057>[number],
  extra: { referee: string | null; venue: string | null },
  root?: string,
  nowIso?: string,
): SourceEventIdentity {
  return mergeSourceEventIdentity(
    eventId,
    {
      api_sports_fixture_id: Number(row.provider_event_id),
      api_sports_home_id: row.home_team_id,
      api_sports_away_id: row.away_team_id,
      referee_name: extra.referee,
      venue_name: extra.venue,
      source_team_ids: {
        "api-sports": {
          home: row.home_team_id != null ? String(row.home_team_id) : null,
          away: row.away_team_id != null ? String(row.away_team_id) : null,
        },
      },
      source_competition_id: {
        "api-sports": row.league_id != null ? String(row.league_id) : null,
      },
      retrieved_at: nowIso ?? new Date().toISOString(),
    },
    root,
  );
}

function pack(
  eventId: string,
  matched: { status: FixtureResolveStatus; row: ReturnType<typeof normalizeFixtures057>[number] | null; reason: string },
  extra: { referee: string | null; venue: string | null },
  charged: number,
  from_cache: boolean,
): FixtureResolveResult {
  const row = matched.row!;
  return {
    event_id: eventId,
    status: matched.status,
    fixture_id: Number(row.provider_event_id),
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    referee: extra.referee,
    venue: extra.venue,
    reason: matched.reason,
    from_cache,
    requests_charged: charged,
  };
}

/**
 * One fixtures call per unique date, then bind each event. Cuts quota vs N×fixture lookups.
 */
export async function resolveApiSportsFixturesForBatch(input: {
  events: PermanentEvent044[];
  labBRoot?: string;
  nowIso?: string;
  maxNetworkDates?: number;
}): Promise<Map<string, FixtureResolveResult>> {
  const out = new Map<string, FixtureResolveResult>();
  const pending: PermanentEvent044[] = [];
  for (const ev of input.events) {
    const cached = getSourceEventIdentity(ev.event_id, input.labBRoot);
    if (cached?.api_sports_fixture_id) {
      out.set(ev.event_id, {
        event_id: ev.event_id,
        status: "CACHED",
        fixture_id: cached.api_sports_fixture_id,
        home_team_id: cached.api_sports_home_id,
        away_team_id: cached.api_sports_away_id,
        referee: cached.referee_name,
        venue: cached.venue_name,
        reason: `cached api_sports_fixture_id=${cached.api_sports_fixture_id}`,
        from_cache: true,
        requests_charged: 0,
      });
    } else {
      pending.push(ev);
    }
  }

  const byDate = new Map<string, PermanentEvent044[]>();
  for (const ev of pending) {
    const day = (ev.kickoff_utc ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      out.set(ev.event_id, {
        event_id: ev.event_id,
        status: "NO_EVENT",
        fixture_id: null,
        home_team_id: null,
        away_team_id: null,
        referee: null,
        venue: null,
        reason: "IDENTITY_FAILURE — kickoff date missing",
        from_cache: false,
        requests_charged: 0,
      });
      continue;
    }
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day)!.push(ev);
  }

  let netDates = 0;
  const maxNet = input.maxNetworkDates ?? 6;
  for (const [day, evs] of byDate) {
    const useNet = netDates < maxNet;
    let body: unknown = null;
    let charged = 0;
    let from_cache = false;
    if (useNet) {
      const res = await apiSportsGet057(`/fixtures?date=${day}`, { useCacheMs: 6 * 3600_000 });
      charged = res.requests_charged;
      from_cache = res.from_cache;
      if (res.ok) {
        body = res.body;
        netDates += res.from_cache ? 0 : 1;
      } else {
        for (const ev of evs) {
          out.set(ev.event_id, {
            event_id: ev.event_id,
            status: res.error === "API_KEY_NOT_CONFIGURED" ? "NO_KEY" : "HTTP_ERROR",
            fixture_id: null,
            home_team_id: null,
            away_team_id: null,
            referee: null,
            venue: null,
            reason: res.error ?? "HTTP_ERROR",
            from_cache,
            requests_charged: charged,
          });
        }
        continue;
      }
    }
    if (!body) {
      for (const ev of evs) {
        out.set(ev.event_id, {
          event_id: ev.event_id,
          status: "EMPTY",
          fixture_id: null,
          home_team_id: null,
          away_team_id: null,
          referee: null,
          venue: null,
          reason: "EMPTY — fixtures date body unavailable",
          from_cache,
          requests_charged: charged,
        });
      }
      continue;
    }
    for (const ev of evs) {
      const matched = matchFixture(body, ev.home_or_a, ev.away_or_b);
      if (!matched.row) {
        out.set(ev.event_id, {
          event_id: ev.event_id,
          status: matched.status,
          fixture_id: null,
          home_team_id: null,
          away_team_id: null,
          referee: null,
          venue: null,
          reason: matched.reason,
          from_cache,
          requests_charged: 0,
        });
        continue;
      }
      const extra = parseReferee(body, Number(matched.row.provider_event_id));
      persistResolved(ev.event_id, matched.row, extra, input.labBRoot, input.nowIso);
      out.set(ev.event_id, pack(ev.event_id, matched, extra, charged, from_cache));
    }
  }
  return out;
}
