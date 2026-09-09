import type { Store044 } from "@/domain/eval/permanent-044/store";
import type { SchedulerPriority051 } from "@/domain/eval/brain-051/config";

export type SchedulePlan051 = {
  priority: SchedulerPriority051;
  discover: boolean;
  settle: boolean;
  analyze: boolean;
  multi_market: boolean;
  decision_engine: boolean;
  sleep_ms: number;
  reason: string;
  imminent_count: number;
  pending_settle: number;
};

/** Adaptive priority planner — no synthetic events. */
export function planCycle051(store: Store044, nowMs = Date.now()): SchedulePlan051 {
  const day = 24 * 3600_000;
  const pending_settle = store.events.filter((e) => {
    if (!e.kickoff_utc) return false;
    const k = Date.parse(e.kickoff_utc);
    if (!Number.isFinite(k) || k > nowMs) return false;
    return !store.settlements.some((s) => s.event_id === e.event_id && s.outcome !== "UNSETTLED");
  }).length;

  if (pending_settle > 0) {
    return {
      priority: "P0",
      discover: false,
      settle: true,
      analyze: true,
      multi_market: false,
      decision_engine: true,
      sleep_ms: 60_000,
      reason: `settlement_backlog=${pending_settle}`,
      imminent_count: 0,
      pending_settle,
    };
  }

  const imminent = store.events.filter((e) => {
    if (!e.kickoff_utc) return false;
    const k = Date.parse(e.kickoff_utc);
    return Number.isFinite(k) && k >= nowMs && k < nowMs + 2 * 3600_000;
  }).length;

  const next24 = store.events.filter((e) => {
    if (!e.kickoff_utc) return false;
    const k = Date.parse(e.kickoff_utc);
    return Number.isFinite(k) && k >= nowMs && k < nowMs + day;
  }).length;

  const unlockedNear = store.events.filter((e) => {
    if (!e.kickoff_utc || store.lockEventIds.has(e.event_id)) return false;
    const k = Date.parse(e.kickoff_utc);
    return Number.isFinite(k) && k >= nowMs && k - nowMs <= 90 * 60_000;
  }).length;

  if (unlockedNear > 0 || imminent > 0) {
    return {
      priority: "P5",
      discover: false,
      settle: true,
      analyze: true,
      multi_market: true,
      decision_engine: true,
      sleep_ms: 90_000,
      reason: `pre_lock_refresh imminent=${imminent} unlocked_near=${unlockedNear}`,
      imminent_count: imminent,
      pending_settle: 0,
    };
  }

  if (next24 > 0) {
    return {
      priority: "P1",
      discover: true,
      settle: true,
      analyze: true,
      multi_market: true,
      decision_engine: true,
      sleep_ms: 5 * 60_000,
      reason: `next_24h=${next24}`,
      imminent_count: imminent,
      pending_settle: 0,
    };
  }

  const next72 = store.events.filter((e) => {
    if (!e.kickoff_utc) return false;
    const k = Date.parse(e.kickoff_utc);
    return Number.isFinite(k) && k >= nowMs && k < nowMs + 3 * day;
  }).length;

  if (next72 > 0) {
    return {
      priority: "P2",
      discover: true,
      settle: true,
      analyze: true,
      multi_market: false,
      decision_engine: true,
      sleep_ms: 10 * 60_000,
      reason: `next_72h=${next72}`,
      imminent_count: 0,
      pending_settle: 0,
    };
  }

  return {
    priority: "P4",
    discover: true,
    settle: true,
    analyze: true,
    multi_market: false,
    decision_engine: true,
    sleep_ms: 15 * 60_000,
    reason: "discovery_and_idle_scan",
    imminent_count: 0,
    pending_settle: 0,
  };
}

export function idlePlan051(): SchedulePlan051 {
  return {
    priority: "IDLE",
    discover: false,
    settle: false,
    analyze: false,
    multi_market: false,
    decision_engine: false,
    sleep_ms: 5 * 60_000,
    reason: "idle",
    imminent_count: 0,
    pending_settle: 0,
  };
}
