/**
 * Light status for UI — runs lab once (cached).
 */

import {
  formatActuarialReplayReport,
  runBlindActuarialBankrollLab,
} from "@/domain/eval/bankroll/blind-replay";

let cached: ReturnType<typeof runBlindActuarialBankrollLab> | null = null;

export function getActuarialBankrollLabReport() {
  if (!cached) cached = runBlindActuarialBankrollLab();
  return cached;
}

export function getActuarialBankrollLabStatus() {
  const lab = getActuarialBankrollLabReport();
  const capped = lab.by_policy.risk_capped_kelly;
  const okYears =
    capped?.years.filter((y) => y.status === "OK") ?? [];
  return {
    experiment: lab.experiment_id,
    dataset: "real_truth_lab_v1_e0_2019_2024",
    years_tested: okYears.map((y) => y.year),
    years_blocked_insufficient: lab.years
      .filter((y) => y.policy === "flat" && y.status === "INSUFFICIENT_HISTORY")
      .map((y) => y.year),
    initial_bankroll: 1000,
    policy: "risk_policy_v1",
    events:
      okYears.reduce((a, y) => a + y.events_seen, 0) /
      Math.max(1, Object.keys(lab.by_policy).length),
    mean_final_capped: capped?.aggregate.mean_final ?? null,
    return_mean_capped:
      capped?.aggregate.mean_final != null
        ? (capped.aggregate.mean_final - 1000) / 1000
        : null,
    max_drawdown_capped: capped?.metrics.max_drawdown ?? null,
    risk_of_ruin_capped: capped?.aggregate.p_ruin ?? null,
    comparison: Object.fromEntries(
      Object.entries(lab.by_policy).map(([k, v]) => [
        k,
        {
          mean_final: v.aggregate.mean_final,
          max_drawdown: v.metrics.max_drawdown,
          p_ruin: v.aggregate.p_ruin,
        },
      ]),
    ),
    winner: lab.winner,
    auto_promotion: lab.auto_promotion,
    real_money: lab.real_money,
    report_text: formatActuarialReplayReport(lab),
  };
}
