import { computePipelineCounters3d } from "@/domain/eval/betmind-runtime/pipeline-counters";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

function latestPredsWithModel() {
  const p = join(permanentRoot044(), "predictions.jsonl");
  if (!existsSync(p)) return [];
  const by = new Map();
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const row = JSON.parse(line);
      const id = String(row.event_id ?? "");
      if (!id) continue;
      const prev = by.get(id);
      if (!prev || String(row.timestamp ?? "") >= String(prev.timestamp ?? "")) by.set(id, row);
    } catch { /* skip */ }
  }
  return [...by.values()].filter((r) => r.probability_model && typeof r.probability_model === "object");
}

const c = computePipelineCounters3d();
const withModel = latestPredsWithModel();
console.log("COUNTERS", JSON.stringify(c, null, 2));
console.log("INFERENCES", withModel.length);
console.log("SAMPLE", JSON.stringify(withModel.slice(0, 5).map((r) => ({ id: r.event_id, mv: r.model_version, p: r.probability_model })), null, 2));

const proofId = withModel.find((x) => String(x.event_id).includes("b54ded"))?.event_id ?? withModel[0]?.event_id;
if (proofId) {
  const d = buildAnalysisDossier(String(proofId));
  mkdirSync("artifacts/phase-3e", { recursive: true });
  writeFileSync("artifacts/phase-3e/proof-dossier.json", JSON.stringify(d, null, 2));
  console.log("PROOF", JSON.stringify({
    event_id: proofId,
    home: d?.event.home,
    away: d?.event.away,
    model: d?.independent_model.probability,
    version: d?.independent_model.model_version,
    coverage: d?.independent_model.feature_coverage,
    entered: d?.lineage.features_entered_model.length,
    odds_in: d?.lineage.odds_entered_model,
    codes: d?.independent_model.reason_codes?.slice(0, 12),
  }, null, 2));
}