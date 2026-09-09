import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { resolveDisplayedStatus042 } from "@/domain/eval/collector-042/heartbeat";
import { isLockHeldByAliveProcess042 } from "@/domain/eval/collector-042/lock";
import { labAStore044, permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, loadModelRegistry044 } from "@/domain/eval/permanent-044/store";
import { buildDailyFactory045 } from "@/domain/eval/factory-045/daily";
import { loadDiscoveryState045 } from "@/domain/eval/factory-045/config";
import { resolveDaemonHealth046 } from "@/domain/eval/control-046/daemon";
import {
  buildFeed046,
  buildIntelligence046,
  buildNextEvents046,
  buildPipeline046,
  buildRanking046,
} from "@/domain/eval/control-046/dashboard";

/** Pure disk/read-only dashboard. NEVER calls The Odds API. */
export function buildControlCenter046(nowIso = new Date().toISOString()) {
  const root = permanentRoot044();
  const labA = labAStore044();
  const nowMs = Date.parse(nowIso);
  const store = loadStore044(root);
  const daily = buildDailyFactory045(store, nowIso.slice(0, 10));
  const daemon = resolveDaemonHealth046(root, nowMs);
  const credit = loadCreditState042(labA);
  const cfg = loadGovernorConfig042();
  const rem = remainingCredits042(credit);
  const dstate = loadDiscoveryState045(root);
  const reg = loadModelRegistry044(root);
  const { status: labAStatus } = resolveDisplayedStatus042(labA);

  const used = credit.observedUsed ?? credit.estimatedUsed ?? 0;
  const limit = credit.monthlyLimit || cfg.monthlyCreditLimit;
  const budgetPct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;

  return {
    server_time: nowIso,
    api_calls_ui: 0 as const,
    credits_used_for_ui: 0 as const,
    catalog_cap: false as const,
    seed_note: "114 LAB A SEED — NOT A CATALOG CAP",
    daemon,
    mode: daemon.mode,
    budget: {
      credits_remaining: rem,
      credits_used: used,
      monthly_limit: limit,
      safe_reserve: credit.safeRemaining ?? cfg.safeRemaining,
      api_calls_today: dstate.api_calls_today,
      last_api_call: dstate.last_discovery_at,
      last_discovery_at: dstate.last_discovery_at,
      budget_used_pct: budgetPct,
      source_of_truth: credit.sourceOfTruth,
    },
    counters: {
      TOTAL_EVENTS: daily.TOTAL_EVENTS,
      SEED_EVENTS: daily.SEED_EVENTS,
      DISCOVERED_LIVE: daily.DISCOVERED_LIVE_EVENTS,
      SOCCER: daily.SOCCER_EVENTS,
      TENNIS: daily.TENNIS_EVENTS,
      OTHER: daily.OTHER_EVENTS,
      PREDICTIONS: daily.TOTAL_PREDICTIONS,
      LOCKS: daily.TOTAL_LOCKS,
      SETTLEMENTS: daily.TOTAL_SETTLEMENTS,
      AUTOPSIES: daily.TOTAL_AUTOPSIES,
      LEARNING_CASES: daily.TOTAL_LEARNING_CASES,
      TODAY: {
        DISCOVERED: daily.TODAY_DISCOVERED,
        ANALYZED: daily.TODAY_ANALYZED,
        PREDICTED: daily.TODAY_PREDICTED,
        LOCKED: daily.TODAY_LOCKED,
        SETTLED: daily.TODAY_SETTLED,
        AUTOPSIED: daily.TODAY_AUTOPSIED,
        LEARNING_CASES: daily.TODAY_LEARNING_CASES,
      },
    },
    pipeline: buildPipeline046(store, nowMs),
    feed: buildFeed046(store, 50),
    next_events: buildNextEvents046(store, nowMs, 50),
    ranking: buildRanking046(store),
    intelligence: buildIntelligence046(store),
    model: {
      version: reg.current_version,
      status: "OBSERVATION_ONLY" as const,
      edge: "UNKNOWN" as const,
      auto_promotion: false as const,
    },
    capital: {
      CAPITAL: "CLOSED" as const,
      REAL_MONEY: false as const,
      AUTO_PROMOTION: false as const,
    },
    lab_a: {
      collector: labAStatus,
      lock_alive: isLockHeldByAliveProcess042(labA),
      read_only: true as const,
    },
    sports_unavailable: dstate.sports_unavailable,
    last_error: daemon.last_error,
  };
}

export type ControlCenter046 = ReturnType<typeof buildControlCenter046>;
