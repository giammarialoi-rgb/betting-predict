import { permanentRoot044, ensurePermanentDirs044, labAStore044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJournal044 } from "@/domain/eval/permanent-044/store";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";
import { runSettle045 } from "@/domain/eval/factory-045/settle";
import { runDecisionEngine048 } from "@/domain/eval/factory-048/engine";
import { loadExp049Config } from "@/domain/eval/factory-049/config";
import { runDiscover049 } from "@/domain/eval/factory-049/discover";
import { runMultiMarketPass049 } from "@/domain/eval/factory-049/multi-market";
import { computeMassiveStats049, writeMassiveStats049 } from "@/domain/eval/factory-049/stats";
import { planBudget047 } from "@/domain/eval/factory-047/budget";
import { loadCreditState042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { scanPostLockMovements047 } from "@/domain/eval/factory-047/post-lock";

export type CycleResult049 = {
  discovery: Awaited<ReturnType<typeof runDiscover049>> | null;
  analyze: ReturnType<typeof analyzeAllLabB045> | null;
  multi_market: ReturnType<typeof runMultiMarketPass049> | null;
  engine: ReturnType<typeof runDecisionEngine048>;
  stats: ReturnType<typeof computeMassiveStats049>;
  skipped_discovery: boolean;
  research: {
    events_touched: number;
    research_fetches: number;
    research_failures: number;
    research_denied: number;
    queued?: number;
    researched?: number;
    upcoming?: number;
    budget?: number;
    by_source?: Record<string, { ok: number; fail: number; denied: number; missing: number }>;
  } | null;
};

export async function runMassive049Cycle(input: {
  discover?: boolean;
  settle?: boolean;
  forceDiscovery?: boolean;
  /** When true, research runs after discovery and BEFORE analyze. */
  research?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
} = {}): Promise<CycleResult049> {
  loadExp049Config();
  const labB = permanentRoot044();
  const labA = labAStore044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();

  // Seed sync Lab A → Lab B (never mutate Lab A)
  await runPermanent044Cycle({
    labARoot: labA,
    permanentRoot: labB,
    runCollector042: false,
    nowIso,
  });

  const cfg = loadGovernorConfig042();
  const credit = loadCreditState042(labA);
  const budget = planBudget047({
    credit,
    cfg,
    estimatedCost: input.discover ? Math.min(cfg.maxCreditsPerRun, 40) : 4,
    wantsDiscovery: input.discover === true,
  });

  let discovery = null;
  let skipped_discovery = false;
  if (input.discover === true) {
    if (budget.stop_gracefully) {
      skipped_discovery = true;
      appendJournal044(labB, { kind: "budget_stop_049", reason: budget.reason });
    } else {
      discovery = await runDiscover049({
        labBRoot: labB,
        labARoot: labA,
        force: input.forceDiscovery,
        fetchImpl: input.fetchImpl,
        nowIso,
      });
      if (discovery.stopped_gracefully) skipped_discovery = true;
    }
  }

  let research: CycleResult049["research"] = null;
  if (input.research) {
    try {
      const { importLiveFootballDataSeason } = await import(
        "@/domain/eval/predictive-intelligence/dataset/live-season"
      );
      await importLiveFootballDataSeason({ labBRoot: labB, fetchImpl: input.fetchImpl });
    } catch {
      /* live season overlay optional */
    }
    try {
      const storeForTsdb = loadStore044(labB);
      const { runTheSportsDbDiscover } = await import(
        "@/domain/eval/factory-049/discover-thesportsdb"
      );
      const tsdb = await runTheSportsDbDiscover({
        store: storeForTsdb,
        nowIso,
        fetchImpl: input.fetchImpl,
      });
      appendJournal044(labB, { kind: "thesportsdb_discover", at: nowIso, ...tsdb });
    } catch {
      /* free discovery optional — Odds path remains */
    }
    try {
      const { runEventResearchOrchestrator } = await import(
        "@/domain/eval/data-intelligence/research/orchestrator"
      );
      const storePre = loadStore044(labB);
      const envBudgetRaw = process.env.RESEARCH_EVENT_BUDGET;
      const envBudget = envBudgetRaw != null && Number.isFinite(Number(envBudgetRaw)) && Number(envBudgetRaw) >= 1
        ? Math.floor(Number(envBudgetRaw))
        : undefined;
      const r = await runEventResearchOrchestrator({
        events: storePre.events,
        nowIso,
        nowMs: Date.parse(nowIso),
        cycleNumber: null,
        labBRoot: labB,
        budget: envBudget,
      });
      research = {
        events_touched: r.events_touched,
        research_fetches: r.research_fetches,
        research_failures: r.research_failures,
        research_denied: r.research_denied,
        queued: r.queued,
        researched: r.researched,
        upcoming: r.upcoming,
        budget: r.budget,
        by_source: r.by_source,
      };
    } catch {
      research = null;
    }
  }

  const store = loadStore044(labB);
  const analyze = analyzeAllLabB045({ store, nowIso });

  if (input.settle !== false) {
    await runSettle045({
      labBRoot: labB,
      labARoot: labA,
      fetchImpl: input.fetchImpl,
      nowIso,
    });
  }

  const store2 = loadStore044(labB);
  // No artificial event caps — multi-market pass covers all upcoming events in store.
  // Budget/rate limits alone gate discovery; UI TOP-N is display-only.
  const upcoming = store2.events.filter(
    (e) => e.kickoff_utc && Date.parse(e.kickoff_utc) >= Date.parse(nowIso) - 6 * 3600_000,
  );
  const subsetStore = {
    ...store2,
    events: upcoming.length ? upcoming : store2.events,
  };
  const multi_market = runMultiMarketPass049(subsetStore as typeof store2, nowIso);

  scanPostLockMovements047(store2, nowIso);
  const engine = runDecisionEngine048({ store: store2, nowIso });
  const stats = computeMassiveStats049(store2, nowIso);
  writeMassiveStats049(labB, stats);

  appendJournal044(labB, {
    kind: "cycle_049",
    events: stats.EVENTS_ANALYZED,
    sports: {
      soccer: stats.SOCCER,
      tennis: stats.TENNIS,
      basketball: stats.BASKETBALL,
      volleyball: stats.VOLLEYBALL,
      hockey: stats.HOCKEY,
    },
    skipped_discovery,
    artificial_cap: false,
  });

  return { discovery, analyze, multi_market, engine, stats, skipped_discovery, research };
}
