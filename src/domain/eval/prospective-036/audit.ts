import { loadExp036Config } from "@/domain/eval/prospective-036/config";
import type { Task036Report } from "@/domain/eval/prospective-036/lab";

export function auditTask036(report: Task036Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp036Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_037_historical) failures.push("open_037");
  if (cfg.use_historical_hunt) failures.push("historical_hunt");
  if (cfg.invent_timestamps || cfg.synthetic_data) failures.push("synthetic");
  if (cfg.capital_gate) failures.push("capital_flag");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion || report.real_money) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.MODEL_READY) failures.push("model_ready");
    if (report.EDGE) failures.push("edge");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (report.COLLECTION_STATUS === "READY" && report.STRICT_EVENTS === 0 && report.QUOTE_OBSERVATIONS === 0) {
      failures.push("ready_without_observations");
    }
  }
  return { ok: failures.length === 0, failures };
}
