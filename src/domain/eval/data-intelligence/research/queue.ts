/**
 * Persistent research queue — process events across cycles, not only the first 8.
 * States: DISCOVERED -> QUEUED -> RESEARCHING -> RESEARCHED -> FEATURED -> INFERENCE|PREDICTION|INSUFFICIENT
 * Budget is a governor only — every upcoming event stays on the queue.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

export type ResearchQueueState =
  | "DISCOVERED"
  | "QUEUED"
  | "RESEARCHING"
  | "RESEARCHED"
  | "FEATURED"
  | "INFERENCE"
  | "PREDICTION"
  | "INSUFFICIENT";

export type ResearchQueueItem = {
  event_id: string;
  home: string;
  away: string;
  competition: string;
  kickoff_utc: string | null;
  state: ResearchQueueState;
  last_cycle: number | null;
  last_attempt_at: string | null;
  attempts: number;
};

export type ResearchQueueFile = {
  updated_at: string;
  items: ResearchQueueItem[];
};

export function researchQueuePath(root = permanentRoot044()): string {
  return join(root, "research-queue.json");
}

export function loadResearchQueue(root = permanentRoot044()): ResearchQueueFile {
  const p = researchQueuePath(root);
  if (!existsSync(p)) return { updated_at: new Date(0).toISOString(), items: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as ResearchQueueFile;
  } catch {
    return { updated_at: new Date(0).toISOString(), items: [] };
  }
}

export function saveResearchQueue(file: ResearchQueueFile, root = permanentRoot044()): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(researchQueuePath(root), JSON.stringify(file, null, 2));
}

export function enqueueUpcomingEvents(input: {
  events: PermanentEvent044[];
  nowMs: number;
  nowIso: string;
  root?: string;
}): ResearchQueueFile {
  const root = input.root ?? permanentRoot044();
  const file = loadResearchQueue(root);
  const by = new Map(file.items.map((i) => [i.event_id, i]));
  for (const e of input.events) {
    const ko = e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN;
    if (!Number.isFinite(ko) || ko < input.nowMs) continue;
    const prev = by.get(e.event_id);
    if (prev) {
      prev.home = e.home_or_a;
      prev.away = e.away_or_b;
      prev.competition = String(e.competition ?? "");
      prev.kickoff_utc = e.kickoff_utc;
      if (prev.state === "DISCOVERED") prev.state = "QUEUED";
      continue;
    }
    by.set(e.event_id, {
      event_id: e.event_id,
      home: e.home_or_a,
      away: e.away_or_b,
      competition: String(e.competition ?? ""),
      kickoff_utc: e.kickoff_utc,
      state: "QUEUED",
      last_cycle: null,
      last_attempt_at: null,
      attempts: 0,
    });
  }
  const next: ResearchQueueFile = {
    updated_at: input.nowIso,
    items: [...by.values()],
  };
  saveResearchQueue(next, root);
  return next;
}

export type EventPriority = "P0" | "P1" | "P2" | "P3" | "P4";

export function eventPriority(kickoffIso: string | null, nowMs: number): EventPriority {
  const ko = kickoffIso ? Date.parse(kickoffIso) : NaN;
  if (!Number.isFinite(ko)) return "P3";
  const ms = ko - nowMs;
  if (ms < 0) return "P4";
  if (ms <= 30 * 60 * 1000) return "P0";
  if (ms <= 3 * 60 * 60 * 1000) return "P0";
  if (ms <= 6 * 60 * 60 * 1000) return "P1";
  if (ms <= 24 * 60 * 60 * 1000) return "P2";
  return "P3";
}

const PRIORITY_RANK: Record<EventPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

function isResearched(state: ResearchQueueState): boolean {
  return (
    state === "RESEARCHED" ||
    state === "INFERENCE" ||
    state === "FEATURED" ||
    state === "PREDICTION" ||
    state === "INSUFFICIENT"
  );
}

/** Near kickoff, researched events become stale and may be refreshed. */
export function researchRefreshDue(item: ResearchQueueItem, nowMs: number): boolean {
  if (!isResearched(item.state)) return false;
  const p = eventPriority(item.kickoff_utc, nowMs);
  const last = item.last_attempt_at ? Date.parse(item.last_attempt_at) : 0;
  const age = nowMs - (Number.isFinite(last) ? last : 0);
  const msToKick = (item.kickoff_utc ? Date.parse(item.kickoff_utc) : NaN) - nowMs;
  if (Number.isFinite(msToKick)) {
    if (msToKick <= 15 * 60 * 1000) return age >= 15 * 60 * 1000;
    if (msToKick <= 30 * 60 * 1000) return age >= 15 * 60 * 1000;
    if (msToKick <= 60 * 60 * 1000) return age >= 30 * 60 * 1000;
    if (msToKick <= 3 * 60 * 60 * 1000) return age >= 60 * 60 * 1000;
    if (msToKick <= 6 * 60 * 60 * 1000) return age >= 3 * 60 * 60 * 1000;
    if (msToKick <= 12 * 60 * 60 * 1000) return age >= 6 * 60 * 60 * 1000;
    if (msToKick <= 24 * 60 * 60 * 1000) return age >= 12 * 60 * 60 * 1000;
    if (msToKick <= 48 * 60 * 60 * 1000) return age >= 24 * 60 * 60 * 1000;
  }
  if (p === "P0") return age >= 15 * 60 * 1000;
  if (p === "P1") return age >= 60 * 60 * 1000;
  if (p === "P2") return age >= 6 * 60 * 60 * 1000;
  if (p === "P3") return age >= 24 * 60 * 60 * 1000;
  return false;
}

