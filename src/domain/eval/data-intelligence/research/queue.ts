/**
 * Persistent research queue — process events across cycles, not only the first 8.
 * States: DISCOVERED -> QUEUED -> RESEARCHING -> RESEARCHED
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
  | "INFERENCE";

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

/** Soonest kickoff first; unresearched before already researched. */
export function pickResearchBatch(file: ResearchQueueFile, limit: number, nowMs: number): ResearchQueueItem[] {
  return [...file.items]
    .filter((i) => {
      const ko = i.kickoff_utc ? Date.parse(i.kickoff_utc) : NaN;
      return Number.isFinite(ko) && ko >= nowMs;
    })
    .sort((a, b) => {
      const ra = a.state === "RESEARCHED" || a.state === "INFERENCE" || a.state === "FEATURED" ? 1 : 0;
      const rb = b.state === "RESEARCHED" || b.state === "INFERENCE" || b.state === "FEATURED" ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return Date.parse(a.kickoff_utc ?? "") - Date.parse(b.kickoff_utc ?? "");
    })
    .slice(0, limit);
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
    researched: count("RESEARCHED") + count("FEATURED") + count("INFERENCE"),
    upcoming: upcoming.length,
  };
}
