import { config } from "dotenv";
import { auditTask038 } from "@/domain/eval/datalake-038/audit";
import { loadTask038ReportForUi, runTask038 } from "@/domain/eval/datalake-038/lab";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = loadTask038ReportForUi() ?? (await runTask038({ livePull: false }));
  const audit = auditTask038(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.FINAL_VERDICT,
        BETS: report.BETS,
        BANKROLL: report.BANKROLL,
        API_KEY: report.API_KEY,
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
