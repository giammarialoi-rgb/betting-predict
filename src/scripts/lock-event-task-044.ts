import { config } from "dotenv";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const result = await runPermanent044Cycle({ runCollector042: false });
  const store = loadStore044(permanentRoot044());
  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "lock",
        locksWritten: result.locksWritten,
        locked_total: store.locks.length,
        note: "Lab B locks mirror Lab A T−1h hashes; Lab A decisions.jsonl untouched",
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
