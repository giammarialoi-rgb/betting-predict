import { loadExp022Config } from "@/domain/eval/recovery-022/config";
import type { Task022Report } from "@/domain/eval/recovery-022/lab";
import { leakL10StrategyChosenFromPnl } from "@/domain/eval/recovery-022/leakage";

export function auditTask022(report: Task022Report | null): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const cfg = loadExp022Config();
  leakL10StrategyChosenFromPnl({
    selectedFromPnl: cfg.strategy_selected_from_pnl,
    autoPromote: cfg.auto_promote,
    best: cfg.winner,
  });
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promote) failures.push("auto_promote");
    if (report.real_money) failures.push("real_money");
    if (report.scientific.best_model !== null) failures.push("best_model");
    if (report.scientific.best_risk_policy !== null) failures.push("best_policy");
    if (report.series.usable_strict !== 0) failures.push("series_strict");
    if (report.scientific.strict_quotes !== 0) failures.push("strict_quotes");
    if (report.counts.bets !== 0) failures.push("bets");
    for (const row of report.annual) {
      if (row.strict_events === 0 && row.status === "VALID") {
        failures.push(`valid_without_strict_${row.year}`);
      }
      if (row.end_bankroll === 1000 && row.status !== "VALID") {
        failures.push(`silent_1000_${row.year}`);
      }
      if (row.strict_events === 0 && row.end_bankroll != null) {
        failures.push(`end_bankroll_without_strict_${row.year}`);
      }
    }
    if (report.market_rows.some((m) => m.model_ready)) failures.push("model_ready");
  }
  return { ok: failures.length === 0, failures };
}
