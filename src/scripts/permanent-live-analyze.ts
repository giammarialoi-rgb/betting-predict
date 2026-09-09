import { config } from "dotenv";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore044(permanentRoot044());
  const r = analyzeAllLabB045({ store, nowIso: new Date().toISOString() });
  console.log(JSON.stringify({ ok: true, phase: "analyze", ...r, total_events: store.events.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
