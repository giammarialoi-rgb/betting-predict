import { runTask026 } from "@/domain/eval/bottleneck-026/lab";

async function main() {
  const report = await runTask026({ allowNetwork: false, skipHeavy: true });
  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        success_band: report.success_band,
        winner: report.winner,
        real_money: report.real_money,
        declared_edge: report.declared_edge,
        model_ready: report.model_ready,
        exact: report.metrics.exact_timestamp_events,
        verified: report.metrics.temporally_verified_events,
        capital_strict: report.metrics.capital_strict_events,
        decisions: report.metrics.decisions,
        bets: report.metrics.bets,
        decision: report.blind.decision,
        annual_2017: report.annual.find((r) => r.year === 2017),
        silent_1000: report.annual.some((r) => r.end === 1000),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
