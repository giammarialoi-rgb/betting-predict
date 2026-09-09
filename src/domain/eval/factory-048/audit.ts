import { loadExp048Config } from "@/domain/eval/factory-048/config";
import type { Task048Report } from "@/domain/eval/factory-048/lab";

export function auditTask048(report: Task048Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp048Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_049) failures.push("open_049");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (report) {
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.BETS !== 0) failures.push("bets");
    if (report.open_task_049) failures.push("report_049");
    const okVerdict = [
      "PROSPECTIVE_LAB_EXPANDED",
      "NO_DEMONSTRATED_EDGE",
      "INSUFFICIENT_DATA",
      "MODEL_READY_PARTIAL",
    ].includes(report.FINAL_VERDICT);
    if (!okVerdict) failures.push("verdict");
    if (report.SETTLED < 100 && report.MODEL_EDGE !== "UNKNOWN") failures.push("premature_edge");
  }
  return { ok: failures.length === 0, failures };
}
