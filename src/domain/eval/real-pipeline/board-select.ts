/**
 * Select eligible board / next_events / Lab B events for analyze:board.
 * Does not invent identities, scores, or probabilities.
 */
import { unwrapEventLike } from "@/domain/eval/betmind-runtime/analyzed-board";
import { readRemoteMirror, type RemoteMirrorArtifact } from "@/domain/eval/betmind-runtime/remote-mirror";
import { getStorage } from "@/domain/storage";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { DiscoveredCandidate } from "@/domain/eval/betmind-runtime/golden-e2e/discover";

export const RECENT_KICKOFF_MS = 3 * 60 * 60 * 1000;

export type BoardCandidateOrigin =
  | "remote_board"
  | "remote_next"
  | "local_board"
  | "local_store"
  | "discovery";

export type BoardCandidate = {
  event_id: string;
  home: string;
  away: string;
  competition: string | null;
  kickoff_utc: string | null;
  sport: string;
  status: string;
  origin: BoardCandidateOrigin;
  finished: boolean;
  live: boolean;
};

export type SelectBoardEventsOptions = {
  nowMs?: number;
  includeFinished?: boolean;
  recentKickoffMs?: number;
};

const ORIGIN_RANK: Record<BoardCandidateOrigin, number> = {
  remote_board: 0,
  remote_next: 1,
  local_board: 2,
  local_store: 3,
  discovery: 4,
};

const FINISHED_RE = /^(ft|finished|final|settled|ended)$|full.?time|status_final|settled/i;
const LIVE_RE = /live|in_play|playing|\bht\b|halftime|first_half|second_half|in_progress/i;

export function isFinishedSettledStatus(status: string | null | undefined, finishedFlag?: boolean): boolean {
  if (finishedFlag === true) return true;
  return FINISHED_RE.test(String(status ?? ""));
}

export function isLiveOrHtStatus(status: string | null | undefined, liveFlag?: boolean): boolean {
  if (liveFlag === true) return true;
  return LIVE_RE.test(String(status ?? ""));
}

export function candidateFromRecord(
  raw: unknown,
  origin: BoardCandidateOrigin,
): BoardCandidate | null {
  const ev = unwrapEventLike(raw);
  if (!ev) return null;
  const event_id = String(ev.event_id ?? "");
  const home = String(ev.home_or_a ?? ev.home ?? "");
  const away = String(ev.away_or_b ?? ev.away ?? "");
  if (!event_id || !home || !away) return null;
  const status = String(ev.status ?? "UPCOMING");
  const finished = isFinishedSettledStatus(status, ev.finished === true);
  const live = isLiveOrHtStatus(status);
  return {
    event_id,
    home,
    away,
    competition: ev.competition != null ? String(ev.competition) : null,
    kickoff_utc: ev.kickoff_utc != null ? String(ev.kickoff_utc) : null,
    sport: String(ev.sport ?? "soccer"),
    status,
    origin,
    finished,
    live,
  };
}

export function candidateFromPermanent(
  ev: PermanentEvent044,
  origin: BoardCandidateOrigin,
): BoardCandidate | null {
  if (!ev.event_id || !ev.home_or_a || !ev.away_or_b) return null;
  const status = String(ev.status ?? "UPCOMING");
  return {
    event_id: ev.event_id,
    home: ev.home_or_a,
    away: ev.away_or_b,
    competition: ev.competition || null,
    kickoff_utc: ev.kickoff_utc,
    sport: ev.sport || "soccer",
    status,
    origin,
    finished: isFinishedSettledStatus(status),
    live: isLiveOrHtStatus(status),
  };
}

export function candidateFromDiscovery(row: DiscoveredCandidate): BoardCandidate | null {
  const c = candidateFromPermanent(row.event, "discovery");
  if (!c) return null;
  return {
    ...c,
    finished: row.finished || c.finished,
    live: row.live || c.live,
    status: row.finished ? "FINISHED" : row.live ? "LIVE" : c.status,
  };
}

