import { config } from "dotenv";
import { runSettle045 } from "@/domain/eval/factory-045/settle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const r = await runSettle045({});
  console.log(JSON.stringify({ ok: true, phase: "settle", ...r }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
