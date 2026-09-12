/**
 * Pick ONE real event from working free sources. Never invent identity or score.
 */
import { createHash } from "node:crypto";
import {
  ESPN_SCOREBOARDS,
  OPENLIGA_LEAGUES,
  THESPORTSDB_LEAGUES,
  espnScoreboardUrl,
  openLigaMatchUrl,
  theSportsDbNextUrl,
} from "@/domain/eval/acquisition-engine/catalog";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import { parseTheSportsDbEvents } from "@/domain/eval/acquisition-engine/sources/thesportsdb";
import { parseOpenLigaMatches, type OpenLigaMatch } from "@/domain/eval/acquisition-engine/sources/openligadb";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { GoldenEventPick } from "@/domain/eval/betmind-runtime/golden-e2e/types";

function fp(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}

export async function fetchText(
  url: string,
  timeoutMs = 12_000,
): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "betmind-golden-e2e/1.0 (ordinary GET; no WAF bypass)",
      },
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

function openLigaScore(m: OpenLigaMatch): { home: number; away: number } | null {
  const results = m.matchResults ?? [];
  const final =
    results.find((r) => r.resultTypeID === 2) ??
    results.find((r) => r.pointsTeam1 != null && r.pointsTeam2 != null);
  if (final?.pointsTeam1 == null || final.pointsTeam2 == null) return null;
  if (!Number.isFinite(final.pointsTeam1) || !Number.isFinite(final.pointsTeam2)) return null;
  return { home: final.pointsTeam1, away: final.pointsTeam2 };
}

export type DiscoveredCandidate = GoldenEventPick;

