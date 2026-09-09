import { loadExp031Config } from "@/domain/eval/breakthrough-031/config";
import type { Task031Report } from "@/domain/eval/breakthrough-031/lab";
import { FROZEN_028_SHA256_031 } from "@/domain/eval/breakthrough-031/types";

export function auditTask031(report: Task031Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp031Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion) failures.push("cfg_auto_promotion");
  if (cfg.real_money) failures.push("cfg_real_money");
  if (cfg.masaniello_production) failures.push("cfg_masaniello");
  if (cfg.modify_frozen_028) failures.push("modify_028");
  if (cfg.modify_frozen_030_model) failures.push("modify_030");
  if (cfg.random_split) failures.push("random_split");
  if (cfg.holdout_for_training) failures.push("holdout_train");
  if (cfg.date_only_promoted_to_strict) failures.push("date_only_strict");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.declared_best) failures.push("declared_best");
    if (report.auto_promotion) failures.push("auto_promotion");
    if (report.real_money) failures.push("real_money");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.promotion !== "BLOCKED") failures.push("promotion");
    if (report.masaniello_production) failures.push("masaniello_production");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (!report.fixture_mode && report.observed_base_sha256 !== FROZEN_028_SHA256_031) {
      failures.push("base_sha_mismatch");
    }
    if (report.added_strict_events < 0) failures.push("negative_added");
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year}`);
      if (row.status === "INSUFFICIENT_DATA" && row.bets !== 0) failures.push(`bets_no_data_${row.year}`);
      if (row.status === "NO_EDGE" && row.bets !== 0) failures.push(`bets_no_edge_${row.year}`);
    }
    if (report.fixture_mode && report.verdict !== "INSUFFICIENT_DATA") failures.push("fixture_overclaim");
    if (report.fixture_mode && report.model_ready) failures.push("fixture_model_ready");
    if (!report.predictive_gate && report.capital_test) failures.push("capital_without_gate");
    if (report.verdict === "BREAKTHROUGH_EDGE" && report.winner !== null && !report.predictive_gate) {
      failures.push("winner_without_gate");
    }
    if (report.sources.some((s) => s.level === "DATE_ONLY" && s.strict_events > 0)) {
      failures.push("date_only_in_strict");
    }
  }
  return { ok: failures.length === 0, failures };
}
