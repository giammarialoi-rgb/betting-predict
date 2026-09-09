import { loadExp040Config } from "@/domain/eval/recover-040/config";
import type { Task040Report } from "@/domain/eval/recover-040/lab";

export function auditTask040(report: Task040Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp040Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_041) failures.push("open_041");
  if (cfg.historical_hunt) failures.push("historical_hunt");
  if (cfg.refit_market_devig) failures.push("refit");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (cfg.capital_gate) failures.push("capital_flag");
  if (cfg.consume_task_039_store !== true) failures.push("must_consume_039");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion || report.real_money || report.REAL_MONEY) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.CAPITAL_QUALIFIED !== false) failures.push("capital");
    if (report.open_task_041) failures.push("report_open_041");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (report.FINAL_VERDICT === "LIVE_NOT_CONFIGURED" && report.QUOTE_OBSERVATIONS > 0) {
      failures.push("live_not_configured_with_quotes");
    }
    if (report.FINAL_VERDICT === "COLLECTION_BLOCKED" && report.QUOTE_OBSERVATIONS > 0) {
      failures.push("collection_blocked_with_quotes");
    }
    if (report.QUOTE_OBSERVATIONS > 0 && report.EVENTS_DISCOVERED === 0 && report.EVENTS_RECONSTRUCTED === 0) {
      failures.push("quotes_without_events");
    }
  }
  return { ok: failures.length === 0, failures };
}
