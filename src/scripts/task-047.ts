import { config } from "dotenv";
import { runCoverage047Cycle } from "@/domain/eval/factory-047/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const force = process.argv.includes("--force");
  const result = await runCoverage047Cycle({
    discover,
    settle: false,
    forceDiscovery: force || discover,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        tennis_status: result.tennis_status,
        horizons: result.horizons,
        markets: result.markets,
        skipped_discovery: result.skipped_discovery,
        totals: result.factory?.totals,
        note: "Default is disk-only. Use --discover to call Odds API under budget firewall.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
