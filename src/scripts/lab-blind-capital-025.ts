import { runTask025 } from "@/domain/eval/turnaround-025/lab";

async function main() {
  const report = await runTask025({ allowNetwork: false, skipResearchCorpus: true });
  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        winner: report.winner,
        real_money: report.real_money,
        declared_edge: report.declared_edge,
        strict: report.metrics.events_strict,
        decisions: report.metrics.decisions,
        candidates: report.metrics.candidates,
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
