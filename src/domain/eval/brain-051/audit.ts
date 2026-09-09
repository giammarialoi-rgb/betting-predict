import { loadExp051Config } from "@/domain/eval/brain-051/config";
import type { Task051Report } from "@/domain/eval/brain-051/lab";

export function auditTask051(report: Task051Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp051Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_052) failures.push("open_052");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (report) {
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.OBSERVATORY_API_CALLS_UI !== 0) failures.push("ui_api");
    if (report.open_task_052) failures.push("report_052");
    const okV = [
      "AUTONOMOUS_24_7_LIVE_BRAIN_READY",
      "AUTONOMOUS_BRAIN_PARTIAL",
      "INSUFFICIENT_DATA",
    ].includes(report.FINAL_VERDICT);
    if (!okV) failures.push("verdict");
  }
  return { ok: failures.length === 0, failures };
}
