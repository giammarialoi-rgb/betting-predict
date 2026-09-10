import { loadStore044, appendPrediction044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import { computePipelineCounters3d } from "@/domain/eval/betmind-runtime/pipeline-counters";

const root = permanentRoot044();
const before = computePipelineCounters3d(root);
const store = loadStore044(root);
const eventId = "b54ded61f9dc94423dfcb089";
const stale = {
  prediction_id: "stale-overwrite-sim-" + Date.now(),
  event_id: eventId,
  timestamp: new Date().toISOString(),
  model_version: "MODEL_v1|NO_INDEPENDENT",
  feature_version: "features_pi_v1_independent",
  market: "1X2",
  selection: null,
  line: null,
  probability_model: null,
  probability_market: { HOME: 0.44, DRAW: 0.28, AWAY: 0.28 },
  edge_absolute: null,
  edge_relative: null,
  confidence_score: 10,
  data_quality_score: 0.1,
  recommended: false as const,
  reason_codes: ["INSUFFICIENT_DATA", "FEATURES_TOO_SPARSE", "NO_INDEPENDENT_MODEL"],
  risk_flags: ["STALE_WORKER_SIM"],
  human_readable_reason: "simulated stale worker downgrade",
  ranking_bucket: "NO_BET" as const,
  prediction_seq: 99999,
  immutable: true as const,
  analysis_runtime_version: "stale-worker-old",
  worker_pid: -1,
  cycle_number: 0,
};
const result = appendPrediction044(store, stale);
const d = buildAnalysisDossier(eventId, root);
const after = computePipelineCounters3d(root);
console.log(JSON.stringify({
  stale_append_result: result,
  villa_model: d?.independent_model.probability,
  villa_version: d?.independent_model.model_version,
  before_inferences: before.model_inferences,
  after_inferences: after.model_inferences,
}, null, 2));