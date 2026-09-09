import { auditTask033 } from "@/domain/eval/market-033/audit";
import { loadTask033ReportForUi, runTask033 } from "@/domain/eval/market-033/lab";

async function main() {
  const report = loadTask033ReportForUi() ?? (await runTask033({ skipHeavy: true }));
  const audit = auditTask033(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.verdict,
        HOLDOUT_STATUS: report.HOLDOUT_STATUS,
        qualified: report.qualified,
        BET_COUNT: report.BET_COUNT,
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
