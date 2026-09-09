import { config } from "dotenv";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const withApi = process.argv.includes("--api");
  const result = await runPermanent044Cycle({ runCollector042: withApi });
  console.log(JSON.stringify({ ok: true, phase: "collect", withApi, ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