export async function discoverGoldenCandidates(nowMs = Date.now()): Promise<{
  candidates: DiscoveredCandidate[];
  probes: GoldenEventPick["discovery_probes"];
}> {
  const nowIso = new Date(nowMs).toISOString();
  const probes: GoldenEventPick["discovery_probes"] = [];
  const candidates: DiscoveredCandidate[] = [];

  for (const league of OPENLIGA_LEAGUES.slice(0, 4)) {
    const url = openLigaMatchUrl(league.shortcut);
    try {
      const { status, text } = await fetchText(url);
      const parsed = status === 200 ? parseOpenLigaMatches(text) : [];
      probes.push({ source: "openligadb", url, status, parsed: parsed.length });
      if (status !== 200) continue;
      for (const m of parsed) {
        const home = m.team1?.teamName;
        const away = m.team2?.teamName;
        const raw = m.matchDateTimeUTC || m.matchDateTime;
        if (!home || !away || !raw) continue;
        const ko = Date.parse(raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`);
        if (!Number.isFinite(ko)) continue;
        const event_id = fp(`oldb|${m.matchID ?? `${home}|${away}|${raw}`}`);
        const finished = m.matchIsFinished === true;
        const score = finished ? openLigaScore(m) : null;
        const live = !finished && ko <= nowMs;
        candidates.push({
          event: {
            event_id,
            canonical_event_id: event_id,
            source: "openligadb",
            source_event_id: String(m.matchID ?? event_id),
            sport: "soccer",
            competition: m.leagueName ?? league.label,
            country: null,
            home_or_a: home,
            away_or_b: away,
            kickoff_utc: new Date(ko).toISOString(),
            collected_at_utc: nowIso,
            available_at_utc: nowIso,
            semantic_level: "RESEARCH",
            data_quality: 0.4,
            fingerprint: event_id,
            status: finished ? "FINISHED" : live ? "LIVE" : "UPCOMING",
            origin: "DISCOVERED_LIVE",
          },
          source: "openligadb",
          finished,
          live,
          score,
          score_source: score ? "openligadb" : null,
          discovery_probes: [],
        });
      }
    } catch {
      probes.push({ source: "openligadb", url, status: 0, parsed: 0 });
    }
  }

  for (const board of ESPN_SCOREBOARDS.slice(0, 3)) {
    const url = espnScoreboardUrl(board);
    try {
      const { status, text } = await fetchText(url);
      const parsed = status === 200 ? parseEspnScoreboard(text, board.slug) : [];
      probes.push({ source: "espn", url, status, parsed: parsed.length });
      if (status !== 200) continue;
      for (const e of parsed) {
        if (!e.home || !e.away || !e.date) continue;
        const ko = Date.parse(e.date);
        if (!Number.isFinite(ko)) continue;
        const event_id = fp(`espn|${e.id ?? `${e.home}|${e.away}|${e.date}`}`);
        const finished = e.completed === true;
        const live = !finished && Number.isFinite(ko) && ko <= nowMs && ko >= nowMs - 3 * 3600_000;
        candidates.push({
          event: {
            event_id,
            canonical_event_id: event_id,
            source: "espn",
            source_event_id: String(e.id ?? event_id),
            sport: "soccer",
            competition: e.league ?? board.slug,
            country: null,
            home_or_a: e.home,
            away_or_b: e.away,
            kickoff_utc: new Date(ko).toISOString(),
            collected_at_utc: nowIso,
            available_at_utc: nowIso,
            semantic_level: "RESEARCH",
            data_quality: 0.4,
            fingerprint: event_id,
            status: finished ? "FINISHED" : live ? "LIVE" : "UPCOMING",
            origin: "DISCOVERED_LIVE",
          },
          source: "espn",
          finished,
          live,
          score: null,
          score_source: null,
          discovery_probes: [],
        });
      }
    } catch {
      probes.push({ source: "espn", url, status: 0, parsed: 0 });
    }
  }

  for (const league of THESPORTSDB_LEAGUES.slice(0, 3)) {
    const url = theSportsDbNextUrl(league.id);
    try {
      const { status, text } = await fetchText(url);
      const parsed = status === 200 ? parseTheSportsDbEvents(text) : [];
      probes.push({ source: "thesportsdb", url, status, parsed: parsed.length });
      if (status !== 200) continue;
      for (const e of parsed) {
        if (!e.strHomeTeam || !e.strAwayTeam || !e.dateEvent) continue;
        const time = (e.strTime && e.strTime !== "00:00:00" ? e.strTime : "15:00:00").slice(0, 8);
        const kickoff = `${e.dateEvent}T${time}Z`;
        const ko = Date.parse(kickoff);
        if (!Number.isFinite(ko)) continue;
        const event_id = fp(`tsdb|${e.idEvent ?? `${e.strHomeTeam}|${e.strAwayTeam}|${e.dateEvent}`}`);
        candidates.push({
          event: {
            event_id,
            canonical_event_id: event_id,
            source: "thesportsdb",
            source_event_id: String(e.idEvent ?? event_id),
            sport: "soccer",
            competition: e.strLeague ?? league.label,
            country: null,
            home_or_a: e.strHomeTeam,
            away_or_b: e.strAwayTeam,
            kickoff_utc: new Date(ko).toISOString(),
            collected_at_utc: nowIso,
            available_at_utc: nowIso,
            semantic_level: "RESEARCH",
            data_quality: 0.4,
            fingerprint: event_id,
            status: ko >= nowMs ? "UPCOMING" : "UNKNOWN",
            origin: "DISCOVERED_LIVE",
          },
          source: "thesportsdb",
          finished: false,
          live: false,
          score: null,
          score_source: null,
          discovery_probes: [],
        });
      }
    } catch {
      probes.push({ source: "thesportsdb", url, status: 0, parsed: 0 });
    }
  }

  return { candidates, probes };
}

/** Prefer one upcoming; else a finished match with a real score; else first identified event. */
export function pickGoldenEvent(candidates: DiscoveredCandidate[]): DiscoveredCandidate | null {
  const upcoming = candidates
    .filter((c) => c.event.status === "UPCOMING" && c.event.home_or_a && c.event.away_or_b)
    .sort((a, b) => Date.parse(a.event.kickoff_utc ?? "") - Date.parse(b.event.kickoff_utc ?? ""));
  if (upcoming[0]) return upcoming[0];
  const finished = candidates.filter((c) => c.finished && c.score);
  if (finished[0]) return finished[0];
  const identified = candidates.find((c) => c.event.home_or_a && c.event.away_or_b);
  return identified ?? null;
}

export async function discoverAndPickGoldenEvent(nowMs = Date.now()): Promise<{
  pick: DiscoveredCandidate | null;
  probes: GoldenEventPick["discovery_probes"];
  candidate_count: number;
}> {
  const { candidates, probes } = await discoverGoldenCandidates(nowMs);
  const pick = pickGoldenEvent(candidates);
  if (pick) pick.discovery_probes = probes;
  return { pick, probes, candidate_count: candidates.length };
}
