import { loadExp053Config } from "@/domain/eval/bankroll-053/config";
import type { Task053Report } from "@/domain/eval/bankroll-053/lab";

export function auditTask053(report: Task053Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp053Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_054) failures.push("open_054");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (cfg.virtual_bankroll_initial !== 1000) failures.push("bankroll_init");
  if (cfg.no_artificial_event_cap !== true) failures.push("cap_flag");
  if (report) {
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "PAPER_ONLY") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.ARTIFICIAL_CAP !== false) failures.push("artificial_cap");
    if (report.VIRTUAL_BANKROLL_INITIAL !== 1000 || report.PAPER_BANKROLL !== 1000) failures.push("vb1000");
    if (report.OBSERVATORY_API_CALLS_UI !== 0) failures.push("ui_api");
    if (report.open_task_054) failures.push("report_054");
    const okV = ["UNIVERSAL_MASSIVE_LIVE_READY", "PARTIAL", "BLOCKED"].includes(report.FINAL_VERDICT);
    if (!okV) failures.push("verdict");
  }
  return { ok: failures.length === 0, failures };
}
