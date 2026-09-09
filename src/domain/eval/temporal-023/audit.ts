import { loadExp023Config } from "@/domain/eval/temporal-023/config";
import type { Task023Report } from "@/domain/eval/temporal-023/lab";
import { leakL10StrategyChosenFromPnl } from "@/domain/eval/temporal-023/leakage";
import { MATCH_ODDS_FIXTURE_SHA256 } from "@/domain/eval/temporal-023/types";

export function auditTask023(report: Task023Report | null): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const cfg = loadExp023Config();
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
    if (report.counts.bets !== 0) failures.push("bets");
    if (report.official_bulk_acquired) failures.push("claimed_official_bulk");
    if (report.fixture.sha256 !== MATCH_ODDS_FIXTURE_SHA256) failures.push("fixture_hash");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage_miss");
    if (report.market_row.model_ready) failures.push("model_ready");
    if (report.HOLDOUT_TOUCHED) failures.push("holdout");
    for (const row of report.annual) {
      if (row.strict_events < 100 && row.status === "VALID") {
        failures.push(`valid_without_100_${row.year}`);
      }
      if (row.end === 1000 && row.status !== "VALID") {
        failures.push(`silent_1000_${row.year}`);
      }
      if (row.strict_events < 100 && row.end != null) {
        failures.push(`end_bankroll_without_sample_${row.year}`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}
