import { auditTask034 } from "@/domain/eval/market-034/audit";
import { loadTask034ReportForUi, runTask034 } from "@/domain/eval/market-034/lab";

async function main() {
  const report = loadTask034ReportForUi() ?? (await runTask034({ skipHeavy: true }));
  const audit = auditTask034(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.verdict,
        HOLDOUT_STATUS: report.HOLDOUT_STATUS,
        qualified: report.qualified,
        BET_COUNT: report.BET_COUNT,
        winner: report.winner,
        auto_promotion: report.auto_promotion,
        real_money: report.real_money,
      },
      null,
      2,
    ),
  );
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
