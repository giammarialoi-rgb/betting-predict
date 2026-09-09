import { loadExp045Config } from "@/domain/eval/factory-045/config";
import type { Task045Report } from "@/domain/eval/factory-045/lab";

export function auditTask045(report: Task045Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp045Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_046) failures.push("open_046");
  if (cfg.modify_lab_a || cfg.synthetic_data) failures.push("integrity");
  if (cfg.seed_events_are_not_a_cap !== true) failures.push("seed_cap_flag");
  if (report) {
    if (report.WINNER !== null) failures.push("winner");
    if (report.AUTO_PROMOTION || report.REAL_MONEY) failures.push("promo");
    if (report.BETS !== 0 || report.BANKROLL !== "—") failures.push("bets");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.open_task_046) failures.push("report_046");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.TASK_039_040_041 !== "READ_ONLY_PRESERVED") failures.push("lab_a");
    if (report.FINAL_VERDICT === ("NO_EDGE" as string)) failures.push("wrong_verdict_family");
  }
  return { ok: failures.length === 0, failures };
}
