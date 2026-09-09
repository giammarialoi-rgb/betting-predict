import { config } from "dotenv";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import { liveHealth039 } from "@/domain/eval/live-039/health";
import { revealOnce039 } from "@/domain/eval/live-039/settle";
import { createLiveOddsAdapter039, getOddsApiKey } from "@/domain/eval/live-039/sources";
import { recoverLocks040 } from "@/domain/eval/recover-040/lock";
import { inventory040 } from "@/domain/eval/recover-040/inventory";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore039(storeRoot039());
  const inv0 = inventory040(store);
  const configured = Boolean(getOddsApiKey());
  let collectResult: Record<string, unknown> | null = null;
  if (configured) {
    collectResult = await collectOnce039({ store, adapters: [createLiveOddsAdapter039({})] });
    await revealOnce039({ store });
  }
  const lock = recoverLocks040(store);
  const inv = inventory040(store);
  const health = liveHealth039(store);
  console.log(
    JSON.stringify(
      {
        COLLECTION_STATUS: inv.QUOTE_OBSERVATIONS > 0 ? "COLLECTING" : configured ? "READY" : "BLOCKED",
        API_KEY_CONFIGURED: configured,
        consumed_store: storeRoot039(),
        before: {
          events: inv0.EVENTS_DISCOVERED,
          quotes: inv0.QUOTE_OBSERVATIONS,
        },
        collect: collectResult,
        recover_locked: lock.locked,
        after: {
          events: inv.EVENTS_DISCOVERED,
          quotes: inv.QUOTE_OBSERVATIONS,
          locked: lock.rows.length,
          t1h_complete: inv.EVENTS_WITH_T1H_COMPLETE_1X2,
        },
        health,
        note:
          inv.QUOTE_OBSERVATIONS > 0 && !configured
            ? "Persisted TASK 039 store recovered without live key in this process."
            : undefined,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
