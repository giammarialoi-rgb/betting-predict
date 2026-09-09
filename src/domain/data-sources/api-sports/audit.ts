import type { Task057Report } from "@/domain/data-sources/api-sports/lab";
import { getApiSportsKey057 } from "@/domain/data-sources/api-sports/config";

export function auditTask057(report: Task057Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (!report) return { ok: false, failures: ["no_report"] };
  if (report.open_task_058) failures.push("open_058");
  if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
  if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
  if (report.REAL_MONEY !== false) failures.push("real_money");
  if (report.AUTO_PROMOTION !== false) failures.push("promo");
  if (report.CAPITAL !== "PAPER_ONLY" || report.PAPER_INITIAL !== 1000) failures.push("capital");
  if (report.KEY_EXPOSED !== false) failures.push("key_exposed");
  if (report.MODEL_ENGINE_TOUCHED !== false) failures.push("model_touched");
  if (report.SUPERVISOR_TOUCHED !== false) failures.push("supervisor_touched");
  if (!["PASS", "PARTIAL", "BLOCKED"].includes(report.FINAL_VERDICT)) failures.push("verdict");

  // Leakage: report JSON must not contain raw key
  const key = getApiSportsKey057();
  if (key && JSON.stringify(report).includes(key)) failures.push("key_in_report");

  if (report.FINAL_VERDICT === "PASS") {
    if (!report.API_SPORTS_REACHABLE) failures.push("not_reachable");
    if (!report.CAPABILITY_DISCOVERY) failures.push("no_caps");
    if (report.NORMALIZED_EVENTS < 1) failures.push("no_normalize");
  }
  return { ok: failures.length === 0, failures };
}
