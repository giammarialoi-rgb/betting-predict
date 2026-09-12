export type {
  AsOfSnapshot,
  RealPipelineReport,
  SliceDecision,
  SourceResult,
  SourceResultStatus,
} from "@/domain/eval/real-pipeline/types";
export { SOURCE_RESULT_STATUSES } from "@/domain/eval/real-pipeline/types";
export { coerceAvailableAtToIso, coerceAvailableAt } from "@/lib/available-at";
export { assertPreMatchData, buildAsOfSnapshot, PreMatchLeakageError } from "@/domain/eval/real-pipeline/as-of-snapshot";
export { toSourceResultStatus, classifyConfiguredSource } from "@/domain/eval/real-pipeline/source-status";
export { sliceDecisionFrom048 } from "@/domain/eval/real-pipeline/decision-label";
export { publishAnalysis } from "@/domain/eval/real-pipeline/publish";
/** Same entry `pnpm analyze:event` calls. There is no `runRealAnalysisSlice`. */
export { runRealAnalysisPipeline, formatPipelineReport } from "@/domain/eval/real-pipeline/run";
export {
  selectEligibleBoardEvents,
  collectCandidatesFromRemote,
  isEligibleBoardEvent,
} from "@/domain/eval/real-pipeline/board-select";
export {
  runBoardAnalysis,
  selectBoardEventsForAnalyze,
  formatBoardRunTable,
  writeBoardRunReport,
} from "@/domain/eval/real-pipeline/board-run";
