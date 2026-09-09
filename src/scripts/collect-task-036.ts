import { config } from "dotenv";
import { collectOnce036 } from "@/domain/eval/prospective-036/collector";
import { storeRoot036 } from "@/domain/eval/prospective-036/config";
import { resolveLiveAdapters } from "@/domain/eval/prospective-036/sources";
import { loadStore036 } from "@/domain/eval/prospective-036/store";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const store = loadStore036(storeRoot036());
  const adapters = resolveLiveAdapters();
  const result = await collectOnce036({ store, adapters });
  const configured = adapters.filter((a) => a.configured()).map((a) => a.id);
  console.log(
    JSON.stringify(
      {
        configured: configured.length ? configured : [],
        ...result,
        store: storeRoot036(),
        note:
          configured.length === 0
            ? "SOURCE_UNAVAILABLE — set THE_ODDS_API_KEY for live odds. No synthetic quotes written."
            : "append-only cycle complete",
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
