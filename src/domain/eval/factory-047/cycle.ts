import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { labAStore044, permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJournal044, appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { runFactory045Cycle } from "@/domain/eval/factory-045/cycle";
import { loadDiscoveryState045 } from "@/domain/eval/factory-045/config";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";
import {
  loadCoverageState047,
  loadExp047Config,
  saveCoverageState047,
} from "@/domain/eval/factory-047/config";
import { planBudget047 } from "@/domain/eval/factory-047/budget";
import { summarizeMarketsObserved047 } from "@/domain/eval/factory-047/market-catalog";
import { buildStructuredWhy047 } from "@/domain/eval/factory-047/why";
import { scanPostLockMovements047 } from "@/domain/eval/factory-047/post-lock";
import { buildRankBoards047 } from "@/domain/eval/factory-047/ranking";
import { aggregatePatterns047 } from "@/domain/eval/factory-047/patterns";
import {
  appendBackwardSearch047,
  backwardSearch047,
  learningCaseFromSearch047,
} from "@/domain/eval/factory-047/backward";
import { coverageBinsForEvent047 } from "@/domain/eval/factory-047/coverage";

export type CycleResult047 = {
  budget: ReturnType<typeof planBudget047>;
  factory: Awaited<ReturnType<typeof runFactory045Cycle>> | null;
  markets: ReturnType<typeof summarizeMarketsObserved047>;
  post_lock_movements: number;
  patterns: number;
  tennis_status: string;
  why_written: number;
  catalogs_written: number;
  backward_searches: number;
  learning_cases: number;
  skipped_discovery: boolean;
  horizons: { TODAY: number; NEXT_24H: number; NEXT_72H: number; NEXT_7D: number };
};

export function eventHorizons047(storeRoot: string, nowMs = Date.now()) {
  const store = loadStore044(storeRoot);
  const day = 24 * 3600_000;
  const startOfDay = new Date(nowMs);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const dayStart = startOfDay.getTime();
  const dayEnd = dayStart + day;
  const ks = store.events
    .map((e) => (e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN))
    .filter((t) => Number.isFinite(t));
  return {
    TODAY: ks.filter((t) => t >= dayStart && t < dayEnd).length,
    NEXT_24H: ks.filter((t) => t >= nowMs && t < nowMs + day).length,
    NEXT_72H: ks.filter((t) => t >= nowMs && t < nowMs + 3 * day).length,
    NEXT_7D: ks.filter((t) => t >= nowMs && t < nowMs + 7 * day).length,
  };
}

function loadWhyIds(root: string): Set<string> {
  const p = join(root, "structured-why.jsonl");
  if (!existsSync(p)) return new Set();
  const ids = new Set<string>();
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const j = JSON.parse(line) as { prediction_id?: string };
      if (j.prediction_id) ids.add(j.prediction_id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

function runPostSettleIntelligence047(storeRoot: string, nowIso: string): {
  backward: number;
  learning: number;
} {
  const store = loadStore044(storeRoot);
  let backward = 0;
  let learning = 0;
  const donePath = join(storeRoot, "backward-search.jsonl");
  const done = new Set<string>();
  if (existsSync(donePath)) {
    for (const line of readFileSync(donePath, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const j = JSON.parse(line) as { autopsy_id?: string };
        if (j.autopsy_id) done.add(j.autopsy_id);
      } catch {
        /* skip */
      }
    }
  }
  for (const a of store.autopsies) {
    if (done.has(a.autopsy_id)) continue;
    const pred = store.predictions.find((p) => p.prediction_id === a.prediction_id);
    if (!pred) continue;
    const lock = store.locks.find((l) => l.event_id === a.event_id) ?? null;
    const settle = store.settlements.find((s) => s.event_id === a.event_id);
    const search = backwardSearch047({
      store,
      prediction: pred,
      autopsy: a,
      lockTime: lock?.lock_timestamp ?? null,
    });
    appendBackwardSearch047(store, search);
    appendJsonl044(donePath, search);
    backward += 1;
    const lc = learningCaseFromSearch047({
      autopsy: a,
      prediction: pred,
      search,
      actual: settle?.result ?? "UNKNOWN",
      nowIso,
    });
    appendJsonl044(join(storeRoot, "learning-cases.jsonl"), { kind: "LEARNING_CASE_047", ...lc });
    learning += 1;
  }
  return { backward, learning };
}

export async function runCoverage047Cycle(input: {
  discover?: boolean;
  settle?: boolean;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
} = {}): Promise<CycleResult047> {
  loadExp047Config();
  const labB = permanentRoot044();
  const labA = labAStore044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();

  const cfg = loadGovernorConfig042();
  const credit = loadCreditState042(labA);
  const budget = planBudget047({
    credit,
    cfg,
    estimatedCost: input.discover ? Math.min(cfg.maxCreditsPerRun, 12) : 4,
    wantsDiscovery: input.discover === true,
  });

  let skipped_discovery = false;
  let factory: Awaited<ReturnType<typeof runFactory045Cycle>>;

  if (input.discover && budget.stop_gracefully) {
    skipped_discovery = true;
    appendJournal044(labB, {
      kind: "budget_stop_graceful_047",
      reason: budget.reason,
      remaining: budget.remaining,
      safe: budget.safe_reserve,
    });
    factory = await runFactory045Cycle({
      discover: false,
      settle: input.settle !== false,
      fetchImpl: input.fetchImpl,
      nowIso,
    });
  } else {
    const allowDiscover = input.discover === true && budget.allow;
    if (input.discover && !budget.allow) skipped_discovery = true;
    factory = await runFactory045Cycle({
      discover: allowDiscover,
      settle: input.settle !== false,
      forceDiscovery: input.forceDiscovery,
      fetchImpl: input.fetchImpl,
      maxSports: allowDiscover ? 10 : 0,
      nowIso,
    });
  }

  const store = loadStore044(labB);
  analyzeAllLabB045({ store, nowIso });

  const markets = summarizeMarketsObserved047(store);
  appendJsonl044(join(labB, "markets.jsonl"), {
    kind: "MARKET_CATALOG_SUMMARY",
    ...markets,
    at: nowIso,
  });

  let why_written = 0;
  const whyIds = loadWhyIds(labB);
  const latestPred = new Map<string, (typeof store.predictions)[0]>();
  for (const p of store.predictions) {
    const prev = latestPred.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) latestPred.set(p.event_id, p);
  }
  for (const p of latestPred.values()) {
    if (whyIds.has(p.prediction_id)) continue;
    const why = buildStructuredWhy047(p);
    appendJsonl044(join(labB, "structured-why.jsonl"), { kind: "STRUCTURED_WHY_047", ...why, at: nowIso });
    why_written += 1;
  }

  // Sample coverage bins for a few events (append-only research trail)
  for (const ev of store.events.slice(0, 20)) {
    const bins = coverageBinsForEvent047(
      ev,
      store.quotes.filter((q) => q.event_id === ev.event_id),
    );
    appendJsonl044(join(labB, "coverage-bins.jsonl"), {
      kind: "COVERAGE_BINS_047",
      event_id: ev.event_id,
      bins,
      at: nowIso,
      note: "TRUE only with real available_at — never collected_at",
    });
  }

  const movements = scanPostLockMovements047(store, nowIso);
  buildRankBoards047(store, nowIso.slice(0, 10));
  const patterns = aggregatePatterns047(store, nowIso);

  const intel = runPostSettleIntelligence047(labB, nowIso);

  const dstate = loadDiscoveryState045(labB);
  let cov = loadCoverageState047(labB);
  const tennisKeys = factory.discovery?.tennis_keys ?? 0;
  if (factory.discovery) {
    cov = {
      ...cov,
      tennis_status: tennisKeys > 0 ? "AVAILABLE" : "TENNIS_PROVIDER_UNAVAILABLE",
      tennis_keys: tennisKeys > 0 ? cov.tennis_keys : [],
      last_market_catalog_at: nowIso,
      last_post_lock_scan_at: nowIso,
      last_pattern_scan_at: nowIso,
    };
  } else {
    cov = {
      ...cov,
      tennis_status:
        dstate.sports_unavailable.some((s) => /TENNIS/i.test(s)) || tennisKeys === 0
          ? cov.tennis_status === "AVAILABLE"
            ? "AVAILABLE"
            : "TENNIS_PROVIDER_UNAVAILABLE"
          : cov.tennis_status,
      last_market_catalog_at: nowIso,
      last_post_lock_scan_at: nowIso,
      last_pattern_scan_at: nowIso,
    };
  }
  // Disk-only cycles: if never discovered tennis, keep UNAVAILABLE unless previously AVAILABLE
  if (!factory.discovery && cov.tennis_status === "UNKNOWN") {
    cov.tennis_status = "TENNIS_PROVIDER_UNAVAILABLE";
  }
  saveCoverageState047(labB, cov);

  const horizons = eventHorizons047(labB, Date.parse(nowIso));
  appendJsonl044(join(labB, "source-health.jsonl"), {
    kind: "COVERAGE_047",
    tennis_status: cov.tennis_status,
    horizons,
    markets,
    credits_remaining: remainingCredits042(loadCreditState042(labA)),
    fingerprint: createHash("sha256").update(`${store.events.length}|${store.quotes.length}`).digest("hex").slice(0, 16),
    at: nowIso,
  });

  appendJournal044(labB, {
    kind: "cycle_047",
    why_written,
    catalogs_written: 1,
    post_lock: movements.length,
    patterns: patterns.length,
    backward: intel.backward,
    learning: intel.learning,
    skipped_discovery,
    tennis_status: cov.tennis_status,
  });

  return {
    budget,
    factory,
    markets,
    post_lock_movements: movements.length,
    patterns: patterns.length,
    tennis_status: cov.tennis_status,
    why_written,
    catalogs_written: 1,
    backward_searches: intel.backward,
    learning_cases: intel.learning,
    skipped_discovery,
    horizons,
  };
}
