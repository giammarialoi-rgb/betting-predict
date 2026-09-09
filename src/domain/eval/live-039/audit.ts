import { loadExp039Config } from "@/domain/eval/live-039/config";

export type AuditSlice039 = {
  winner: null;
  auto_promotion: boolean;
  real_money: boolean;
  BETS: number;
  BANKROLL: string;
  MODEL_READY: boolean;
  leakage: { throws: boolean }[];
  API_KEY_CONFIGURED: boolean;
  COLLECTION_STATUS: string;
  FINAL_VERDICT: string;
  QUOTE_OBSERVATIONS?: number;
  open_task_040: false;
};

export function auditTask039(report: AuditSlice039 | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp039Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_040) failures.push("open_040");
  if (cfg.historical_hunt) failures.push("historical_hunt");
  if (cfg.refit_market_devig) failures.push("refit");
  if (cfg.client_retrieved_as_quote) failures.push("client_ts");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (cfg.capital_gate) failures.push("capital_flag");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion || report.real_money) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (
      !report.API_KEY_CONFIGURED &&
      report.FINAL_VERDICT === "LIVE_NOT_CONFIGURED" &&
      report.COLLECTION_STATUS !== "BLOCKED"
    ) {
      failures.push("missing_key_not_blocked");
    }
    // Persisted live data may exist after a prior collect even if the current process
    // cannot see THE_ODDS_API_KEY; that must not force LIVE_NOT_CONFIGURED.
    if (report.FINAL_VERDICT === "LIVE_NOT_CONFIGURED" && (report.QUOTE_OBSERVATIONS ?? 0) > 0) {
      failures.push("live_not_configured_with_quotes");
    }
    if (report.open_task_040) failures.push("report_open_040");
  }
  return { ok: failures.length === 0, failures };
}
