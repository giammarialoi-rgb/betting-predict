import type { Task056Report } from "@/domain/eval/audit-056/lab";

export function auditTask056(report: Task056Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (!report) {
    failures.push("no_report");
    return { ok: false, failures };
  }
  if (report.open_task_057) failures.push("open_057");
  if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
  if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
  if (report.REAL_MONEY !== false) failures.push("real_money");
  if (report.AUTO_PROMOTION !== false) failures.push("promo");
  if (report.CAPITAL !== undefined && (report as { CAPITAL?: string }).CAPITAL !== "PAPER_ONLY") {
    /* optional */
  }
  if (report.PAPER_INITIAL_CAPITAL !== 1000) failures.push("bankroll");
  if (report.ARTIFICIAL_CAP !== false) failures.push("cap");
  if (report.API_CALLS_UI !== 0) failures.push("ui_api");
  if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge_claim");
  if (report.LEAKAGE !== "PASS") failures.push("leakage");
  if (
    !["NOT_READY", "SYSTEM_OPERATIONAL_MARKET_ONLY", "SYSTEM_OPERATIONAL_INDEPENDENT_PARTIAL"].includes(
      report.FINAL_VERDICT,
    )
  ) {
    failures.push("verdict");
  }
  // Must not claim full READY without listing MODEL_IS_MARKET_ONLY blocker when market-only
  if (report.MODEL_READINESS === "MARKET_ONLY" && !report.BLOCKERS.includes("MODEL_IS_MARKET_ONLY")) {
    failures.push("missing_model_blocker");
  }
  if (
    (report.MODEL_READINESS === "INDEPENDENT_ACTIVE" || report.MODEL_READINESS === "INDEPENDENT") &&
    report.MODEL_EDGE !== "UNKNOWN"
  ) {
    failures.push("independent_edge_claim");
  }
  if (
    report.FINAL_VERDICT === "SYSTEM_OPERATIONAL_MARKET_ONLY" ||
    report.FINAL_VERDICT === "SYSTEM_OPERATIONAL_INDEPENDENT_PARTIAL"
  ) {
    if (!report.SUPERVISOR_ALIVE || !report.WORKER_ALIVE) failures.push("alive");
    if (report.AUTOSTART_STATUS === "DISABLED") failures.push("autostart");
  }
  return { ok: failures.length === 0, failures };
}
