/**
 * Event research orchestrator: enqueue upcoming matches and research a budgeted batch.
 * Does not lower model gates. Does not invent fixture IDs.
 */
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { runEventResearchBatch, type ResearchCycleResult } from "@/domain/eval/data-intelligence/research/run-event-research";
import {
  enqueueUpcomingEvents,
  pickResearchBatch,
  markQueueStates,
  queueCounts,
  loadResearchQueue,
  type ResearchQueueFile,
} from "@/domain/eval/data-intelligence/research/queue";

export const RESEARCH_BUDGET_PER_CYCLE = 24;

export type OrchestratorResult = ResearchCycleResult & {
  queued: number;
  researched: number;
  upcoming: number;
  processed_ids: string[];
  budget: number;
};

export async function runEventResearchOrchestrator(input: {
  events: PermanentEvent044[];
  nowIso: string;
  nowMs: number;
  cycleNumber: number | null;
  labBRoot: string;
  budget?: number;
}): Promise<OrchestratorResult> {
  const budget = input.budget ?? RESEARCH_BUDGET_PER_CYCLE;
  let queue: ResearchQueueFile = enqueueUpcomingEvents({
    events: input.events,
    nowMs: input.nowMs,
    nowIso: input.nowIso,
    root: input.labBRoot,
  });
  const batch = pickResearchBatch(queue, budget, input.nowMs);
  queue = markQueueStates(queue, batch.map((b) => b.event_id), "RESEARCHING", input.cycleNumber, input.nowIso, input.labBRoot);

  const byId = new Map(input.events.map((e) => [e.event_id, e]));
  const events = batch.map((b) => byId.get(b.event_id)).filter(Boolean) as PermanentEvent044[];

  const research = await runEventResearchBatch({
    events,
    cycleNumber: input.cycleNumber,
    nowIso: input.nowIso,
    labBRoot: input.labBRoot,
    maxEvents: budget,
    allowScrapeProbes: true,
    asOf: input.nowIso,
  });

  queue = markQueueStates(queue, events.map((e) => e.event_id), "RESEARCHED", input.cycleNumber, input.nowIso, input.labBRoot);
  const counts = queueCounts(loadResearchQueue(input.labBRoot), input.nowMs);
  return {
    ...research,
    queued: counts.queued,
    researched: counts.researched,
    upcoming: counts.upcoming,
    processed_ids: events.map((e) => e.event_id),
    budget,
  };
}
