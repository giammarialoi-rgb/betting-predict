import { config } from "dotenv";
import { loadExp038Config, storeRoot038 } from "@/domain/eval/datalake-038/config";
import { collectOnce038, loadStore038 } from "@/domain/eval/datalake-038/collector";
import { getOddsApiKey, resolveLiveAdapters038 } from "@/domain/eval/datalake-038/sources";

config({ path: ".env.local" });
config({ path: ".env" });

async function cycle(): Promise<void> {
  const store = loadStore038(storeRoot038());
  const adapters = resolveLiveAdapters038();
  const result = await collectOnce038({ store, adapters });
  console.log(JSON.stringify({ at: new Date().toISOString(), API_KEY: "configured", ...result }));
}

async function main() {
  if (!getOddsApiKey()) {
    console.log(
      JSON.stringify({
        loop: false,
        COLLECTION_STATUS: "NOT_CONFIGURED",
        LIVE_ADAPTER: "READY",
        note: "THE_ODDS_API_KEY=<user must provide>",
      }),
    );
    return;
  }
  const cfg = loadExp038Config();
  console.log(JSON.stringify({ loop: true, poll_interval_ms: cfg.poll_interval_ms, store: storeRoot038() }));
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
