import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJournal044 } from "@/domain/eval/permanent-044/store";
import { runCoverage047Cycle } from "@/domain/eval/factory-047/cycle";
import { loadExp048Config, saveModelState048, loadModelState048, MODEL_V2_048, PARENT_MODEL_048 } from "@/domain/eval/factory-048/config";
import { runDecisionEngine048 } from "@/domain/eval/factory-048/engine";

export type CycleResult048 = {
  coverage: Awaited<ReturnType<typeof runCoverage047Cycle>>;
  engine: ReturnType<typeof runDecisionEngine048>;
};

export async function runDecision048Cycle(input: {
  discover?: boolean;
  settle?: boolean;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
} = {}): Promise<CycleResult048> {
  loadExp048Config();
  const labB = permanentRoot044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();

  const coverage = await runCoverage047Cycle({
    discover: input.discover === true,
    settle: input.settle !== false,
    forceDiscovery: input.forceDiscovery,
    fetchImpl: input.fetchImpl,
    nowIso,
  });

  const store = loadStore044(labB);
  const engine = runDecisionEngine048({ store, nowIso });

  const state = loadModelState048(labB);
  saveModelState048(labB, {
    current: MODEL_V2_048,
    parent: PARENT_MODEL_048,
    candidates: state.candidates,
    auto_promotion: false,
  });

  appendJournal044(labB, {
    kind: "cycle_048",
    decisions: engine.decisions_written,
    autopsies: engine.autopsies,
    learning: engine.learning_cases,
    NO_BET: engine.metrics.NO_BET,
    BET_CANDIDATE: engine.metrics.BET_CANDIDATE,
    STRONG_CANDIDATE: engine.metrics.STRONG_CANDIDATE,
  });

  return { coverage, engine };
}
