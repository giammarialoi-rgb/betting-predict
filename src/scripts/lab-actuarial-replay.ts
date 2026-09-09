/**
 * CLI: pnpm lab:actuarial-replay
 */

import {
  formatActuarialReplayReport,
  runBlindActuarialBankrollLab,
} from "@/domain/eval/bankroll/blind-replay";

const lab = runBlindActuarialBankrollLab();
console.log(formatActuarialReplayReport(lab));
console.log(
  JSON.stringify(
    {
      experiment_id: lab.experiment_id,
      winner: lab.winner,
      auto_promotion: lab.auto_promotion,
      dataset_years_available: lab.dataset_years_available,
      policy_summaries: Object.fromEntries(
        Object.entries(lab.by_policy).map(([k, v]) => [
          k,
          {
            mean_final: v.aggregate.mean_final,
            median_final: v.aggregate.median_final,
            p_ruin: v.aggregate.p_ruin,
            max_drawdown: v.metrics.max_drawdown,
            mc_ruin: v.monte_carlo.ruin_probability,
            mc_kind: v.monte_carlo.kind,
          },
        ]),
      ),
      data_gaps: lab.data_gaps,
    },
    null,
    2,
  ),
);
