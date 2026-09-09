import { loadExp037Config } from "@/domain/eval/harvest-037/config";
import type { Task037Report } from "@/domain/eval/harvest-037/lab";

export function auditTask037(report: Task037Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp037Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.open_task_038) failures.push("open_038");
  if (cfg.count_legacy_031_as_new_strict) failures.push("legacy_as_new");
  if (cfg.real_money || cfg.auto_promotion) failures.push("money");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.MODEL_READY) failures.push("model_ready");
    if (report.CAPITAL_QUALIFIED) failures.push("capital");
    if (report.STRICT_EVENTS !== 0) failures.push("new_strict_nonzero_without_clock");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (report.FINAL_VERDICT !== "FINAL_BLOCKER") failures.push("verdict");
  }
  return { ok: failures.length === 0, failures };
}
