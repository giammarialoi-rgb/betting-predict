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

/** Parse a published score string such as `0-1` or `0–1`. Never invents digits. */
export function parsePublishedScorePair(raw: unknown): { home: number; away: number } | null {
  if (raw == null) return null;
  if (typeof raw === "object") {
    const rec = raw as { home?: unknown; away?: unknown; home_goals?: unknown; away_goals?: unknown };
    const home = typeof rec.home === "number" ? rec.home : typeof rec.home_goals === "number" ? rec.home_goals : null;
    const away = typeof rec.away === "number" ? rec.away : typeof rec.away_goals === "number" ? rec.away_goals : null;
    if (home != null && away != null && Number.isInteger(home) && Number.isInteger(away)) {
      return { home, away };
    }
  }
  const m = String(raw)
    .trim()
    .match(/^(\d+)\s*[-–:]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

function clockLike(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 24) return null;
  return /\d/.test(s) && /['m]|HT|FT|1H|2H/i.test(s) ? s : null;
}

export function normalizeLiveBoardFields(raw: Record<string, unknown>): Record<string, unknown> {
  const score = parsePublishedScorePair(raw.score ?? raw.result);
  const home_goals =
    typeof raw.home_goals === "number" ? raw.home_goals : (score?.home ?? null);
  const away_goals =
    typeof raw.away_goals === "number" ? raw.away_goals : (score?.away ?? null);
  const result =
    raw.result ??
    (home_goals != null && away_goals != null ? `${home_goals}–${away_goals}` : raw.score ?? null);
  const minute = raw.minute ?? clockLike(raw.note) ?? clockLike(raw.source_detail) ?? null;
  return {
    ...raw,
    home_goals,
    away_goals,
    minute,
    result,
    score: raw.score ?? result,
  };
}

export function liveRowFromUnknown(raw: unknown): LiveStateMirrorRow | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const event_id = String(rec.event_id ?? "");
  if (!event_id) return null;
  const score = parsePublishedScorePair(rec.score ?? rec.result);
  const home_goals =
    typeof rec.home_goals === "number" ? rec.home_goals : (score?.home ?? null);
  const away_goals =
    typeof rec.away_goals === "number" ? rec.away_goals : (score?.away ?? null);
  const status = String(rec.status ?? rec.source_status ?? "UNKNOWN");
  const finished =
    rec.finished === true ||
    /^(FT|FINAL|FINISHED|ENDED)$/i.test(status) ||
    rec.completed === true;
  const published_at = String(rec.published_at ?? rec.observed_at ?? rec.at ?? "");
  return {
    event_id,
    published_at,
    status,
    home: typeof rec.home === "string" ? rec.home : typeof rec.home_or_a === "string" ? rec.home_or_a : null,
    away: typeof rec.away === "string" ? rec.away : typeof rec.away_or_b === "string" ? rec.away_or_b : null,
    home_goals,
    away_goals,
    minute: (typeof rec.minute === "string" ? rec.minute : null) ?? clockLike(rec.note) ?? clockLike(rec.source_detail),
    period: typeof rec.period === "number" ? rec.period : null,
    source: String(rec.source ?? "espn"),
    source_status: typeof rec.source_status === "string" ? rec.source_status : null,
    source_detail: typeof rec.source_detail === "string" ? rec.source_detail : clockLike(rec.note),
    observed_at: String(rec.observed_at ?? rec.published_at ?? rec.at ?? published_at),
    finished,
  };
}

export function collectLiveRows(...lists: unknown[]): LiveStateMirrorRow[] {
  const by = new Map<string, LiveStateMirrorRow>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const row = liveRowFromUnknown(raw);
      if (!row) continue;
      const prev = by.get(row.event_id);
      if (!prev || String(row.published_at ?? "") >= String(prev.published_at ?? "")) {
        by.set(row.event_id, row);
      }
    }
  }
  return [...by.values()];
}

export function latestLiveTimestamp(rows: LiveStateMirrorRow[] | undefined): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows ?? []) {
    for (const raw of [row.observed_at, row.published_at]) {
      const ms = Date.parse(String(raw ?? ""));
      if (Number.isFinite(ms) && ms > latestMs) {
        latestMs = ms;
        latest = String(raw);
      }
    }
  }
  return latest;
}

export function overlayLiveOnEvents(
  events: unknown[] | undefined,
  live: LiveStateMirrorRow[] | undefined,
): unknown[] {
  if (!Array.isArray(events)) return [];
  const by = new Map((live ?? []).map((row) => [row.event_id, row]));
  return events.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const rec = normalizeLiveBoardFields(raw as Record<string, unknown>);
    const id = String(rec.event_id ?? "");
    const hit = id ? by.get(id) : undefined;
    if (!hit) return rec;
    const result =
      hit.home_goals != null && hit.away_goals != null
        ? `${hit.home_goals}–${hit.away_goals}`
        : rec.result;
    return {
      ...rec,
      status: hit.status,
      home_goals: hit.home_goals ?? rec.home_goals,
      away_goals: hit.away_goals ?? rec.away_goals,
      minute: hit.minute ?? rec.minute,
      period: hit.period ?? rec.period,
      live_source: hit.source,
      result,
      score: rec.score ?? result,
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
