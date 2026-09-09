import { loadExp049Config } from "@/domain/eval/factory-049/config";
import type { Task049Report } from "@/domain/eval/factory-049/lab";

export function auditTask049(report: Task049Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp049Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_050) failures.push("open_050");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (cfg.no_artificial_event_cap !== true) failures.push("cap_flag");
  if (report) {
    if (report.ARTIFICIAL_CAP !== false) failures.push("artificial_cap");
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.open_task_050) failures.push("report_050");
    if (report.SETTLED < 100 && report.MODEL_EDGE !== "UNKNOWN") failures.push("premature_edge");
    const okV = [
      "MASSIVE_PROSPECTIVE_LAB_READY",
      "MASSIVE_PROSPECTIVE_LAB_PARTIAL",
      "INSUFFICIENT_DATA",
    ].includes(report.FINAL_VERDICT);
    if (!okV && report.FINAL_VERDICT !== "BLOCKED") failures.push("verdict");
    if (report.FINAL_VERDICT === "BLOCKED") failures.push("blocked");
  }
  return { ok: failures.length === 0, failures };
}
