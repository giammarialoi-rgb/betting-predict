import { loadExp024Config } from "@/domain/eval/attack-024/config";
import type { Task024Report } from "@/domain/eval/attack-024/lab";
import { leakEDuplicateDistribution } from "@/domain/eval/attack-024/leakage";
import { STRICT_EVENT_GATE } from "@/domain/eval/attack-024/types";

export function auditTask024(report: Task024Report | null): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  loadExp024Config();
  leakEDuplicateDistribution(1);
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.scientific.best_model !== null) failures.push("best_model");
    if (report.metrics.blind_bets !== 0) failures.push("bets");
    if (report.metrics.edge_demonstrated) failures.push("edge");
    if (report.walk_forward.replay_launched && report.metrics.strict_events < STRICT_EVENT_GATE) {
      failures.push("replay_below_gate");
    }
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout");
    if (report.soccer.known_at_before !== 0) failures.push("soccer_known_at_before");
    if (report.strict_ledger.some((r) => r.strict !== "YES")) failures.push("ledger_non_strict");
    if (report.strict_ledger.some((r) => r.delta_kickoff_sec >= 0)) failures.push("ledger_not_before");
    for (const row of report.annual) {
      if (row.strict_events < STRICT_EVENT_GATE && row.status === "VALID") {
        failures.push(`valid_without_100_${row.year}`);
      }
      if (row.end_bankroll === 1000 && row.status !== "VALID") {
        failures.push(`silent_1000_${row.year}`);
      }
      if (row.strict_events < STRICT_EVENT_GATE && row.end_bankroll != null) {
        failures.push(`end_bankroll_without_sample_${row.year}`);
      }
    }
    const soccerGate = report.gates.find((g) => g.sourceId === "soccer-dataset");
    if (soccerGate?.STRICT_USABLE) failures.push("soccer_promoted_strict");
  }
  return { ok: failures.length === 0, failures };
}
