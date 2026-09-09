import { config } from "dotenv";
import { storeRoot038 } from "@/domain/eval/datalake-038/config";
import { collectOnce038, loadStore038 } from "@/domain/eval/datalake-038/collector";
import { liveHealth038 } from "@/domain/eval/datalake-038/health";
import { getOddsApiKey, resolveLiveAdapters038 } from "@/domain/eval/datalake-038/sources";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!getOddsApiKey()) {
    console.log(
      JSON.stringify(
        {
          COLLECTION_STATUS: "NOT_CONFIGURED",
          LIVE_ADAPTER: "READY",
          LIVE_SOURCE: "THE_ODDS_API",
          API_KEY: "missing",
          HISTORICAL_SEARCH: "CLOSED",
          DATA_LAKE: "READY",
          STRICT_PIPELINE: "READY",
          CAPITAL: "CLOSED",
          note: "THE_ODDS_API_KEY=<user must provide>",
        },
        null,
        2,
      ),
    );
    return;
  }
  const store = loadStore038(storeRoot038());
  const adapters = resolveLiveAdapters038();
  const result = await collectOnce038({ store, adapters });
  const health = liveHealth038(store);
  console.log(JSON.stringify({ COLLECTION_STATUS: health.collectionStatus, API_KEY: "configured", ...result, health }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
