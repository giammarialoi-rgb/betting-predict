import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJournal044 } from "@/domain/eval/permanent-044/store";
import { runMassive049Cycle } from "@/domain/eval/factory-049/cycle";
import {
  ensureBrainDirs051,
  loadBrainState051,
  loadExp051Config,
  saveBrainState051,
  BRAIN_MODEL_051,
} from "@/domain/eval/brain-051/config";
import { planCycle051 } from "@/domain/eval/brain-051/scheduler";
import { appendActivity051, appendBrainLog051, writeHeartbeat051 } from "@/domain/eval/brain-051/health";
import { maybeOpenPaperBet051 } from "@/domain/eval/brain-051/paper";
import { ensureDataIntelligenceContext } from "@/domain/eval/data-intelligence/context";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";

export type BrainCycleResult051 = {
  priority: string;
  reason: string;
  sleep_ms: number;
  massive: Awaited<ReturnType<typeof runMassive049Cycle>> | null;
  paper_bets_opened: number;
  idle: boolean;
};

function latestDecisions(root: string): DecisionRecord048[] {
  const p = join(root, "decisions.jsonl");
  if (!existsSync(p)) return [];
  const latest = new Map<string, DecisionRecord048>();
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const d = JSON.parse(line) as DecisionRecord048;
      const prev = latest.get(d.event_id);
      if (!prev || d.timestamp >= prev.timestamp) latest.set(d.event_id, d);
    } catch {
      /* skip */
    }
  }
  return [...latest.values()];
}

