import { loadExp044Config } from "@/domain/eval/permanent-044/config";
import type { Task044Report } from "@/domain/eval/permanent-044/lab";

export function auditTask044(report: Task044Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp044Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_045) failures.push("open_045");
  if (cfg.modify_lab_a_locks || cfg.contaminate_lab_a) failures.push("lab_a");
  if (cfg.retro_recalculate || cfg.synthetic_data) failures.push("integrity");
  if (cfg.capital_gate || cfg.historical_hunt) failures.push("capital_hunt");
  if (report) {
    if (report.WINNER !== null) failures.push("winner");
    if (report.AUTO_PROMOTION || report.REAL_MONEY) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.CAPITAL_QUALIFIED !== false) failures.push("capital_q");
    if (report.open_task_045) failures.push("report_045");
    if (report.FINAL_VERDICT === "EDGE_DEMONSTRATED") failures.push("edge_without_protocol");
    if (report.MODEL_READY === true) failures.push("model_ready_true");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("model_edge");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.TASK_039_040_041 !== "READ_ONLY_PRESERVED") failures.push("lab_a_flag");
  }
  return { ok: failures.length === 0, failures };
}
