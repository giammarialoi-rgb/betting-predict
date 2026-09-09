import { config } from "dotenv";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore044(permanentRoot044());
  const r = analyzeAllLabB045({ store, nowIso: new Date().toISOString() });
  const after = loadStore044(permanentRoot044());
  console.log(JSON.stringify({ ok: true, phase: "lock", locked_new: r.locked, locks_total: after.locks.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
