import { config } from "dotenv";
import { auditTask039 } from "@/domain/eval/live-039/audit";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { isStale039UiReport, loadTask039ReportForUi, runTask039 } from "@/domain/eval/live-039/lab";
import { loadStore039 } from "@/domain/eval/live-039/store";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore039(storeRoot039());
  const cached = loadTask039ReportForUi();
  const report =
    cached && !isStale039UiReport(cached, store.events.length, store.quotes.length)
      ? cached
      : await runTask039({ livePull: false });
  const audit = auditTask039(report);
  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        failures: audit.failures,
        verdict: report.FINAL_VERDICT,
        BETS: report.BETS,
        BANKROLL: report.BANKROLL,
        API_KEY_CONFIGURED: report.API_KEY_CONFIGURED,
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
