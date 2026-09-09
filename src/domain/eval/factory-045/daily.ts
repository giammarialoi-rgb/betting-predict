import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Store044 } from "@/domain/eval/permanent-044/store";

export type DailyFactory045 = {
  date: string;
  TODAY_DISCOVERED: number;
  TODAY_ANALYZED: number;
  TODAY_PREDICTED: number;
  TODAY_LOCKED: number;
  TODAY_POST_LOCK_SNAPSHOTS: number;
  TODAY_SETTLED: number;
  TODAY_AUTOPSIED: number;
  TODAY_LEARNING_CASES: number;
  TOTAL_EVENTS: number;
  TOTAL_PREDICTIONS: number;
  TOTAL_LOCKS: number;
  TOTAL_SETTLEMENTS: number;
  TOTAL_AUTOPSIES: number;
  TOTAL_LEARNING_CASES: number;
  SEED_EVENTS: number;
  DISCOVERED_LIVE_EVENTS: number;
  SOCCER_EVENTS: number;
  TENNIS_EVENTS: number;
  OTHER_EVENTS: number;
};

export function buildDailyFactory045(store: Store044, date: string): DailyFactory045 {
  const day = (iso: string | undefined) => (iso ?? "").startsWith(date);
  const learningPath = join(store.root, "learning-cases.jsonl");
  const learningN = existsSync(learningPath)
    ? readFileSync(learningPath, "utf8").split(/\n/).filter(Boolean).length
    : 0;

  return {
    date,
    TODAY_DISCOVERED: store.events.filter((e) => day(e.first_seen_at ?? e.collected_at_utc) && e.origin === "DISCOVERED_LIVE")
      .length,
    TODAY_ANALYZED: new Set(store.predictions.filter((p) => day(p.timestamp)).map((p) => p.event_id)).size,
    TODAY_PREDICTED: store.predictions.filter((p) => day(p.timestamp)).length,
    TODAY_LOCKED: store.locks.filter((l) => day(l.lock_timestamp)).length,
    TODAY_POST_LOCK_SNAPSHOTS: 0,
    TODAY_SETTLED: store.settlements.filter((s) => day(s.settled_at)).length,
    TODAY_AUTOPSIED: store.autopsies.filter((a) => day(a.created_at)).length,
    TODAY_LEARNING_CASES: 0,
    TOTAL_EVENTS: store.events.length,
    TOTAL_PREDICTIONS: store.predictions.length,
    TOTAL_LOCKS: store.locks.length,
    TOTAL_SETTLEMENTS: store.settlements.length,
    TOTAL_AUTOPSIES: store.autopsies.length,
    TOTAL_LEARNING_CASES: learningN,
    SEED_EVENTS: store.events.filter((e) => e.origin === "LAB_A_SEED" || e.origin == null).length,
    DISCOVERED_LIVE_EVENTS: store.events.filter((e) => e.origin === "DISCOVERED_LIVE").length,
    SOCCER_EVENTS: store.events.filter((e) => e.sport === "soccer").length,
    TENNIS_EVENTS: store.events.filter((e) => e.sport === "tennis").length,
    OTHER_EVENTS: store.events.filter((e) => e.sport !== "soccer" && e.sport !== "tennis").length,
  };
}

export function writeDailyFactory045(store: Store044, date: string): DailyFactory045 {
  const d = buildDailyFactory045(store, date);
  const dir = join(store.root, "daily-reports");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${date}.json`), JSON.stringify(d, null, 2));
  return d;
}
