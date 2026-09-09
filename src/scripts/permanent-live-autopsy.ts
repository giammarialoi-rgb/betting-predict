import { config } from "dotenv";
import { runFactory045Cycle } from "@/domain/eval/factory-045/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const r = await runFactory045Cycle({ discover: false, settle: true });
  console.log(JSON.stringify({ ok: true, phase: "autopsy", settlements: r.daily.TOTAL_SETTLEMENTS, autopsies: r.daily.TOTAL_AUTOPSIES }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
