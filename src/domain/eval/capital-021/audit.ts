import { loadExp021Config } from "@/domain/eval/capital-021/config";
import type { Task021Report } from "@/domain/eval/capital-021/lab";
import { leakL10StrategyChosenFromPnl } from "@/domain/eval/capital-021/leakage";

export function auditTask021(report: Task021Report | null): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const cfg = loadExp021Config();
  leakL10StrategyChosenFromPnl({
    selectedFromPnl: cfg.strategy_selected_from_pnl,
    autoPromote: cfg.auto_promote,
    best: cfg.winner,
  });
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.verdict !== "NO_DEMONSTRATED_EDGE") failures.push("verdict");
    if (report.scientific.best_model !== null) failures.push("best_model");
    if (report.scientific.best_risk_policy !== null) failures.push("best_policy");
    if (report.counts.bets === 0) {
      for (const row of report.annual) {
        if (row.status === "VALID") failures.push(`valid_without_bets_${row.year}`);
        if (row.final === 1000 && row.status !== "VALID") {
          failures.push(`silent_1000_${row.year}`);
        }
      }
    }
    const annualBets = report.annual.reduce((s, a) => s + a.bets, 0);
    if (annualBets !== report.counts.bets) failures.push("annual_bets");
  }
  return { ok: failures.length === 0, failures };
}
