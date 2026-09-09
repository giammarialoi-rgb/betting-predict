import { loadExp046Config } from "@/domain/eval/control-046/config";
import type { Task046Report } from "@/domain/eval/control-046/lab";

export function auditTask046(report: Task046Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp046Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_047) failures.push("open_047");
  if (cfg.modify_lab_a || cfg.ui_odds_api_calls) failures.push("integrity");
  if (report) {
    if (report.API_CALLS_UI !== 0) failures.push("ui_api");
    if (report.CREDITS_USED_FOR_UI !== 0) failures.push("ui_credits");
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.open_task_047) failures.push("report_047");
    if (report.FINAL_VERDICT !== "LIVE_CONTROL_CENTER_READY" && report.FINAL_VERDICT !== "LIVE_CONTROL_CENTER_PARTIAL") {
      if (report.FINAL_VERDICT === ("NO_EDGE" as string)) failures.push("wrong_verdict");
    }
  }
  return { ok: failures.length === 0, failures };
}
