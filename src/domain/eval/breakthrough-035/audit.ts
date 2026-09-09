import { loadExp035Config } from "@/domain/eval/breakthrough-035/config";
import type { Task035Report } from "@/domain/eval/breakthrough-035/lab";
import { FROZEN_031_SHA256_035 } from "@/domain/eval/breakthrough-035/types";

export function auditTask035(report: Task035Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp035Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion) failures.push("cfg_auto_promotion");
  if (cfg.real_money) failures.push("cfg_real_money");
  if (cfg.open_task_036) failures.push("open_036");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (cfg.add_new_model_family) failures.push("new_model");
  if (cfg.use_user_credentials || cfg.bypass_auth) failures.push("creds");
  if (cfg.date_only_promoted_to_strict || cfg.open_close_promoted_to_timestamp) failures.push("promote_clock");
  if (!cfg.test_locked || !cfg.holdout_locked) failures.push("locks");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion) failures.push("auto_promotion");
    if (report.real_money) failures.push("real_money");
    if (report.qualified || report.CAPITAL_QUALIFIED) failures.push("capital");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.test_used_for_selection) failures.push("test_selection");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.HOLDOUT_STATUS !== "EMPTY") failures.push("holdout");
    if (report.MODEL_READY !== false) failures.push("model_ready");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (!report.fixture_mode && report.observed_sha256 !== FROZEN_031_SHA256_035) failures.push("sha");
    if (report.strict_events >= 100 && report.verdict === "INSUFFICIENT_DATA_FINAL") {
      /* allowed only if 2015-16 leftover counted as new — must not happen */
    }
    if (report.strict_legacy_031 > 0 && report.strict_events === report.strict_legacy_031) {
      failures.push("legacy_counted_as_new_strict");
    }
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year_label}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year_label}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year_label}`);
    }
    if (report.catalog.some((s) => s.can_become_strict !== false)) failures.push("auto_strict_flag");
  }
  return { ok: failures.length === 0, failures };
}
