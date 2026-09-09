import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { LIVE_SOCCER_SPORTS_039 } from "@/domain/eval/live-039/sources";
import type { Store039 } from "@/domain/eval/live-039/store";
import { loadGovernorConfig042, type GovernorConfig042 } from "@/domain/eval/collector-042/config";
import type { CyclePlan042 } from "@/domain/eval/collector-042/types";

export function sportsNeedingScores042(store: Store039, nowMs = Date.now()): string[] {
  const settled = new Set(
    store.settlements.filter((s) => s.outcome !== "UNSETTLED").map((s) => s.event_id),
  );
  const needed = new Set<string>();
  for (const ev of store.events) {
    if (settled.has(ev.event_id)) continue;
    if (!ev.commence_time) continue;
    const kick = parseExactUtcMs(ev.commence_time);
    if (kick == null || kick > nowMs) continue;
    // only score sports for locked events (protocol: reveal after lock preferred)
    if (!store.decisions.some((d) => d.event_id === ev.event_id)) continue;
    needed.add(ev.sport_key);
  }
  return [...needed].filter((s) => (LIVE_SOCCER_SPORTS_039 as readonly string[]).includes(s));
}

export function planCycle042(input: {
  store: Store039;
  lastDiscoveryAt: string | null;
  forceDiscovery?: boolean;
  nowMs?: number;
  cfg?: GovernorConfig042;
}): CyclePlan042 {
  const cfg = input.cfg ?? loadGovernorConfig042();
  const nowMs = input.nowMs ?? Date.now();
  const scoreSports = sportsNeedingScores042(input.store, nowMs);
  const discoveryDue =
    input.forceDiscovery === true ||
    !input.lastDiscoveryAt ||
    nowMs - Date.parse(input.lastDiscoveryAt) >= cfg.discoveryHours * 3600_000;

  // Prefer settlement when locked cohort exists; discovery is optional/rare.
  const locked = input.store.decisions.length;
  const settled = input.store.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  const allLockedSettled = locked > 0 && settled >= locked;

  let runDiscovery = false;
  const runScores = scoreSports.length > 0;
  let reason = "";

  if (settled >= cfg.settledTarget) {
    return {
      runDiscovery: false,
      runScores: false,
      scoreSports: [],
      estimatedCredits: 0,
      reason: "settled target reached",
    };
  }

  if (runScores) {
    reason = `scores for ${scoreSports.length} sport(s) with past-kickoff unsettled locked events`;
  }

  if (discoveryDue && !allLockedSettled && locked < 500) {
    // Rare catalog refresh to discover new events if needed later; skip when settling is the bottleneck
    // and we already have enough locked events to reach 100 settlements.
    if (locked < cfg.settledTarget || input.forceDiscovery) {
      runDiscovery = true;
      reason = reason ? `${reason}; + discovery` : "scheduled discovery odds pull";
    }
  }

  if (!runDiscovery && !runScores) {
    reason = "idle — no past-kickoff unsettled locks; discovery not due";
  }

  const est =
    (runDiscovery ? LIVE_SOCCER_SPORTS_039.length * cfg.estimatedOddsCreditsPerSport : 0) +
    scoreSports.length * cfg.estimatedScoresCreditsPerSport;

  return {
    runDiscovery,
    runScores,
    scoreSports,
    estimatedCredits: est,
    reason,
  };
}
