import { loadExp054Config } from "@/domain/eval/catalog-054/config";
import type { Task054SupervisorReport } from "@/domain/eval/supervisor-054/lab";

export function auditTask054Supervisor(report: Task054SupervisorReport | null): {
  ok: boolean;
  failures: string[];
} {
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
    if (report.REAL_MONEY || report.CAPITAL !== "PAPER_ONLY") failures.push("capital");
    if (report.AUTO_PROMOTION !== false) failures.push("promo");
    if (report.PAPER_BANKROLL !== 1000) failures.push("bankroll");
    if (report.OPEN_TASK_055) failures.push("report_055");
    if (report.ARTIFICIAL_CAP !== false) failures.push("artificial_cap");
    if (report.SELF_HEALING_TEST !== "PASS") failures.push("self_heal");
    if (report.STORE_RECOVERY !== "PASS") failures.push("store_recovery");
    if (report.NO_DUPLICATE_WORKERS !== true) failures.push("dup_workers");
    if (report.DIRECTA_POLICY_STATUS !== "DISABLED_BY_POLICY") failures.push("directa_policy");
    const okV = ["SUPERVISOR_24_7_SELF_HEALING_READY", "PARTIAL", "BLOCKED"].includes(report.FINAL_VERDICT);
    if (!okV) failures.push("verdict");
    // PASS criteria for READY
    if (report.FINAL_VERDICT === "SUPERVISOR_24_7_SELF_HEALING_READY") {
      if (!report.SUPERVISOR_ALIVE) failures.push("supervisor_dead");
      if (!report.WORKER_ALIVE) failures.push("worker_dead");
      if (!report.HEARTBEAT_FRESH) failures.push("heartbeat_stale");
    }
  }
  return { ok: failures.length === 0, failures };
}

/** Keep legacy name for scripts that imported auditTask054 */
export { auditTask054Supervisor as auditTask054 };
