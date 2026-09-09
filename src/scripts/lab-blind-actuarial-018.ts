import {
  runBlindActuarial018,
  writeTask018Artifacts,
} from "@/domain/eval/actuarial-018/lab";

async function main() {
  const report = await runBlindActuarial018();
  writeTask018Artifacts(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        final_verdict: report.final_verdict,
        events_analyzed: report.algorithm_status.events_analyzed,
        decisions: report.algorithm_status.decisions,
        bets: report.algorithm_status.bets,
        no_bet: report.algorithm_status.no_bet,
        strict_odds_usable: report.algorithm_status.events_usable_strict_odds,
        winner: report.winner,
        annual_preview: report.annual.slice(0, 5),
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
