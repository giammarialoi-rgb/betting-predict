import { loadExp043Config } from "@/domain/eval/live-043/config";
import type { Task043Report } from "@/domain/eval/live-043/lab";

export function auditTask043(report: Task043Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp043Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_044) failures.push("open_044");
  if (cfg.modify_existing_locks) failures.push("modify_locks");
  if (cfg.retro_recalculate) failures.push("retro");
  if (cfg.capital_gate) failures.push("capital");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion || report.REAL_MONEY) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.CAPITAL_QUALIFIED !== false) failures.push("capital_q");
    if (report.open_task_044) failures.push("report_044");
    if (report.FINAL_VERDICT === "EDGE_DEMONSTRATED") failures.push("edge_without_protocol");
  }
  return { ok: failures.length === 0, failures };
}
