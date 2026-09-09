import { loadExp052Config } from "@/domain/eval/ui-052/config";
import type { Task052Report } from "@/domain/eval/ui-052/lab";

export function auditTask052(report: Task052Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp052Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_053) failures.push("open_053");
  if (cfg.modify_lab_a || cfg.modify_predictor || cfg.modify_collector) failures.push("integrity");
  if (report) {
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.DUPLICATE_KEYS !== 0) failures.push("dup_keys");
    if (report.NEXT_EVENTS_DUP_EVENT_IDS !== 0) failures.push("next_dups");
    if (report.OBSERVATORY_API_CALLS_UI !== 0) failures.push("ui_api");
    if (report.open_task_053) failures.push("report_053");
    if (!["UI_ROBUSTNESS_READY", "UI_ROBUSTNESS_PARTIAL", "BLOCKED"].includes(report.FINAL_VERDICT)) {
      failures.push("verdict");
    }
  }
  return { ok: failures.length === 0, failures };
}
