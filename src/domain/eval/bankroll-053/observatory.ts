import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildObservatory051 } from "@/domain/eval/brain-051/observatory";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { computeMassiveStats049 } from "@/domain/eval/factory-049/stats";
import { MODEL_ACTIVE_053 } from "@/domain/eval/bankroll-053/config";
import { summarizeBankroll053, simulateGoal053 } from "@/domain/eval/bankroll-053/ledger";
import { buildSportDiagnostics053 } from "@/domain/eval/bankroll-053/sports-registry";
import { ODDS_API_ADAPTER_NAME_053 } from "@/domain/eval/bankroll-053/source-adapter";
import {
  buildSportAdapters053,
  mapDiagToAdapterStatus053,
} from "@/domain/eval/bankroll-053/sport-adapter";
import { writeSourceHealth053, loadSourceHealth053 } from "@/domain/eval/bankroll-053/source-health";
import { loadChallengerRegistry053, writeChallengerRegistry053 } from "@/domain/eval/bankroll-053/challenger";
import {
  buildSystemStatus053,
  loadCurrentWork053,
  writeCurrentWork053,
} from "@/domain/eval/bankroll-053/system";

function countJsonl(path: string): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split(/\n/).filter(Boolean).length;
}

/** Disk-only observatory extension — zero Odds API. */
export function buildObservatory053(nowIso = new Date().toISOString()) {
  const base = buildObservatory051(nowIso);
  const root = permanentRoot044();
  const store = loadStore044(root);
  const stats = computeMassiveStats049(store, nowIso);
  const bankroll = summarizeBankroll053(root);
  const uniqueEvents = new Set(store.events.map((e) => e.event_id)).size;
  const sportDiag = buildSportDiagnostics053(nowIso);
  const bookmakers = new Set(store.quotes.map((q) => q.bookmaker));
  const markets = new Set(store.quotes.map((q) => q.market));

  const familyStatus: Record<string, ReturnType<typeof mapDiagToAdapterStatus053>> = {};
  const notes: Record<string, string | null> = {};
  for (const s of sportDiag.sports) {
    familyStatus[s.sport.toLowerCase()] = mapDiagToAdapterStatus053(s.status);
    notes[s.sport.toLowerCase()] = s.note;
  }
  const sportAdapters = buildSportAdapters053({ familyStatus, notes });

  writeSourceHealth053({
    root,
    oddsEvents: uniqueEvents,
    oddsMarkets: markets.size,
    oddsAvailability: uniqueEvents > 0 ? "AVAILABLE" : "EMPTY_WINDOW",
    nowIso,
  });
  writeChallengerRegistry053(root);
  if (!loadCurrentWork053(root)) {
    writeCurrentWork053({
      sport: null,
      event: null,
      market: null,
      phase: "IDLE",
      started_at: null,
      last_update: nowIso,
      note: "awaiting brain cycle",
    });
  }

  const system = buildSystemStatus053(root);
  const current_work = loadCurrentWork053(root);
  const source_health = loadSourceHealth053(root);
  const challengers = loadChallengerRegistry053(root);

  return {
    ...base,
    system_053: system,
    current_work_053: current_work,
    source_health_053: source_health,
    sport_adapters_053: sportAdapters.map((a) => ({
      sport: a.sport,
      provider: a.provider,
      availability: a.availability,
      status: a.status,
      supportedMarkets: a.supportedMarkets,
      costEstimate: a.costEstimate,
      rateLimit: a.rateLimit,
    })),
    challengers_053: challengers,
    bankroll_053: {
      ...bankroll,
      paper_bankroll_initial: 1000 as const,
      paper_capital: "PAPER_ONLY" as const,
      goal_simulator: simulateGoal053({
        start: bankroll.initial,
        goal: 3000,
        horizon_days: 7,
        settled_bets: bankroll.strategies.FLAT.bets,
        avg_edge: null,
        win_rate:
          bankroll.strategies.FLAT.bets > 0
            ? bankroll.strategies.FLAT.wins / bankroll.strategies.FLAT.bets
            : null,
      }),
      live_pulse: {
        discovery: base.brain_051.last_priority === "P4" || base.brain_051.last_priority === "P1",
        analysis: (base.brain_051.counters.PREDICTIONS ?? 0) > 0,
        lock: (base.brain_051.counters.LOCKED ?? 0) > 0,
        settlement: (base.brain_051.counters.SETTLED ?? 0) > 0,
        autopsy: (base.brain_051.counters.AUTOPSIED ?? 0) > 0,
        learning: (base.brain_051.counters.LEARNING_CASES ?? 0) > 0,
        last_activity_at: base.brain_051.last_successful_cycle_at ?? base.brain_051.last_cycle_at,
      },
    },
    massive_053: {
      title: "UNIVERSAL MASSIVE LIVE",
      artificial_cap: false as const,
      unique_events: uniqueEvents,
      raw_event_lines: store.events.length,
      stats,
      sport_diagnostics: sportDiag.sports,
      bookmakers_observed: [...bookmakers].sort(),
      bookmaker_count: bookmakers.size,
      counterfactuals: countJsonl(join(root, "counterfactuals.jsonl")),
      error_patterns: existsSync(join(root, "error-patterns.json"))
        ? ((JSON.parse(readFileSync(join(root, "error-patterns.json"), "utf8")) as { patterns?: unknown[] })
            .patterns?.length ?? 0)
        : countJsonl(join(root, "error-patterns.jsonl")),
      model_version: MODEL_ACTIVE_053,
      model_status: "OBSERVATION_ONLY" as const,
      model_edge: "UNKNOWN" as const,
      model_ready: "PARTIAL" as const,
      source_adapter: ODDS_API_ADAPTER_NAME_053,
      capital: "PAPER_ONLY" as const,
      real_money: false as const,
      auto_promotion: false as const,
      open_task_054: false as const,
    },
    api_calls_ui: 0 as const,
  };
}

export type Observatory053 = ReturnType<typeof buildObservatory053>;
