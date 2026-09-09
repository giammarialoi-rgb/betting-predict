import { runTask028 } from "@/domain/eval/validation-028/lab";

async function main() {
  const report = await runTask028({ skipHeavy: false });
  console.log(
    JSON.stringify(
      {
        corpus_holdout_events: report.metrics.holdout_events,
        project_calendar_holdout_events: report.project_calendar_holdout_events,
        holdout_roi: report.holdout_capital.roi,
        holdout_bets: report.holdout_capital.bets,
        HOLDOUT_TOUCHED: report.HOLDOUT_TOUCHED,
        promotion: report.promotion,
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
