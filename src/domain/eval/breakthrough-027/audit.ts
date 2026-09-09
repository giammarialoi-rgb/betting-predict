import { loadExp027Config } from "@/domain/eval/breakthrough-027/config";
import type { Task027Report } from "@/domain/eval/breakthrough-027/lab";
import { STRICT_EVENT_GATE } from "@/domain/eval/breakthrough-027/types";

export function auditTask027(report: Task027Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  loadExp027Config();
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.declared_edge !== false) failures.push("scientific_declared_edge");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout");
    if (report.model_ready) failures.push("model_ready");
    if (report.risk.winner !== null) failures.push("risk_winner");
    if (report.risk.rho_status !== "UNKNOWN") failures.push("invented_rho");
    if (report.qualified.qualified) failures.push("false_qualified");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    for (const row of report.annual) {
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year}`);
      if (row.bets === 0 && row.end != null) failures.push(`end_without_bets_${row.year}`);
      if (row.strict < STRICT_EVENT_GATE && row.status === "VALID") {
        failures.push(`valid_without_gate_${row.year}`);
      }
    }
    if (report.fixture_mode && report.data_band !== "NO_DATA_BREAKTHROUGH") {
      failures.push("fixture_overclaim");
    }
  }
  return { ok: failures.length === 0, failures };
}
