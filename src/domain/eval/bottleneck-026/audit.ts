import { loadExp026Config } from "@/domain/eval/bottleneck-026/config";
import type { Task026Report } from "@/domain/eval/bottleneck-026/lab";
import { STRICT_EVENT_GATE } from "@/domain/eval/bottleneck-026/types";

export function auditTask026(report: Task026Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  loadExp026Config();
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.declared_edge !== false) failures.push("declared_edge");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout");
    if (report.metrics.bets !== 0) failures.push("bets");
    if (report.metrics.edge_demonstrated) failures.push("edge");
    if (report.model_ready) failures.push("model_ready");
    if (report.metrics.capital_strict_events !== 0) failures.push("capital_strict_nonzero_without_license");
    if (report.risk.winner !== null) failures.push("risk_winner");
    if (report.kaggle.claimed_roi_used) failures.push("kaggle_roi");
    if (report.kaggle.license !== "UNKNOWN") failures.push("kaggle_license_not_unknown");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (report.qualified.qualified) failures.push("false_qualified");
    if (report.blind.decision.clv_diagnostic.used_in_decision) failures.push("clv_in_decision");
    for (const row of report.annual) {
      if (row.end === 1000) failures.push(`silent_1000_${row.year}`);
      if (row.strict < STRICT_EVENT_GATE && row.status === "VALID") {
        failures.push(`valid_without_gate_${row.year}`);
      }
      if (row.bets === 0 && row.end != null) failures.push(`end_without_bets_${row.year}`);
    }
    if (report.verdict !== "INSUFFICIENT_DATA") failures.push("verdict_overclaim");
  }
  return { ok: failures.length === 0, failures };
}
