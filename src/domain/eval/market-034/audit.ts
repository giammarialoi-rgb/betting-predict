import { loadExp034Config } from "@/domain/eval/market-034/config";
import type { Task034Report } from "@/domain/eval/market-034/lab";
import { FROZEN_031_SHA256_034 } from "@/domain/eval/market-034/types";

export function auditTask034(report: Task034Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp034Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion) failures.push("cfg_auto_promotion");
  if (cfg.real_money) failures.push("cfg_real_money");
  if (cfg.add_elo || cfg.add_form || cfg.add_h2h || cfg.add_news) failures.push("forbidden_features");
  if (cfg.open_task_035) failures.push("open_035");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (!cfg.test_locked || !cfg.holdout_locked) failures.push("locks");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion) failures.push("auto_promotion");
    if (report.real_money) failures.push("real_money");
    if (report.qualified || report.CAPITAL_QUALIFIED) failures.push("capital");
    if (report.BET_COUNT !== 0) failures.push("bets");
    if (report.test_used_for_selection) failures.push("test_selection");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.HOLDOUT_STATUS !== "EMPTY") failures.push("holdout");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (!report.fixture_mode && report.observed_sha256 !== FROZEN_031_SHA256_034) failures.push("sha");
    if (report.CLV !== null) failures.push("invented_clv");
    if (report.CLV_STATUS !== "NOT_COMPUTABLE_LAST_QUOTE_IS_AS_OF") failures.push("clv_status");
    if (report.hypothesis_registry.some((h) => !h.created_before_test)) failures.push("posthoc_h");
    if (report.fixture_mode && report.verdict !== "INSUFFICIENT_DATA") failures.push("fixture_overclaim");
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year_label}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year_label}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year_label}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
