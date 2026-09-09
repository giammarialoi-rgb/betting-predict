import { loadExp025Config } from "@/domain/eval/turnaround-025/config";
import type { Task025Report } from "@/domain/eval/turnaround-025/lab";
import { STRICT_EVENT_GATE } from "@/domain/eval/turnaround-025/types";

export function auditTask025(report: Task025Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  loadExp025Config();
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.declared_edge !== false) failures.push("declared_edge");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout");
    if (report.metrics.bets !== 0) failures.push("bets");
    if (report.metrics.edge_demonstrated) failures.push("edge");
    if (report.risk.winner !== null) failures.push("risk_winner");
    if (report.monte_carlo.simulated) failures.push("mc_as_historical");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (report.kaggle.class_counts.A_STRICT > 0 && !report.kaggle.bulk_acquired) {
      failures.push("schema_fixture_promoted_strict");
    }
    for (const row of report.annual) {
      if (row.end === 1000) failures.push(`silent_1000_${row.year}`);
      if (row.strict < STRICT_EVENT_GATE && row.status === "VALID") {
        failures.push(`valid_without_gate_${row.year}`);
      }
      if (row.bets === 0 && row.end != null) failures.push(`end_without_bets_${row.year}`);
    }
    if (report.blind.decision.clv_diagnostic.used_in_decision) failures.push("clv_in_decision");
    if (report.verdict !== "INSUFFICIENT_DATA" && report.metrics.events_strict < STRICT_EVENT_GATE) {
      failures.push("verdict_overclaim");
    }
  }
  return { ok: failures.length === 0, failures };
}
