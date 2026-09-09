import { buildObservatory054 } from "@/domain/eval/catalog-054/observatory";
import {
  loadCoverage055,
  loadCurrentActivity055,
  readActivityFeed055,
  runMultiSourceCycle055,
} from "@/domain/eval/catalog-055/cycle";
import { buildRankBoards055 } from "@/domain/eval/catalog-055/rankings";
import { assessConsolidation055 } from "@/domain/eval/catalog-055/consolidation";
import { loadAutostartStatus055 } from "@/domain/eval/catalog-055/autostart";
import { resolveAutostart056 } from "@/domain/eval/audit-056/autostart";
import { runDiagnostics056 } from "@/domain/eval/audit-056/diagnostics";
import { buildDecisionBoard056 } from "@/domain/eval/audit-056/decision-board";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function resolveModelReadiness056(root: string): "MARKET_ONLY" | "INDEPENDENT_ACTIVE" {
  const store = loadStore044(root);
  const ind = store.predictions.some(
    (p) =>
      p.model_version?.includes("INDEPENDENT") ||
      p.reason_codes?.some((c) => c === "INDEPENDENT_MODEL" || c.includes("INDEPENDENT_POISSON")),
  );
  const piPath = join(root, "predictive-intelligence", "final-verdict.json");
  if (existsSync(piPath)) {
    try {
      const pv = JSON.parse(readFileSync(piPath, "utf8")) as { model_is_market_only?: boolean };
      if (pv.model_is_market_only === false) return "INDEPENDENT_ACTIVE";
    } catch {
      /* ignore */
    }
  }
  return ind ? "INDEPENDENT_ACTIVE" : "MARKET_ONLY";
}

/** Disk-only observatory — zero Odds API from UI. */
export async function buildObservatory055(nowIso = new Date().toISOString()) {
  const base = await buildObservatory054(nowIso);
  const root = permanentRoot044();
  let coverage = loadCoverage055(root);
  if (!coverage) coverage = await runMultiSourceCycle055({ nowIso });
  const store = loadStore044(root);
  const rankings = buildRankBoards055(store, nowIso, false);
  const activity = loadCurrentActivity055(root);
  const feed = readActivityFeed055(root, 60);
  const consolidation = assessConsolidation055({ leakagePass: true, reproducibilityPass: true });
  const autostart = loadAutostartStatus055(root);
  const autostart056 = resolveAutostart056(false);
  const diagnostics = runDiagnostics056(root);
  const decision_board = buildDecisionBoard056(nowIso, 500);

  return {
    ...base,
    // Enrich next_events for operational table (UI pagination; not a discovery cap)
    next_events:
      decision_board.length > 0
        ? decision_board.map((r) => ({
            event_id: r.event_id,
            kickoff_utc: r.kickoff_utc,
            sport: r.sport,
            competition: r.competition,
            label: r.label,
            minutes_to_kickoff: r.minutes_to_kickoff,
            near_t1h:
              r.minutes_to_kickoff != null && r.minutes_to_kickoff >= 0 && r.minutes_to_kickoff <= 180,
            status: r.status,
            markets: r.market ? [r.market] : [],
            prediction_status: r.decision,
            lock_status: r.status.includes("LOCK") ? "LOCKED" : "OPEN",
            selection: r.selection,
            confidence: r.model_pct != null ? r.model_pct / 100 : null,
            model_pct: r.model_pct,
            market_pct: r.market_pct,
            edge: r.edge,
            ev: r.ev,
            odds: r.odds,
            decision: r.decision,
            stake: r.stake,
            why: r.why,
            fair_odds: r.fair_odds,
            model_version: r.model_version,
            result: r.result,
            pnl: r.pnl,
            model_ne_market: r.model_ne_market,
            edge_status: r.edge_status,
          }))
        : base.next_events,
    multisource_055: {
      title: "UNIVERSAL 24/7 SPORTS INTELLIGENCE BRAIN",
      artificial_cap: false as const,
      coverage,
      source_monitor: coverage.source_health,
      rankings,
      current_activity: activity ?? coverage.current_activity,
      activity_feed: feed,
      paper_bankroll: 1000 as const,
      capital: "PAPER_ONLY" as const,
      real_money: false as const,
      auto_promotion: false as const,
      model_edge: "UNKNOWN" as const,
      api_calls_ui: 0 as const,
    },
    consolidation_055: consolidation,
    autostart_055: autostart,
    audit_056: {
      AUTOSTART_STATUS: autostart056.AUTOSTART_STATUS,
      AUTOSTART_VERIFIED: autostart056.AUTOSTART_VERIFIED,
      diagnostics,
      decision_board_count: decision_board.length,
      model_readiness: resolveModelReadiness056(root),
      model_edge: "UNKNOWN" as const,
      canonical_chain: "supervisor→worker→brain→massive049→decision048→bankroll053",
      open_task_057: false as const,
    },
    api_calls_ui: 0 as const,
  };
}

export type Observatory055 = Awaited<ReturnType<typeof buildObservatory055>>;
