import { loadExp032Config } from "@/domain/eval/incremental-032/config";
import type { Task032Report } from "@/domain/eval/incremental-032/lab";
import { FROZEN_031_SHA256 } from "@/domain/eval/incremental-032/types";

export function auditTask032(report: Task032Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp032Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion) failures.push("cfg_auto_promotion");
  if (cfg.real_money) failures.push("cfg_real_money");
  if (cfg.feature_selection_on_test) failures.push("feature_selection_on_test");
  if (cfg.holdout_for_training) failures.push("holdout_train");
  if (!cfg.test_locked) failures.push("test_unlocked");
  if (!cfg.holdout_locked) failures.push("holdout_unlocked");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.declared_best) failures.push("declared_best");
    if (report.auto_promotion) failures.push("auto_promotion");
    if (report.real_money) failures.push("real_money");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.test_used_for_selection) failures.push("test_selection");
    if (report.HOLDOUT_STATUS !== "EMPTY") failures.push("holdout_status");
    if (report.holdout_2020_plus !== 0) failures.push("holdout_2020");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (!report.fixture_mode && report.observed_sha256 !== FROZEN_031_SHA256) failures.push("sha_mismatch");
    if (report.qualified && report.verdict !== "EDGE_DEMONSTRATED") failures.push("qualified_without_edge");
    if (report.promoted_model != null && report.auto_promotion) failures.push("auto_promote_name");
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year}`);
    }
    if (report.fixture_mode && report.verdict !== "INSUFFICIENT_DATA") failures.push("fixture_overclaim");
    if (report.features.some((f) => f.class === "FORBIDDEN" && f.usable_t1h === "YES")) {
      failures.push("forbidden_used");
    }
  }
  return { ok: failures.length === 0, failures };
}