export function isEligibleBoardEvent(
  c: BoardCandidate,
  opts: SelectBoardEventsOptions = {},
): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const recentMs = opts.recentKickoffMs ?? RECENT_KICKOFF_MS;
  if (!c.event_id || !c.home || !c.away) return false;
  if (c.finished && !opts.includeFinished) return false;
  if (isLiveOrHtStatus(c.status, c.live)) return true;
  const ko = Date.parse(c.kickoff_utc ?? "");
  if (Number.isFinite(ko)) {
    if (ko > nowMs) return true;
    return nowMs - ko <= recentMs;
  }
  return !c.finished;
}

export function mergeBoardCandidates(rows: BoardCandidate[]): BoardCandidate[] {
  const by = new Map<string, BoardCandidate>();
  for (const row of rows) {
    const prev = by.get(row.event_id);
    if (!prev || ORIGIN_RANK[row.origin] < ORIGIN_RANK[prev.origin]) {
      by.set(row.event_id, row);
    }
  }
  return [...by.values()];
}

export function selectEligibleBoardEvents(
  candidates: BoardCandidate[],
  opts: SelectBoardEventsOptions = {},
): { selected: BoardCandidate[]; skipped_finished: number } {
  let skipped_finished = 0;
  const selected: BoardCandidate[] = [];
  for (const c of candidates) {
    if (c.finished && !opts.includeFinished) {
      skipped_finished += 1;
      continue;
    }
    if (isEligibleBoardEvent(c, opts)) selected.push(c);
  }
  selected.sort((a, b) => {
    const ka = Date.parse(a.kickoff_utc ?? "") || Number.MAX_SAFE_INTEGER;
    const kb = Date.parse(b.kickoff_utc ?? "") || Number.MAX_SAFE_INTEGER;
    if (ka !== kb) return ka - kb;
    return a.event_id.localeCompare(b.event_id);
  });
  return { selected, skipped_finished };
}

export function collectCandidatesFromRemote(remote: RemoteMirrorArtifact | null): BoardCandidate[] {
  if (!remote) return [];
  const out: BoardCandidate[] = [];
  for (const row of remote.board_events ?? []) {
    const c = candidateFromRecord(row, "remote_board");
    if (c) out.push(c);
  }
  const next = remote.payload?.observatory?.next_events;
  if (Array.isArray(next)) {
    for (const row of next) {
      const c = candidateFromRecord(row, "remote_next");
      if (c) out.push(c);
    }
  }
  return out;
}

export function collectCandidatesFromLocal(root: string): BoardCandidate[] {
  const out: BoardCandidate[] = [];
  try {
    for (const row of getStorage(root).loadBoardEvents()) {
      const c = candidateFromRecord(row, "local_board");
      if (c) out.push(c);
    }
  } catch {
    /* optional */
  }
  try {
    for (const ev of loadStore044(root).events) {
      const c = candidateFromPermanent(ev, "local_store");
      if (c) out.push(c);
    }
  } catch {
    /* optional */
  }
  return out;
}

export async function loadBoardCandidates(opts: {
  labBRoot: string;
  remote?: RemoteMirrorArtifact | null;
  discovery?: DiscoveredCandidate[];
}): Promise<BoardCandidate[]> {
  const remote = opts.remote === undefined ? await readRemoteMirror() : opts.remote;
  const rows = [
    ...collectCandidatesFromRemote(remote),
    ...collectCandidatesFromLocal(opts.labBRoot),
    ...(opts.discovery ?? []).map(candidateFromDiscovery).filter((c): c is BoardCandidate => Boolean(c)),
  ];
  return mergeBoardCandidates(rows);
}

export function candidateToPermanentEvent(c: BoardCandidate, nowIso: string): PermanentEvent044 {
  return {
    event_id: c.event_id,
    canonical_event_id: c.event_id,
    source: c.origin === "discovery" ? "discovery" : "board",
    source_event_id: c.event_id,
    sport: c.sport || "soccer",
    competition: c.competition ?? "",
    country: null,
    home_or_a: c.home,
    away_or_b: c.away,
    kickoff_utc: c.kickoff_utc,
    collected_at_utc: nowIso,
    available_at_utc: nowIso,
    semantic_level: "RESEARCH",
    data_quality: 0.4,
    fingerprint: c.event_id,
    status: c.live ? "LIVE" : c.finished ? "FINISHED" : "UPCOMING",
    origin: "DISCOVERED_LIVE",
  };
}
