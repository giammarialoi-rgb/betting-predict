/**
 * ClubElo public CSV — retry/backoff + HTTPS + previous-day failover.
 * Still NO_DATA if every attempt fails. No fake Elo.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchClubEloDay } from "@/providers/clubelo/adapter";
import { clubEloDayPath } from "@/domain/eval/data-intelligence/clubelo-ensure";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { pickUniqueTeam } from "@/domain/eval/data-intelligence/research/identity-match";
import { persistClubEloRatings } from "@/domain/eval/acquisition-engine/persist";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { CLUBELO_FAILOVER_TEMPLATES } from "@/domain/eval/acquisition-engine/catalog";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

function looksLikeClubEloCsv(text: string): boolean {
  const head = text.slice(0, 200).toLowerCase();
  return head.includes("rank") && head.includes("club") && head.includes("elo");
}

function shiftDay(day: string, minusDays: number): string {
  const t = Date.parse(`${day}T00:00:00.000Z`);
  return new Date(t - minusDays * 86_400_000).toISOString().slice(0, 10);
}

export async function runClubEloLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  csvText?: string;
  labEvents?: AcquisitionCycleInput["labEvents"];
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  const day = input.nowIso.slice(0, 10);

  if (input.csvText) {
    return finishClubElo({
      ...input,
      rawText: input.csvText,
      url: input.url,
      http: 200,
      ratingDate: day,
      retries: 0,
    });
  }

  let fetched = await fetchClubEloDay(day, { fetch: input.fetchImpl });
  if (fetched.provider_status === "OK" && fetched.rawText) {
    return finishClubElo({
      ...input,
      rawText: fetched.rawText,
      url: fetched.url,
      http: fetched.http_status,
      ratingDate: fetched.rating_date,
      retries: 0,
    });
  }

  const failoverDays = [day, shiftDay(day, 1), shiftDay(day, 2), shiftDay(day, 3)];
  let lastHttp = fetched.http_status || 0;
  let lastUrl = fetched.url;
  let retries = 0;
  let lastReason = fetched.reason ?? fetched.provider_status;

  for (const tryDay of failoverDays) {
    for (const tmpl of CLUBELO_FAILOVER_TEMPLATES) {
      const url = tmpl(tryDay);
      if (url === fetched.url) continue;
      const got = await acquisitionGet({
        url,
        sourceId: "clubelo",
        minIntervalMs: input.fetchImpl ? 0 : 500,
        fetchImpl: input.fetchImpl,
        maxRetries: input.maxRetries ?? 2,
      });
      retries += got.retries;
      lastHttp = got.status;
      lastUrl = got.url;
      lastReason = got.error ?? `HTTP_${got.status}`;
      if (!got.ok || !looksLikeClubEloCsv(got.text)) continue;
      return finishClubElo({
        ...input,
        rawText: got.text,
        url: got.url,
        http: got.status,
        ratingDate: tryDay,
        retries,
      });
    }
  }

  const blocked = lastHttp === 403 || lastHttp === 429;
  return emptyLane({
    source_id: "clubelo",
    url: lastUrl,
    status:
      lastHttp === 429
        ? "RATE_LIMITED"
        : blocked
          ? "BLOCKED"
          : "NO_DATA",
    http_status: lastHttp || null,
    retries,
    reason: lastReason,
    reason_it:
      lastHttp === 403
        ? "ClubElo ha restituito HTTP 403. Nessun rating inventato."
        : `ClubElo non disponibile (${lastReason}). Failover HTTP/HTTPS e giorni precedenti esauriti. Nessun Elo inventato.`,
  });
}

async function finishClubElo(input: {
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  labEvents?: AcquisitionCycleInput["labEvents"];
  rawText: string;
  url: string;
  http: number;
  ratingDate: string;
  retries: number;
}): Promise<SourceLaneResult> {
  const path = clubEloDayPath(input.cwd, input.ratingDate);
  mkdirSync(join(input.cwd, "data", "clubelo"), { recursive: true });
  writeFileSync(path, input.rawText, "utf8");

  const table = parseCsv(input.rawText);
  const clubRows = table.rows
    .map((row) => {
      const club = row.Club ?? row.club;
      const elo = Number(row.Elo ?? row.elo);
      const from = row.From ?? row.from ?? input.ratingDate;
      if (!club || !Number.isFinite(elo)) return null;
      return { club, elo, from };
    })
    .filter((r): r is { club: string; elo: number; from: string } => r != null);
  const clubNames = clubRows.map((r) => r.club);
  const records: AcquisitionRecord[] = [];

  for (const ev of input.labEvents ?? []) {
    const home = pickUniqueTeam(ev.home, clubNames);
    const away = pickUniqueTeam(ev.away, clubNames);
    const homeObs = home.matched ? clubRows.find((o) => o.club === home.candidate) : null;
    const awayObs = away.matched ? clubRows.find((o) => o.club === away.candidate) : null;
    if (homeObs && home.matched) {
      const avail = `${homeObs.from}T00:00:00.000Z`;
      const kick = ev.kickoff_utc ?? input.nowIso;
      if (Date.parse(avail) >= Date.parse(kick.slice(0, 10) + "T00:00:00.000Z")) continue;
      records.push({
        source_id: "clubelo",
        kind: "ratings",
        feature_key: "home_elo",
        value: homeObs.elo,
        event_id: ev.event_id,
        home: ev.home,
        away: ev.away,
        kickoff_iso: ev.kickoff_utc ?? null,
        team_name: ev.home,
        observed_at: input.nowIso,
        available_at: avail,
        temporal_precision: "dataset_window",
        feature_status: "VALID",
        enters_independent_model: false,
        extraction_method: "clubelo_public_csv",
        source_url: input.url,
        identity_status: home.status,
        reason_it: home.reason_it,
      });
    } else if (!home.matched) {
      records.push({
        source_id: "clubelo",
        kind: "ratings",
        feature_key: "home_elo_unbound",
        value: null,
        event_id: ev.event_id,
        home: ev.home,
        away: ev.away,
        kickoff_iso: ev.kickoff_utc ?? null,
        team_name: ev.home,
        observed_at: input.nowIso,
        available_at: null,
        temporal_precision: "unknown",
        feature_status: "NOT_ELIGIBLE",
        enters_independent_model: false,
        extraction_method: "clubelo_public_csv",
        source_url: input.url,
        identity_status: home.status,
        reason_it: home.reason_it,
      });
    }
    if (awayObs && away.matched) {
      const avail = `${awayObs.from}T00:00:00.000Z`;
      const kick = ev.kickoff_utc ?? input.nowIso;
      if (Date.parse(avail) >= Date.parse(kick.slice(0, 10) + "T00:00:00.000Z")) continue;
      records.push({
        source_id: "clubelo",
        kind: "ratings",
        feature_key: "away_elo",
        value: awayObs.elo,
        event_id: ev.event_id,
        home: ev.home,
        away: ev.away,
        kickoff_iso: ev.kickoff_utc ?? null,
        team_name: ev.away,
        observed_at: input.nowIso,
        available_at: avail,
        temporal_precision: "dataset_window",
        feature_status: "VALID",
        enters_independent_model: false,
        extraction_method: "clubelo_public_csv",
        source_url: input.url,
        identity_status: away.status,
        reason_it: away.reason_it,
      });
    }
  }

  records.push({
    source_id: "clubelo",
    kind: "ratings",
    feature_key: "clubelo_clubs_parsed",
    value: clubRows.length,
    event_id: null,
    home: null,
    away: null,
    kickoff_iso: null,
    team_name: null,
    observed_at: input.nowIso,
    available_at: `${input.ratingDate}T00:00:00.000Z`,
    temporal_precision: "dataset_window",
    feature_status: "CONTEXT",
    enters_independent_model: false,
    extraction_method: "clubelo_public_csv",
    source_url: input.url,
    identity_status: "UNBOUND",
    reason_it: `CSV ClubElo in cache (${clubRows.length} club).`,
  });

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    const ratings = clubRows.slice(0, 40).map((o) => ({
      teamName: o.club,
      rating: o.elo,
      availableAt: new Date(`${o.from}T00:00:00.000Z`),
      snapshotAt: new Date(`${o.from}T00:00:00.000Z`),
    }));
    const res = await persistClubEloRatings({
      ratings,
      observedAt: new Date(input.nowIso),
    });
    neon = {
      source_registered: res.reason == null || res.stored > 0,
      elo_stored: res.stored,
      features_stored: 0,
      reason: res.reason,
    };
  }

  const bound = records.filter((r) => r.feature_key === "home_elo" || r.feature_key === "away_elo");
  return {
    source_id: "clubelo",
    ok: clubRows.length > 0,
    fetched: true,
    status: clubRows.length > 0 ? (bound.length > 0 ? "OK" : "PARTIAL") : "NO_DATA",
    http_status: input.http,
    url: input.url,
    records,
    fields_extracted: ["clubelo_clubs_parsed", ...bound.map((r) => r.feature_key)],
    reason: `cached ${path}; clubs=${clubRows.length}; bound=${bound.length}`,
    reason_it: `ClubElo CSV salvato in locale (${clubRows.length} club). ${bound.length} rating abbinate in modo univoco.`,
    retries: input.retries,
    cache_path: path,
    neon,
  };
}