/** Unresearched first (half of budget reserved), then stale near-kickoff refresh. Priority P0–P3. */
export function pickResearchBatch(file: ResearchQueueFile, limit: number, nowMs: number): ResearchQueueItem[] {
  const upcoming = [...file.items].filter((i) => {
    const ko = i.kickoff_utc ? Date.parse(i.kickoff_utc) : NaN;
    return Number.isFinite(ko) && ko >= nowMs;
  });
  const byPri = (a: ResearchQueueItem, b: ResearchQueueItem) => {
    const pa = PRIORITY_RANK[eventPriority(a.kickoff_utc, nowMs)];
    const pb = PRIORITY_RANK[eventPriority(b.kickoff_utc, nowMs)];
    if (pa !== pb) return pa - pb;
    return Date.parse(a.kickoff_utc ?? "") - Date.parse(b.kickoff_utc ?? "");
  };
  const unresearched = upcoming.filter((i) => !isResearched(i.state)).sort(byPri);
  const refresh = upcoming.filter((i) => researchRefreshDue(i, nowMs)).sort(byPri);
  const reserved = Math.max(1, Math.ceil(limit * 0.5));
  const first = unresearched.slice(0, reserved);
  const rest = limit - first.length;
  const second = refresh.filter((i) => !first.some((f) => f.event_id === i.event_id)).slice(0, rest);
  const leftover = unresearched.slice(first.length);
  const seen = new Set<string>();
  const out: ResearchQueueItem[] = [];
  for (const i of [...first, ...second, ...leftover]) {
    if (seen.has(i.event_id)) continue;
    seen.add(i.event_id);
    out.push(i);
    if (out.length >= limit) break;
  }
  return out;
}

export function markQueueStates(
  file: ResearchQueueFile,
  eventIds: string[],
  state: ResearchQueueState,
  cycle: number | null,
  nowIso: string,
  root = permanentRoot044(),
): ResearchQueueFile {
  const set = new Set(eventIds);
  for (const i of file.items) {
    if (!set.has(i.event_id)) continue;
    i.state = state;
    i.last_cycle = cycle;
    i.last_attempt_at = nowIso;
    i.attempts += 1;
  }
  file.updated_at = nowIso;
  saveResearchQueue(file, root);
  return file;
}

export function queueCounts(file: ResearchQueueFile, nowMs: number): {
  discovered: number;
  queued: number;
  researching: number;
  researched: number;
  upcoming: number;
} {
  const upcoming = file.items.filter((i) => {
    const ko = i.kickoff_utc ? Date.parse(i.kickoff_utc) : NaN;
    return Number.isFinite(ko) && ko >= nowMs;
  });
  const count = (s: ResearchQueueState) => upcoming.filter((i) => i.state === s).length;
  return {
    discovered: count("DISCOVERED"),
    queued: count("QUEUED"),
    researching: count("RESEARCHING"),
    researched:
      count("RESEARCHED") +
      count("FEATURED") +
      count("INFERENCE") +
      count("PREDICTION") +
      count("INSUFFICIENT"),
    upcoming: upcoming.length,
  };
}
