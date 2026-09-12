/**
 * Real in-play / FT state from free scoreboard adapters (ESPN first).
 * Persist on Lab B filesystem; never invent scores or minutes.
 */
import { getStorage } from "@/domain/storage";
import type { LiveStateMirrorRow } from "@/domain/storage/types";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { ESPN_SCOREBOARDS, espnScoreboardUrl } from "@/domain/eval/acquisition-engine/catalog";
import { parseEspnScoreboard, type EspnEvent } from "@/domain/eval/acquisition-engine/sources/espn";
import { matchEventPair } from "@/domain/eval/data-intelligence/research/identity-match";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { join } from "node:path";

export const GOLDEN_EVENT_ID = "de3b08b74a8249c647ee0e42";

export type LiveMatchTarget = {
  event_id: string;
  home: string;
  away: string;
  kickoff_utc?: string | null;
};

export type ClassifiedLiveStatus = "LIVE" | "HT" | "FT" | "UPCOMING" | "UNKNOWN";

export function classifyEspnLiveStatus(ev: Pick<EspnEvent, "completed" | "statusState" | "statusName">): {
  status: ClassifiedLiveStatus;
  finished: boolean;
} {
  const name = String(ev.statusName ?? "");
  const state = String(ev.statusState ?? "").toLowerCase();
  if (ev.completed === true || state === "post" || /FINAL|FULL.?TIME|STATUS_FINAL/i.test(name)) {
    return { status: "FT", finished: true };
  }
  if (/HALFTIME|STATUS_HALFTIME|\bHT\b/i.test(name)) {
    return { status: "HT", finished: false };
  }
  if (state === "in" || /FIRST_HALF|SECOND_HALF|IN_PROGRESS|STATUS_IN/i.test(name)) {
    return { status: "LIVE", finished: false };
  }
  if (state === "pre" || /SCHEDULED|PRE_?GAME|STATUS_SCHEDULED/i.test(name)) {
    return { status: "UPCOMING", finished: false };
  }
  return { status: "UNKNOWN", finished: false };
}

export function liveStateFromEspn(
  eventId: string,
  ev: EspnEvent,
  nowIso: string,
): LiveStateMirrorRow {
  const { status, finished } = classifyEspnLiveStatus(ev);
  return {
    event_id: eventId,
    published_at: nowIso,
    status,
    home: ev.home ?? null,
    away: ev.away ?? null,
    home_goals: ev.homeScore ?? null,
    away_goals: ev.awayScore ?? null,
    minute: ev.displayClock ?? ev.statusDetail ?? null,
    period: ev.period ?? null,
    source: "espn",
    source_status: ev.statusName ?? ev.statusState ?? null,
    source_detail: ev.statusDetail ?? ev.displayClock ?? null,
    observed_at: nowIso,
    finished,
  };
}

export function overlayLiveOnEvents(
  events: unknown[] | undefined,
  live: LiveStateMirrorRow[] | undefined,
): unknown[] {
  if (!Array.isArray(events)) return [];
  if (!live?.length) return events;
  const by = new Map(live.map((row) => [row.event_id, row]));
  return events.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const rec = raw as Record<string, unknown>;
    const id = String(rec.event_id ?? "");
    const hit = id ? by.get(id) : undefined;
    if (!hit) return rec;
    const result =
      hit.home_goals != null && hit.away_goals != null ? `${hit.home_goals}–${hit.away_goals}` : rec.result;
    return {
      ...rec,
      status: hit.status,
      home_goals: hit.home_goals,
      away_goals: hit.away_goals,
      minute: hit.minute,
      period: hit.period,
      live_source: hit.source,
      result,
      finished: hit.finished,
    };
  });
}

export function matchEspnToTarget(targets: LiveMatchTarget[], ev: EspnEvent): LiveMatchTarget | null {
  if (!ev.home || !ev.away) return null;
  const hits = targets.filter((t) => matchEventPair(t.home, t.away, ev.home!, ev.away!).matched);
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1 && ev.date) {
    const day = ev.date.slice(0, 10);
    const dated = hits.filter((t) => (t.kickoff_utc ?? "").slice(0, 10) === day);
    if (dated.length === 1) return dated[0]!;
  }
  return null;
}

async function fetchEspnBoard(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "betmind-live/1.0 (ordinary GET; no WAF bypass)",
      },
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

export type LiveIngestResult = {
  ok: boolean;
  source: "espn";
  http_status: number | null;
  parsed: number;
  matched: number;
  written: number;
  states: LiveStateMirrorRow[];
  reason: string;
};

export async function ingestLiveStates(opts: {
  targets: LiveMatchTarget[];
  labBRoot?: string;
  nowIso?: string;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  boards?: Array<(typeof ESPN_SCOREBOARDS)[number]>;
}): Promise<LiveIngestResult> {
  const root = opts.labBRoot ?? permanentRoot044();
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const store = getStorage(root);
  const states: LiveStateMirrorRow[] = [];
  let parsed = 0;
  let http: number | null = null;

  const events: EspnEvent[] = [];
  if (opts.jsonText != null) {
    const rows = parseEspnScoreboard(opts.jsonText, "eng.1");
    parsed += rows.length;
    events.push(...rows);
    http = 200;
  } else {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const boards = opts.boards ?? ESPN_SCOREBOARDS.slice(0, 3);
    for (const board of boards) {
      const url = espnScoreboardUrl(board);
      try {
        const got = await fetchEspnBoard(url, fetchImpl);
        http = got.status;
        if (got.status !== 200) continue;
        const rows = parseEspnScoreboard(got.text, board.slug);
        parsed += rows.length;
        events.push(...rows);
      } catch {
        http = http ?? 0;
      }
    }
  }

  for (const ev of events) {
    const target = matchEspnToTarget(opts.targets, ev);
    if (!target) continue;
    const row = liveStateFromEspn(target.event_id, ev, nowIso);
    store.upsertLiveState(row);
    appendJsonl044(join(root, "updates.jsonl"), {
      event_id: row.event_id,
      kind: "live_update",
      at: nowIso,
      source: "espn",
      status: row.status,
      home_goals: row.home_goals,
      away_goals: row.away_goals,
      minute: row.minute,
      note: "live state from ESPN scoreboard; not a replacement prediction",
    });
    states.push(row);
  }

  return {
    ok: parsed > 0,
    source: "espn",
    http_status: http,
    parsed,
    matched: states.length,
    written: states.length,
    states,
    reason:
      parsed === 0
        ? "espn_empty_or_blocked"
        : states.length === 0
          ? "espn_events_unmatched"
          : `espn_live written=${states.length}`,
  };
}

export function collectLocalLiveForRemote(root = permanentRoot044()): LiveStateMirrorRow[] {
  try {
    return getStorage(root).listLiveStates();
  } catch {
    return [];
  }
}

export function findLiveState(
  rows: LiveStateMirrorRow[] | undefined,
  eventId: string,
): LiveStateMirrorRow | null {
  if (!rows?.length || !eventId) return null;
  return rows.find((r) => r.event_id === eventId) ?? null;
}
