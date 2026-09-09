import { config } from "dotenv";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { collectOnce039, loadStore039 } from "@/domain/eval/live-039/collector";
import { liveHealth039 } from "@/domain/eval/live-039/health";
import { revealOnce039 } from "@/domain/eval/live-039/settle";
import { createLiveOddsAdapter039, getOddsApiKey } from "@/domain/eval/live-039/sources";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!getOddsApiKey()) {
    console.log(
      JSON.stringify(
        {
          COLLECTION_STATUS: "BLOCKED",
          FINAL_VERDICT: "LIVE_NOT_CONFIGURED",
          API_KEY_CONFIGURED: false,
          LIVE_ADAPTER: "READY",
          note: "THE_ODDS_API_KEY=<user must provide>",
        },
        null,
        2,
      ),
    );
    return;
  }
  const store = loadStore039(storeRoot039());
  const result = await collectOnce039({ store, adapters: [createLiveOddsAdapter039({})] });
  const reveal = await revealOnce039({ store });
  const health = liveHealth039(store);
  console.log(JSON.stringify({ COLLECTION_STATUS: health.collector_status, API_KEY_CONFIGURED: true, ...result, reveal, health }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
