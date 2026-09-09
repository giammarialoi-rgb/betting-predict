import { loadExp029Config } from "@/domain/eval/incremental-029/config";
import type { Task029Report } from "@/domain/eval/incremental-029/lab";

export function auditTask029(report: Task029Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp029Config();
  if (cfg.feature_selection_on_test) failures.push("feature_selection_on_test");
  if (cfg.random_split) failures.push("random_split");
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.declared_best) failures.push("declared_best");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout_touched");
    if (report.promotion !== "BLOCKED") failures.push("promotion");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    for (const row of report.annual) {
      if (row.start !== 1000) failures.push(`start_${row.year}`);
      if (row.bets === 0 && row.end != null) failures.push(`silent_end_${row.year}`);
      if (row.end === 1000 && row.bets === 0) failures.push(`silent_1000_${row.year}`);
    }
    if (report.fixture_mode && report.verdict !== "INSUFFICIENT_DATA") {
      failures.push("fixture_overclaim");
    }
    if (report.sample_assessment) {
      const g = report.sample_assessment.evidenceGraph;
      const items = [...g.supporting, ...g.contradicting, ...g.contextual];
      if (items.some((i) => i.sourceReliability !== null)) failures.push("invented_reliability");
      if (g.insufficient.length === 0 && g.supporting.length === 0) failures.push("empty_evidence");
    }
  }
  return { ok: failures.length === 0, failures };
}
