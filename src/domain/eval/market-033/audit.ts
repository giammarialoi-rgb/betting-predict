import { loadExp033Config } from "@/domain/eval/market-033/config";
import type { Task033Report } from "@/domain/eval/market-033/lab";
import { FROZEN_031_SHA256, FROZEN_032_FINGERPRINT } from "@/domain/eval/market-033/types";

export function auditTask033(report: Task033Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp033Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion) failures.push("cfg_auto_promotion");
  if (cfg.real_money) failures.push("cfg_real_money");
  if (cfg.retest_task_032) failures.push("retest_032");
  if (cfg.open_task_034) failures.push("open_034");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (cfg.immutable_1x2_ref.copied) failures.push("copied_031");
  if (!cfg.test_locked || !cfg.holdout_locked) failures.push("locks");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion) failures.push("auto_promotion");
    if (report.real_money) failures.push("real_money");
    if (report.qualified) failures.push("qualified_without_edge");
    if (report.BET_COUNT !== 0) failures.push("bets");
    if (report.test_used_for_selection) failures.push("test_selection");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.HOLDOUT_STATUS !== "EMPTY") failures.push("holdout_status");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (!report.fixture_mode && report.observed_031_sha256 !== FROZEN_031_SHA256) failures.push("sha_031");
    if (report.carry_032_fingerprint !== FROZEN_032_FINGERPRINT) failures.push("fp_032");
    if (report.verdict === "EDGE_CONFIRMED") failures.push("auto_confirmed");
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year_label}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year_label}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year_label}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
