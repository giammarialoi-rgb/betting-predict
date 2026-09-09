import { config } from "dotenv";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { mineErrorPatterns044 } from "@/domain/eval/permanent-044/error-patterns";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore044(permanentRoot044());
  const patterns = mineErrorPatterns044(store, new Date().toISOString());
  console.log(JSON.stringify({ ok: true, phase: "patterns", count: patterns.length, patterns }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
