import { config } from "dotenv";
import { runFactory045Cycle } from "@/domain/eval/factory-045/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const force = process.argv.includes("--force");
  const noDiscover = process.argv.includes("--no-discover");
  const result = await runFactory045Cycle({
    discover: !noDiscover,
    settle: true,
    forceDiscovery: force,
    maxSports: 12,
  });
  console.log(JSON.stringify({ ok: true, phase: "collect", ...result.totals, discovery: result.discovery, daily: result.daily }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
