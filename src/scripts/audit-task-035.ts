import { auditTask035 } from "@/domain/eval/breakthrough-035/audit";
import { loadTask035ReportForUi, runTask035 } from "@/domain/eval/breakthrough-035/lab";

async function main() {
  const report = loadTask035ReportForUi() ?? (await runTask035({ skipHeavy: true }));
  const audit = auditTask035(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.verdict,
        STRICT_EVENTS: report.strict_events,
        STRICT_2020: report.strict_2020_plus,
        HOLDOUT_STATUS: report.HOLDOUT_STATUS,
        MODEL_READY: report.MODEL_READY,
        BETS: report.BETS,
        BANKROLL: report.BANKROLL,
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
