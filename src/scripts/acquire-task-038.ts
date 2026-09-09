import { config } from "dotenv";
import { persistLake038, buildLake038 } from "@/domain/eval/datalake-038/lake";
import { getOddsApiKey } from "@/domain/eval/datalake-038/sources";
import { collectOnce038, loadStore038 } from "@/domain/eval/datalake-038/collector";
import { resolveLiveAdapters038 } from "@/domain/eval/datalake-038/sources";
import { storeRoot038 } from "@/domain/eval/datalake-038/config";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const lake = buildLake038();
  persistLake038(lake);
  const key = Boolean(getOddsApiKey());
  let collect: unknown = null;
  if (key) {
    const store = loadStore038(storeRoot038());
    collect = await collectOnce038({ store, adapters: resolveLiveAdapters038() });
  }
  console.log(
    JSON.stringify(
      {
        DATA_LAKE_STATUS: "READY",
        SOURCES_INGESTED: lake.sources.length,
        RESEARCH_EVENTS: lake.researchEvents,
        API_KEY: key ? "configured" : "missing",
        LIVE_ADAPTER: "READY",
        collect,
        note: key ? "first live batch appended" : "THE_ODDS_API_KEY=<user must provide>",
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
