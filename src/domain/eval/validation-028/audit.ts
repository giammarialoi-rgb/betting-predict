import { loadExp028Config } from "@/domain/eval/validation-028/config";
import type { Task028Report } from "@/domain/eval/validation-028/lab";

export function auditTask028(report: Task028Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  loadExp028Config();
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.declared_best) failures.push("declared_best");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.model_ready) failures.push("model_ready");
    if (report.clv !== "CLV_UNAVAILABLE") failures.push("clv_invented");
    if (report.rho_status !== "UNKNOWN") failures.push("rho_invented");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (report.promotion.promotion) failures.push("auto_promotion");
    for (const row of report.annual) {
      if (row.bets === 0 && row.end != null) failures.push(`end_without_bets_${row.year}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year}`);
    }
    if (report.fixture_mode && report.verdict !== "INSUFFICIENT_DATA") {
      failures.push("fixture_overclaim");
    }
    if (report.sample_assessment) {
      const items = [
        ...report.sample_assessment.evidenceGraph.supporting,
        ...report.sample_assessment.evidenceGraph.contradicting,
        ...report.sample_assessment.evidenceGraph.contextual,
      ];
      if (items.some((i) => i.sourceReliability !== null)) failures.push("invented_reliability");
      if (
        report.sample_assessment.evidenceGraph.supporting.length +
          report.sample_assessment.evidenceGraph.contradicting.length +
          report.sample_assessment.evidenceGraph.contextual.length +
          report.sample_assessment.evidenceGraph.insufficient.length ===
        0
      ) {
        failures.push("empty_evidence_graph");
      }
    }
    if (report.annual.some((r) => r.start !== 1000)) failures.push("annual_start_not_1000");
  }
  return { ok: failures.length === 0, failures };
}
