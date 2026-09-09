import { config } from "dotenv";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore044(permanentRoot044());
  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "learn",
        learning_candidates: store.learning.length,
        note: "No auto-promotion of MODEL_v1",
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
