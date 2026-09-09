import { config } from "dotenv";
import { runMassive049Cycle } from "@/domain/eval/factory-049/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const result = await runMassive049Cycle({
    discover,
    settle: false,
    forceDiscovery: discover,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        stats: result.stats,
        discovery: result.discovery,
        skipped_discovery: result.skipped_discovery,
        note: "Massive multi-sport lab — CAPITAL CLOSED — use --discover under budget firewall",
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
