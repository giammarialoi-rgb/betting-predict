import {
  formatTask017Report,
  runBlindActuarial017,
  writeTask017Audits,
} from "@/domain/eval/actuarial-017/lab";

const report = runBlindActuarial017();
writeTask017Audits(report);
console.log(formatTask017Report(report));
console.log(
  JSON.stringify(
    {
      experiment_id: report.experiment_id,
      algorithm_status: report.algorithm_status.status,
      verdict: report.algorithm_status.verdict,
      HOLDOUT_TOUCHED: report.HOLDOUT_TOUCHED,
      winner: report.winner,
      primary_events: report.data_quality.primary_events,
      secondary: report.data_quality.secondary,
    },
    null,
    2,
  ),
);
