import { config } from "dotenv";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const result = await runPermanent044Cycle({ runCollector042: false });
  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "monitor",
        note: "POST_LOCK_UPDATE_SUMMARY appended; LOCKED predictions immutable",
        snapshotsObserved: result.snapshotsObserved,
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
