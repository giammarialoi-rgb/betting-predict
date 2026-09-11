/**
 * Phase 8 research lanes: API-Sports fixture+injuries+lineups+referee,
 * Understat prior xG, calendar congestion. Continue-on-fail.
 */
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import { appendResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import { resolveApiSportsFixture, type FixtureResolveResult } from "@/domain/eval/data-intelligence/research/api-sports-fixture";
import {
  fetchApiSportsPrematchObservations,
  parseInjuries,
  parseLineups,
} from "@/domain/eval/data-intelligence/adapters/api-sports-prematch";
import { availabilityFromApiSportsInjury } from "@/domain/eval/data-intelligence/research/availability";
import { assignEventSide } from "@/domain/eval/data-intelligence/research/identity-match";
import { upsertTeamIdentity } from "@/domain/eval/data-intelligence/research/identity-registry";
import { researchUnderstatLeague } from "@/domain/eval/data-intelligence/research/understat-league";
import { extractCalendarObservations } from "@/domain/eval/data-intelligence/research/calendar-observations";
import { asOfAfterKickoff } from "@/domain/eval/data-intelligence/research/temporal";
import { publishUnderstatXgObservations } from "@/ingest/understat-feature-publish";

export type Phase8LaneStatus = {
  source_id: string;
  phase: string;
  ok: boolean;
  fetched: boolean;
  parser_status: string;
  fields_extracted: string[];
  reason: string;
  url: string | null;
  http_status: number | null;
  raw_ref: string | null;
};

export type Phase8LaneOut = {
  observations: ResearchObservation[];
  statuses: Phase8LaneStatus[];
};

function persist(rows: ResearchObservation[], root: string): ResearchObservation[] {
  const kept: ResearchObservation[] = [];
  for (const row of rows) {
    if (appendResearchObservation(row, root)) kept.push(row);
  }
  return kept;
}

export async function runApiSportsPhase8Lane(input: {
  ev: PermanentEvent044;
  resolved: FixtureResolveResult | undefined;
  nowIso: string;
  asOf: string;
  root: string;
  allowNetworkDetails: boolean;
}): Promise<Phase8LaneOut> {
  const { ev, nowIso, asOf, root } = input;
  const statuses: Phase8LaneStatus[] = [];
  const observations: ResearchObservation[] = [];
  const kickoff = ev.kickoff_utc ?? nowIso;
  const postKickoff = asOfAfterKickoff(asOf, ev.kickoff_utc);

  let resolved = input.resolved;
  if (!resolved) {
    resolved = await resolveApiSportsFixture({ event: ev, labBRoot: root, nowIso });
  }

  if (!resolved.fixture_id) {
    statuses.push({
      source_id: "api-sports",
      phase: resolved.status === "NO_KEY" ? "UNAVAILABLE" : "UNAVAILABLE",
      ok: false,
      fetched: resolved.status !== "NO_KEY" && resolved.status !== "EMPTY",
      parser_status: resolved.status,
      fields_extracted: [],
      reason: resolved.reason,
      url: "https://v3.football.api-sports.io/",
      http_status: null,
      raw_ref: null,
    });
    return { observations, statuses };
  }

  upsertTeamIdentity({
    canonical_id: ev.home_or_a.toLowerCase(),
    display_name: ev.home_or_a,
    source_ids: { api_sports: resolved.home_team_id != null ? String(resolved.home_team_id) : undefined },
    root,
  });
  upsertTeamIdentity({
    canonical_id: ev.away_or_b.toLowerCase(),
    display_name: ev.away_or_b,
    source_ids: { api_sports: resolved.away_team_id != null ? String(resolved.away_team_id) : undefined },
    root,
  });

  if (resolved.referee && !postKickoff) {
    observations.push({
      event_id: ev.event_id,
      feature_key: "referee_name",
      value: resolved.referee,
      source: "api-sports",
      source_url: "https://v3.football.api-sports.io/",
      observed_at: nowIso,
      available_at: null,
      extraction_method: "api_sports_fixtures",
      confidence: null,
      status: "CONTEXT",
      kind: "EVENT_RESEARCH",
      enters_independent_model: false,
    });
  }
  if (resolved.venue && !postKickoff) {
    observations.push({
      event_id: ev.event_id,
      feature_key: "venue_name",
      value: resolved.venue,
      source: "api-sports",
      source_url: "https://v3.football.api-sports.io/",
      observed_at: nowIso,
      available_at: null,
      extraction_method: "api_sports_fixtures",
      confidence: null,
      status: "CONTEXT",
      kind: "EVENT_RESEARCH",
      enters_independent_model: false,
    });
  }

  const pre = await fetchApiSportsPrematchObservations({
    eventId: ev.event_id,
    eventTime: kickoff,
    homeTeam: ev.home_or_a,
    awayTeam: ev.away_or_b,
    fixtureId: resolved.fixture_id,
    decisionTime: asOf,
    labBRoot: root,
    deps: { allowNetwork: input.allowNetworkDetails },
  });

  const injPath = `/injuries?fixture=${resolved.fixture_id}`;
  const linePath = `/fixtures/lineups?fixture=${resolved.fixture_id}`;
  const { readFileSync, existsSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { join } = await import("node:path");
  const { piRoot } = await import("@/domain/eval/predictive-intelligence/config");
  const hash = (k: string) => createHash("sha256").update(k).digest("hex").slice(0, 20);
  const cacheFile = (path: string) => join(piRoot(root), "data-intelligence", "api-sports-cache", `${hash(path)}.json`);

  let injuriesBody: unknown = null;
  let lineupsBody: unknown = null;
  try {
    const ip = cacheFile(injPath);
    if (existsSync(ip)) injuriesBody = (JSON.parse(readFileSync(ip, "utf8")) as { body: unknown }).body;
  } catch {
    /* ignore */
  }
  try {
    const lp = cacheFile(linePath);
    if (existsSync(lp)) lineupsBody = (JSON.parse(readFileSync(lp, "utf8")) as { body: unknown }).body;
  } catch {
    /* ignore */
  }

  const injRows = injuriesBody ? parseInjuries(injuriesBody) : [];
  for (const r of injRows) {
    const side = assignEventSide(r.teamName, ev.home_or_a, ev.away_or_b).side;
    if (!side) continue;
    const av = availabilityFromApiSportsInjury({
      team: r.teamName,
      player: r.playerName,
      reason: r.reason,
      type: r.type,
      source: "api-sports",
      observed_at: nowIso,
      available_at: r.update,
      kickoffIso: kickoff,
    });
    if (!av.is_pre_match) continue;
    observations.push({
      event_id: ev.event_id,
      feature_key: `${side}_injury_${r.playerName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      value: `${r.playerName}|${av.status}|${av.reason ?? ""}`,
      source: "api-sports",
      source_url: "https://v3.football.api-sports.io/",
      observed_at: nowIso,
      available_at: av.available_at,
      extraction_method: "api_sports_injuries",
      confidence: null,
      status: av.available_at ? "REAL" : "CONTEXT",
      kind: "EVENT_RESEARCH",
      enters_independent_model: false,
    });
  }

  const lineRows = lineupsBody ? parseLineups(lineupsBody) : [];
  for (const side of lineRows) {
    const which = assignEventSide(side.teamName, ev.home_or_a, ev.away_or_b).side;
    if (!which) continue;
    observations.push({
      event_id: ev.event_id,
      feature_key: `${which}_lineup_${side.confirmed ? "confirmed" : "expected"}`,
      value: side.confirmed ? 1 : 0,
      source: "api-sports",
      source_url: "https://v3.football.api-sports.io/",
      observed_at: nowIso,
      available_at: null,
      extraction_method: "api_sports_lineups",
      confidence: null,
      status: "CONTEXT",
      kind: "EVENT_RESEARCH",
      enters_independent_model: false,
    });
  }

  const fields = [
    ...observations.map((o) => o.feature_key),
    ...pre.map((o) => o.feature_name),
  ];
  const ok = observations.length > 0 || pre.length > 0;
  statuses.push({
    source_id: "api-sports",
    phase: postKickoff ? "POST_KICKOFF" : ok ? "OK" : "UNAVAILABLE",
    ok: ok && !postKickoff,
    fetched: true,
    parser_status: ok ? "OK" : "NO_DATA",
    fields_extracted: postKickoff ? [] : [...new Set(fields)],
    reason: postKickoff
      ? "POST_KICKOFF — fixture resolved but excluded from pre-match model"
      : `fixture ${resolved.fixture_id}; obs=${observations.length}; prematch=${pre.length}`,
    url: "https://v3.football.api-sports.io/",
    http_status: 200,
    raw_ref: `fixture:${resolved.fixture_id}`,
  });

  return { observations: persist(observations, root), statuses };
}

export async function runUnderstatPhase8Lane(input: {
  ev: PermanentEvent044;
  nowIso: string;
  asOf: string;
  root: string;
}): Promise<Phase8LaneOut> {
  const { ev, nowIso, root } = input;
  const postKickoff = asOfAfterKickoff(input.asOf, ev.kickoff_utc);
  const lane = await researchUnderstatLeague({
    eventId: ev.event_id,
    home: ev.home_or_a,
    away: ev.away_or_b,
    competition: ev.competition,
    kickoffIso: ev.kickoff_utc ?? nowIso,
    nowIso,
    cacheRoot: root,
  });
  const statuses: Phase8LaneStatus[] = [
    {
      source_id: "understat",
      phase:
        lane.status === "BLOCKED"
          ? "BLOCKED"
          : lane.status === "SUCCESS" || lane.status === "PARTIAL"
            ? postKickoff
              ? "POST_KICKOFF"
              : "OK"
            : "UNAVAILABLE",
      ok: (lane.status === "SUCCESS" || lane.status === "PARTIAL") && !postKickoff,
      fetched: lane.fetched,
      parser_status: lane.status,
      fields_extracted: postKickoff ? [] : lane.observations.map((o) => o.feature_key),
      reason: lane.reason,
      url: lane.url || null,
      http_status: lane.http_status,
      raw_ref: lane.match_id ? `understat:${lane.match_id}` : null,
    },
  ];
  const observations = postKickoff ? [] : persist(lane.observations, root);
  try {
    await publishUnderstatXgObservations({
      observations,
      event: {
        event_id: ev.event_id,
        home: ev.home_or_a,
        away: ev.away_or_b,
        competition: ev.competition,
        kickoff_utc: ev.kickoff_utc,
        sport: ev.sport,
      },
    });
  } catch (e) {
    console.warn(
      `[understat-neon] publish failed event=${ev.event_id}:`,
      e instanceof Error ? e.message : e,
    );
  }
  return { observations, statuses };
}

export function runCalendarPhase8Lane(input: {
  ev: PermanentEvent044;
  nowIso: string;
  asOf: string;
  root: string;
}): Phase8LaneOut {
  const { ev, nowIso, root } = input;
  if (asOfAfterKickoff(input.asOf, ev.kickoff_utc)) {
    return { observations: [], statuses: [] };
  }
  const rows = extractCalendarObservations({
    eventId: ev.event_id,
    home: ev.home_or_a,
    away: ev.away_or_b,
    competition: ev.competition,
    kickoffIso: ev.kickoff_utc ?? nowIso,
    nowIso,
    labBRoot: root,
  });
  return {
    observations: persist(rows, root),
    statuses: [],
  };
}
