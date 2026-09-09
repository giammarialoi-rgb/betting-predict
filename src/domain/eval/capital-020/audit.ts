/**
 * TASK 020 integrity audit — no replay mutation, no retro optimization.
 */

import { loadExp020Config, assertHoldoutUntouched } from "@/domain/eval/capital-020/config";
import { STRICT_CAPITAL_CLASSES } from "@/domain/eval/capital-020/types";
import { uniqueUpstreamClusters } from "@/domain/eval/capital-020/lineage";
import type { Task020Report } from "@/domain/eval/capital-020/report-types";
import { assertNoRetroactiveOptimization } from "@/domain/eval/actuarial-018/integrity";

export type Audit020 = {
  ok: boolean;
  failures: string[];
  experiment_id: string;
  frozen_model: string;
  holdout_years: number[];
};

export function auditTask020(report: Task020Report | null): Audit020 {
  const failures: string[] = [];
  const cfg = loadExp020Config();
  assertNoRetroactiveOptimization({
    retroactive_optimization: cfg.retroactive_optimization,
    parameters_frozen: true,
  });
  assertHoldoutUntouched({
    holdoutYears: cfg.holdout_years,
    usedHoldoutForSelection: false,
  });
  if (cfg.frozen_model_id !== "frequency") failures.push("frozen_model_changed");
  if (STRICT_CAPITAL_CLASSES.includes("DATE_ONLY")) failures.push("date_only_in_strict");
  if (STRICT_CAPITAL_CLASSES.includes("DATASET_WINDOW")) failures.push("dataset_window_in_strict");
  if (STRICT_CAPITAL_CLASSES.includes("CLOSE_TIME_EXACT")) {
    failures.push("close_in_strict_capital");
  }
  if (report) {
    if (report.winner !== null) failures.push("winner_not_null");
    if (report.auto_promote !== false) failures.push("auto_promote");
    if (report.real_money !== false) failures.push("real_money");
    if (report.HOLDOUT_TOUCHED !== false) failures.push("holdout_touched");
    if (report.verdict !== "NO_DEMONSTRATED_EDGE") failures.push("verdict_claim");
    if (report.counts.bets === 0) {
      for (const row of report.annual) {
        if (row.final === 1000 && row.data_status === "OK") {
          failures.push(`silent_1000_${row.year}`);
        }
        if (row.bets === 0 && row.data_status === "OK") {
          failures.push(`ok_without_bets_${row.year}`);
        }
      }
    }
    const clusters = uniqueUpstreamClusters(report.lineage.rows);
    const fd = report.lineage.rows.filter((r) => r.upstreamCluster === "football-data-co-uk");
    if (fd.length > 1 && clusters.filter((c) => c === "football-data-co-uk").length !== 1) {
      failures.push("lineage_cluster_split");
    }
    const annualBets = report.annual.reduce((s, a) => s + a.bets, 0);
    if (annualBets !== report.counts.bets) failures.push("annual_bets_incoherent");
    const annualDec = report.annual.reduce((s, a) => s + a.decisions, 0);
    if (annualDec !== report.counts.decisions) failures.push("annual_decisions_incoherent");
    if (report.multiple_testing.any_significant) failures.push("undeclared_significance");
  }
  return {
    ok: failures.length === 0,
    failures,
    experiment_id: cfg.experiment_id,
    frozen_model: cfg.frozen_model_id,
    holdout_years: cfg.holdout_years,
  };
}
