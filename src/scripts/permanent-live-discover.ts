import { config } from "dotenv";
import { runDiscover049 } from "@/domain/eval/factory-049/discover";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const force = process.argv.includes("--force");
  const result = await runDiscover049({ force });
  console.log(JSON.stringify({ ok: true, phase: "discover_049", ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
