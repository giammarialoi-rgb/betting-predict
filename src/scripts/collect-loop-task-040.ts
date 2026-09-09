import { config } from "dotenv";
import { loadExp039Config, storeRoot039 } from "@/domain/eval/live-039/config";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import { revealOnce039 } from "@/domain/eval/live-039/settle";
import { createLiveOddsAdapter039, getOddsApiKey } from "@/domain/eval/live-039/sources";
import { recoverLocks040 } from "@/domain/eval/recover-040/lock";
import { inventory040 } from "@/domain/eval/recover-040/inventory";
import { settledVerified039 } from "@/domain/eval/live-039/health";

config({ path: ".env.local" });
config({ path: ".env" });

async function cycle(): Promise<void> {
  const store = loadStore039(storeRoot039());
  const result = await collectOnce039({ store, adapters: [createLiveOddsAdapter039({})] });
  const reveal = await revealOnce039({ store });
  const lock = recoverLocks040(store);
  const inv = inventory040(store);
  const settled = settledVerified039(store);
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      API_KEY_CONFIGURED: true,
      ...result,
      reveal,
      recover_locked: lock.locked,
      LOCKED_DECISIONS: store.decisions.length,
      SETTLED_EVENTS: settled,
      MISSING_TO_100: Math.max(0, 100 - settled),
      EVENTS_DISCOVERED: inv.EVENTS_DISCOVERED,
      QUOTE_OBSERVATIONS: inv.QUOTE_OBSERVATIONS,
      note: "events=0 means no new catalog inserts this pull, not empty store",
    }),
  );
}

async function main() {
  if (!getOddsApiKey()) {
    console.log(
      JSON.stringify({
        loop: false,
        COLLECTION_STATUS: "BLOCKED",
        FINAL_VERDICT: "LIVE_NOT_CONFIGURED",
        note: "THE_ODDS_API_KEY=<user must provide>",
      }),
    );
    return;
  }
  const cfg = loadExp039Config();
  console.log(JSON.stringify({ loop: true, poll_interval_ms: cfg.poll_interval_ms, store: storeRoot039(), task: "040/041" }));
  await cycle();
  const timer = setInterval(() => {
    cycle().catch((err) => console.error(err));
  }, cfg.poll_interval_ms);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
