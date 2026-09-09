import { loadExp054Config } from "@/domain/eval/catalog-054/config";
import type { Task054Report } from "@/domain/eval/catalog-054/lab";

export function auditTask054(report: Task054Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp054Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_055) failures.push("open_055");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (cfg.directa_scraping_default !== false) failures.push("scraping_default");
  if (cfg.no_artificial_event_cap !== true) failures.push("cap");
  if (report) {
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.CAPITAL !== "PAPER_ONLY") failures.push("capital");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.ARTIFICIAL_CAP !== false) failures.push("artificial_cap");
    if (report.PAPER_BANKROLL !== 1000) failures.push("bankroll");
    if (report.DIRECTA_POLICY_STATUS !== "DISABLED_BY_POLICY") failures.push("directa_policy");
    if (report.OBSERVATORY_API_CALLS_UI !== 0) failures.push("ui_api");
    if (report.open_task_055) failures.push("report_055");
    const okV = ["DIRECTA_MULTISOURCE_CATALOG_READY", "PARTIAL", "BLOCKED"].includes(report.FINAL_VERDICT);
    if (!okV) failures.push("verdict");
  }
  return { ok: failures.length === 0, failures };
}
