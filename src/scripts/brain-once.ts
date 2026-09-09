import { config } from "dotenv";
import { runBrainCycle051 } from "@/domain/eval/brain-051/cycle";
import { loadBrainState051, saveBrainState051 } from "@/domain/eval/brain-051/config";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const discover = process.argv.includes("--discover");
  const result = await runBrainCycle051({
    allowDiscover: discover,
    forceDiscover: discover,
  });
  const root = permanentRoot044();
  const state = loadBrainState051(root);
  saveBrainState051(root, { ...state, status: "IDLE", worker_pid: null });
  console.log(
    JSON.stringify(
      {
        ok: true,
        priority: result.priority,
        reason: result.reason,
        sleep_ms: result.sleep_ms,
        idle: result.idle,
        paper_bets_opened: result.paper_bets_opened,
        stats: result.massive?.stats ?? null,
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
