import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildHealthPayload053, loadCurrentWork053 } from "@/domain/eval/bankroll-053/system";
import { loadChallengerRegistry053 } from "@/domain/eval/bankroll-053/challenger";
import { loadSourceHealth053 } from "@/domain/eval/bankroll-053/source-health";
import { loadAutostartStatus055 } from "@/domain/eval/catalog-055/autostart";
import { loadCoverage055, loadCurrentActivity055, readActivityFeed055 } from "@/domain/eval/catalog-055/cycle";
import {
  listCalendarEvents,
  todayCalendarDay,
} from "@/domain/eval/betmind-runtime/calendar";
import { loadRuntimeStatus } from "@/domain/eval/betmind-runtime/remote-status";
import { localLabStorePresent, staleMirrorComponents } from "@/domain/eval/betmind-runtime/production-mirror";
import { readJsonlTail } from "@/domain/eval/betmind-runtime/board";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { storageBanner } from "@/domain/storage";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import {
  invalidateBetMindSnapshotCache,
  readSnapshotCache,
  writeSnapshotCache,
} from "@/domain/eval/betmind-runtime/snapshot-cache";

export const dynamic = "force-dynamic";
export { invalidateBetMindSnapshotCache };

function readJsonIfExists(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildLiteObservatory(root: string, nowIso: string) {
  const coverage = loadCoverage055(root);
  const activity = loadCurrentActivity055(root) ?? loadCurrentWork053(root);
  const feed = readActivityFeed055(root, 40);
  const health053 = buildHealthPayload053(root);
  const next_events = listCalendarEvents({
    root,
    from: todayCalendarDay(nowIso),
    sport: "ALL",
  }).events;
  const piVerdict = readJsonIfExists(join(root, "predictive-intelligence", "final-verdict.json"));

  return {
    at: nowIso,
    system: health053.system,
    brain: health053.brain,
    current_work: health053.current_work,
    next_events,
    sport_diagnostics: coverage?.by_sport ?? null,
    coverage_047: coverage,
    multisource_055: {
      title: "UNIVERSAL 24/7 SPORTS INTELLIGENCE BRAIN",
      artificial_cap: false as const,
      coverage,
      current_activity: activity,
      activity_feed: feed,
      paper_bankroll: 1000 as const,
      capital: "PAPER_ONLY" as const,
      real_money: false as const,
      auto_promotion: false as const,
      model_edge:
        (piVerdict?.promotion_gate as { model_edge?: string } | undefined)?.model_edge ?? "UNKNOWN",
      api_calls_ui: 0 as const,
    },
    capital: { CAPITAL: "PAPER_1000", REAL_MONEY: false },
    audit_056: {
      AUTOSTART_STATUS: loadAutostartStatus055(root)?.ACTIVE_MECHANISM ?? "N/A",
      model_readiness: piVerdict?.model_is_market_only === false ? "INDEPENDENT_ACTIVE" : "UNKNOWN",
      model_edge:
        (piVerdict?.promotion_gate as { model_edge?: string } | undefined)?.model_edge ?? "UNKNOWN",
      decision_board_count: next_events.length,
      canonical_chain: "supervisor→worker→brain→massive049→decision048→bankroll053",
      open_task_057: false as const,
    },
    api_calls_ui: 0 as const,
  };
}

/** Disk-first BetMind snapshot; Neon mirror when Lab B FS absent (Vercel). Zero Odds/API-Sports. */
export async function GET() {
  const now = Date.now();
  const cached = readSnapshotCache(now);
  if (cached) {
    return NextResponse.json({ ...cached, cache_hit: true });
  }

  try {
    const root = permanentRoot044();
    const pi = piRoot(root);
    const nowIso = new Date().toISOString();
    const storePresent = localLabStorePresent(root);

    if (!storePresent) {
      const remote = await loadRuntimeStatus(now);
      if (remote) {
        const components = remote.fresh ? remote.payload.components : staleMirrorComponents();
        const body = {
          at: nowIso,
          api_calls_ui: 0 as const,
          real_money: false as const,
          cache_hit: false,
          mirror_source: "neon" as const,
          mirror_published_at: remote.published_at,
          mirror_age_ms: remote.age_ms,
          mirror_stale: !remote.fresh,
          observatory: remote.payload.observatory,
          health: {
            ...remote.payload.health053,
            components,
            detail: {
              ...remote.payload.detail,
              store_present: false,
              store_present_local_on_publisher: remote.payload.store_present_local,
              mirror_source: "neon",
              mirror_published_at: remote.published_at,
              mirror_age_ms: remote.age_ms,
              mirror_stale: !remote.fresh,
              brain_status: remote.fresh
                ? remote.payload.detail.brain_status
                : "STALE_MIRROR",
              last_known_brain_status: remote.payload.detail.brain_status,
              last_known_components: remote.payload.components,
            },
            analysis: remote.payload.analysis,
          },
          challengers: [],
          predictive: {
            final_verdict: remote.payload.predictive.final_verdict,
            validation: remote.payload.predictive.validation,
            model_manifest: remote.payload.predictive.model_manifest,
            learning_report: remote.payload.predictive.learning_report ?? null,
            paper_bankroll_report: remote.payload.predictive.paper_bankroll_report ?? null,
            e2e: null,
          },
          learning_cases: remote.payload.learning_cases ?? [],
          recent_settlements: remote.payload.recent_settlements ?? [],
          recent_autopsies: remote.payload.recent_autopsies ?? [],
          analysis: remote.payload.analysis,
        };
        writeSnapshotCache(body, now);
        return NextResponse.json(body);
      }
    }

    const observatory = buildLiteObservatory(root, nowIso);
    const health = {
      ...buildHealthPayload053(root),
      source_health: loadSourceHealth053(root),
      autostart: loadAutostartStatus055(root),
    };

    const learningPath = join(pi, "learning", "cases.jsonl");
    const learningFromPi = readJsonlTail(learningPath, 40);
    const learningFromStore = readJsonlTail(join(root, "learning-cases.jsonl"), 40);

    const body = {
      at: nowIso,
      api_calls_ui: 0 as const,
      real_money: false as const,
      cache_hit: false,
      mirror_source: "local_disk" as const,
      observatory,
      health,
      challengers: loadChallengerRegistry053(root),
      predictive: {
        final_verdict: readJsonIfExists(join(pi, "final-verdict.json")),
        validation: readJsonIfExists(join(pi, "validation-report.json")),
        model_manifest: readJsonIfExists(join(pi, "model-manifest.json")),
        learning_report: readJsonIfExists(join(pi, "learning-report.json")),
        paper_bankroll_report: readJsonIfExists(join(pi, "paper-bankroll-report.json")),
        e2e: readJsonIfExists(join(pi, "e2e-pipeline-report.json")),
      },
      learning_cases: learningFromPi.length ? learningFromPi : learningFromStore,
      recent_settlements: readJsonlTail(join(root, "settlements.jsonl"), 30),
      recent_autopsies: readJsonlTail(join(root, "autopsies.jsonl"), 30),
      storage: storageBanner(),
    };

    writeSnapshotCache(body, now);
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        at: new Date().toISOString(),
        api_calls_ui: 0 as const,
        real_money: false as const,
        cache_hit: false,
        observatory: null,
        health: null,
        challengers: [],
        predictive: null,
        learning_cases: [],
        recent_settlements: [],
        recent_autopsies: [],
        store_root: "audit/external/task-044",
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 200 },
    );
  }
}
