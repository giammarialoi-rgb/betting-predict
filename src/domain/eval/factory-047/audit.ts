import { loadExp047Config } from "@/domain/eval/factory-047/config";
import type { Task047Report } from "@/domain/eval/factory-047/lab";

export function auditTask047(report: Task047Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp047Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_048) failures.push("open_048");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (cfg.seed_events_are_not_a_cap !== true) failures.push("catalog_cap_flag");
  if (report) {
    if (report.CATALOG_CAP !== false) failures.push("catalog_cap");
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.AUTO_PROMOTION) failures.push("promo");
    if (report.CAPITAL !== "CLOSED") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.open_task_048) failures.push("report_048");
    if (
      report.FINAL_VERDICT !== "UNIVERSAL_LIVE_COVERAGE_READY" &&
      report.FINAL_VERDICT !== "UNIVERSAL_LIVE_COVERAGE_PARTIAL"
    ) {
      failures.push("verdict");
    }
    if (report.SEED_EVENTS !== 114) failures.push("seed_intact");
  }
  return { ok: failures.length === 0, failures };
}