export async function runBrainCycle051(input: {
  forceDiscover?: boolean;
  /** Daemon default true; lab/audit should set false to avoid Odds API spend. */
  allowDiscover?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
} = {}): Promise<BrainCycleResult051> {
  loadExp051Config();
  const labB = permanentRoot044();
  ensurePermanentDirs044(labB);
  ensureBrainDirs051(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  writeHeartbeat051(labB, { phase: "planning" });
  const diCtx = ensureDataIntelligenceContext(labB);
  if (!diCtx.ok) {
    appendActivity051(labB, "DI_DEGRADED", "data-intelligence coverage missing — continuing");
  } else {
    appendJournal044(labB, {
      kind: "data_intelligence_context",
      at: nowIso,
      coverage: diCtx.coverage,
      conflict_hint: diCtx.coverage?.SOURCE_AGREEMENT != null && diCtx.coverage.SOURCE_AGREEMENT < 0.6,
      real_money: false,
    });
  }
  const store = loadStore044(labB);
  const plan = planCycle051(store, nowMs);

  let state = loadBrainState051(labB);
  state = {
    ...state,
    status: plan.priority === "IDLE" ? "IDLE" : "RUNNING",
    last_priority: plan.priority,
    last_cycle_at: nowIso,
    worker_pid: process.pid,
    model_version: BRAIN_MODEL_051,
  };
  saveBrainState051(labB, state);

  if (!plan.settle && !plan.discover && !plan.analyze) {
    appendActivity051(labB, "IDLE", plan.reason);
    writeHeartbeat051(labB, { phase: "idle", priority: plan.priority });
    try {
      const { publishRuntimeStatusNow } = await import(
        "@/domain/eval/betmind-runtime/remote-status"
      );
      await publishRuntimeStatusNow();
    } catch {
      /* optional Neon mirror */
    }
    return {
      priority: plan.priority,
      reason: plan.reason,
      sleep_ms: plan.sleep_ms,
      massive: null,
      paper_bets_opened: 0,
      idle: true,
    };
  }

  appendActivity051(labB, "CYCLE_START", `${plan.priority} ${plan.reason}`);
  appendBrainLog051(labB, `cycle_start ${plan.priority} ${plan.reason}`);

  try {
    const { writeCurrentWork053 } = await import("@/domain/eval/bankroll-053/system");
    writeCurrentWork053({
      sport: "MULTI",
      event: null,
      market: null,
      phase: plan.discover ? "DISCOVER" : plan.settle ? "SETTLE" : "ANALYZE",
      started_at: nowIso,
      last_update: nowIso,
      note: plan.reason,
    });

    const allowDiscover = input.allowDiscover !== false;
    const massive = await runMassive049Cycle({
      discover: allowDiscover && (plan.discover || input.forceDiscover === true),
      settle: plan.settle,
      forceDiscovery: allowDiscover && input.forceDiscover === true,
      fetchImpl: input.fetchImpl,
      nowIso,
    });

    let paper = 0;
    for (const d of latestDecisions(labB)) {
      const opened = maybeOpenPaperBet051({ root: labB, decision: d, nowIso });
      if (opened) paper += 1;
    }

    // Virtual 1000 bankroll (SIMULATION_ONLY) — separate from scientific path
    try {
      const { maybeOpenVirtualBets053, settleVirtualBets053 } = await import(
        "@/domain/eval/bankroll-053/ledger"
      );
      const storeAfter = loadStore044(labB);
      settleVirtualBets053({ root: labB, settlements: storeAfter.settlements, nowIso });
      for (const d of latestDecisions(labB)) {
        maybeOpenVirtualBets053({ root: labB, decision: d, nowIso });
      }
    } catch {
      /* bankroll module optional if store warm */
    }

    // Catalog triangulation (Directa policy-gated; disk-only when disabled)
    try {
      const { runCatalogCycle054 } = await import("@/domain/eval/catalog-054/coverage");
      await runCatalogCycle054({ nowIso });
      appendActivity051(labB, "CATALOG_054", "coverage refreshed");
    } catch {
      /* catalog module optional */
    }

    // Multi-source universal discovery (policy-gated stubs + Odds Lab B)
    try {
      const { runMultiSourceCycle055 } = await import("@/domain/eval/catalog-055/cycle");
      await runMultiSourceCycle055({ nowIso });
      appendActivity051(labB, "CATALOG_055", "multisource coverage refreshed");
    } catch {
      /* optional */
    }

    // Research / scrape CONTEXT pipeline (never invents available_at; odds out of MODEL)
    let researchStats: {
      research_fetches: number;
      research_failures: number;
      research_denied: number;
      events_touched: number;
      queued?: number;
      researched?: number;
      upcoming?: number;
      budget?: number;
    } | null = null;
    try {
      const { runEventResearchOrchestrator } = await import(
        "@/domain/eval/data-intelligence/research/orchestrator"
      );
      const storeAfter = loadStore044(labB);
      const research = await runEventResearchOrchestrator({
        events: storeAfter.events,
        nowIso,
        nowMs,
        cycleNumber: loadBrainState051(labB).cycles_completed + 1,
        labBRoot: labB,
      });
      researchStats = {
        research_fetches: research.research_fetches,
        research_failures: research.research_failures,
        research_denied: research.research_denied,
        events_touched: research.events_touched,
        queued: research.queued,
        researched: research.researched,
        upcoming: research.upcoming,
        budget: research.budget,
      };
      appendActivity051(
        labB,
        "RESEARCH",
        `budget=${research.budget} touched=${research.events_touched} queued=${research.queued} researched=${research.researched} fetches=${research.research_fetches}`,
      );
      try {
        const { appendFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        appendFileSync(
          join(labB, "cycle-traces.jsonl"),
          `${JSON.stringify({
            cycle: loadBrainState051(labB).cycles_completed + 1,
            at: nowIso,
            discovered: storeAfter.events.length,
            research_attempted: research.events_touched,
            research_completed: research.research_fetches,
            research_failures: research.research_failures,
            blocked: research.by_source,
            queued: research.queued,
            researched: research.researched,
            budget: research.budget,
          })}\n`,
          "utf8",
        );
      } catch {
        /* trace optional */
      }
    } catch {
      /* research optional — cycle must not die */
    }

    // Mirror ANALYZED / independent dossiers to Neon for Vercel `/events/[id]`
    try {
      const { mirrorDossiersToNeon } = await import("@/domain/eval/betmind-runtime/dossier");
      await mirrorDossiersToNeon(labB, { limit: 150 });
    } catch {
      /* optional */
    }

    state = loadBrainState051(labB);
    state = {
      ...state,
      status: "RUNNING",
      last_successful_cycle_at: nowIso,
      last_cycle_at: nowIso,
      consecutive_errors: 0,
      last_error: null,
      cycles_completed: state.cycles_completed + 1,
      last_priority: plan.priority,
      worker_pid: process.pid,
    };
    saveBrainState051(labB, state);
    writeHeartbeat051(labB, {
      phase: "ok",
      priority: plan.priority,
      events: massive.stats.EVENTS_ANALYZED,
      research_fetches: researchStats?.research_fetches ?? 0,
    });
    try {
      const { writeCurrentWork053 } = await import("@/domain/eval/bankroll-053/system");
      writeCurrentWork053({
        sport: "MULTI",
        event: null,
        market: null,
        phase: "IDLE",
        started_at: nowIso,
        last_update: new Date().toISOString(),
        note: `cycle_ok events=${massive.stats.EVENTS_ANALYZED} research_fetches=${researchStats?.research_fetches ?? 0}`,
      });
    } catch {
      /* optional */
    }
    appendActivity051(
      labB,
      "CYCLE_OK",
      `events=${massive.stats.EVENTS_ANALYZED} NO_BET=${massive.stats.NO_BET} paper=${paper}`,
    );
    appendJournal044(labB, {
      kind: "brain_cycle_051",
      priority: plan.priority,
      reason: plan.reason,
      paper,
      stats: massive.stats,
      research: researchStats,
    });

    try {
      const { publishRuntimeStatusNow } = await import(
        "@/domain/eval/betmind-runtime/remote-status"
      );
      await publishRuntimeStatusNow();
    } catch {
      /* optional Neon mirror for Vercel health + board */
    }

    return {
      priority: plan.priority,
      reason: plan.reason,
      sleep_ms: plan.sleep_ms,
      massive,
      paper_bets_opened: paper,
      idle: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state = loadBrainState051(labB);
    state = {
      ...state,
      status: "ERROR",
      last_error: msg,
      consecutive_errors: state.consecutive_errors + 1,
      last_cycle_at: nowIso,
    };
    saveBrainState051(labB, state);
    writeHeartbeat051(labB, { phase: "error", error: msg });
    appendActivity051(labB, "CYCLE_ERROR", msg);
    appendBrainLog051(labB, `cycle_error ${msg}`);
    throw e;
  }
}
