/**
 * One mega-pipeline cycle: probe → free discover → live → free settle → prediction cases.
 */
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { appendJournal044 } from "@/domain/eval/permanent-044/store";
import { runFreeDiscover } from "@/domain/eval/mega-pipeline/free-discover";
import { runFreeLiveMonitor, runFreeSettle } from "@/domain/eval/mega-pipeline/free-settle";
import { syncPredictionCasesFromStore } from "@/domain/eval/mega-pipeline/prediction-cases";
import { probeActiveFonti } from "@/domain/eval/mega-pipeline/source-probe";
import { ensureMegaPipelineTables } from "@/domain/eval/mega-pipeline/neon-runtime";

export type MegaCycleResult = {
  at: string;
  neon_tables: { ok: boolean; error: string | null };
  source_probes: number;
  sources_ok: number;
  sources_blocked: number;
  discover: Awaited<ReturnType<typeof runFreeDiscover>>;
  live: Awaited<ReturnType<typeof runFreeLiveMonitor>>;
  settle: Awaited<ReturnType<typeof runFreeSettle>>;
  prediction_cases_created: number;
};

export async function runMegaPipelineCycle(input: {
  labBRoot?: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
  persistNeon?: boolean;
  probe?: boolean;
  discover?: boolean;
  live?: boolean;
  settle?: boolean;
} = {}): Promise<MegaCycleResult> {
  const labB = input.labBRoot ?? permanentRoot044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const persistNeon = input.persistNeon !== false && Boolean(process.env.DATABASE_URL);

  const neon_tables = persistNeon
    ? await ensureMegaPipelineTables()
    : { ok: false, error: "DATABASE_URL_MISSING" };

  let source_probes = 0;
  let sources_ok = 0;
  let sources_blocked = 0;
  if (input.probe !== false) {
    const probes = await probeActiveFonti({ nowIso, fetchImpl: input.fetchImpl, persistNeon });
    source_probes = probes.length;
    sources_ok = probes.filter((p) => p.status === "OK" || p.status === "PARTIAL").length;
    sources_blocked = probes.filter((p) => p.status === "BLOCKED" || p.status === "CHALLENGE").length;
  }

  const discover =
    input.discover !== false
      ? await runFreeDiscover({ labBRoot: labB, nowIso, fetchImpl: input.fetchImpl, persistNeon })
      : {
          sources_tried: [],
          fixtures_seen: 0,
          events_inserted: 0,
          events_updated: 0,
          duplicates: 0,
          identity_uncertain: 0,
          by_source: {},
          sample_event_ids: [],
        };

  const live =
    input.live !== false
      ? await runFreeLiveMonitor({ labBRoot: labB, nowIso, fetchImpl: input.fetchImpl, persistNeon })
      : { updated: 0, finished: 0, live: 0 };

  const settle =
    input.settle !== false
      ? await runFreeSettle({ labBRoot: labB, nowIso, fetchImpl: input.fetchImpl, persistNeon })
      : {
          sources_tried: [],
          candidates: 0,
          settled: 0,
          prediction_cases_updated: 0,
          learning_cases: 0,
          by_source: {},
          unresolved: 0,
        };

  const synced = await syncPredictionCasesFromStore({ labBRoot: labB, persistNeon, nowIso });

  if (persistNeon) {
    try {
      const { publishRuntimeStatusNow } = await import(
        "@/domain/eval/betmind-runtime/remote-status"
      );
      await publishRuntimeStatusNow();
    } catch {
      /* mirror optional */
    }
  }

  appendJournal044(labB, {
    kind: "MEGA_PIPELINE_CYCLE",
    at: nowIso,
    discover,
    live,
    settle,
    source_probes,
    sources_ok,
    sources_blocked,
  });

  return {
    at: nowIso,
    neon_tables,
    source_probes,
    sources_ok,
    sources_blocked,
    discover,
    live,
    settle,
    prediction_cases_created: synced.created,
  };
}
