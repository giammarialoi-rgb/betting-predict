import { loadExp041Config } from "@/domain/eval/close-041/config";
import type { Task041Report } from "@/domain/eval/close-041/lab";

export function auditTask041(report: Task041Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp041Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_042) failures.push("open_042");
  if (cfg.historical_hunt) failures.push("historical_hunt");
  if (cfg.refit_market_devig) failures.push("refit");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (cfg.capital_gate) failures.push("capital_flag");
  if (cfg.settled_target !== 100) failures.push("settled_target");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion || report.real_money || report.REAL_MONEY) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.CAPITAL_QUALIFIED !== false) failures.push("capital");
    if (report.open_task_042) failures.push("report_open_042");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (report.FINAL_VERDICT === "DEMONSTRATED_EDGE" && report.SIGNIFICANT !== true) {
      failures.push("edge_without_significance");
    }
    if (report.SETTLED_EVENTS < 100 && report.FINAL_VERDICT === "NO_DEMONSTRATED_EDGE") {
      failures.push("no_edge_before_settled_100");
    }
    if (report.SETTLED_EVENTS < 100 && report.FINAL_VERDICT === "DEMONSTRATED_EDGE") {
      failures.push("edge_before_settled_100");
    }
    if (
      report.SETTLED_EVENTS < 100 &&
      report.EVENTS_DISCOVERED > 0 &&
      report.FINAL_VERDICT !== "INSUFFICIENT_DATA_FINAL" &&
      report.FINAL_VERDICT !== "COLLECTING"
    ) {
      failures.push("wrong_verdict_before_settled");
    }
    if (report.FINAL_VERDICT === "LIVE_NOT_CONFIGURED" && report.STRICT_QUOTES > 0) {
      failures.push("live_not_configured_with_quotes");
    }
  }
  return { ok: failures.length === 0, failures };
}
