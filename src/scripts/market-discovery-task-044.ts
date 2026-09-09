import { config } from "dotenv";
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { loadStore044, appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { normalizeMarketType044 } from "@/domain/eval/permanent-044/taxonomy";
import { join } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const root = permanentRoot044();
  ensurePermanentDirs044(root);
  const store = loadStore044(root);
  const markets = new Map<string, number>();
  for (const q of store.quotes) {
    const tax = normalizeMarketType044(q.market, "soccer");
    const k = `${tax.market_group}/${tax.market_type}`;
    markets.set(k, (markets.get(k) ?? 0) + 1);
  }
  const rows = [...markets.entries()].map(([k, n]) => ({ market: k, observations: n, stage: "MARKET_DISCOVERED" }));
  appendJsonl044(join(root, "markets.jsonl"), {
    kind: "MARKET_DISCOVERY_SUMMARY",
    at: new Date().toISOString(),
    rows,
  });
  console.log(JSON.stringify({ ok: true, phase: "market_discovery", markets: rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
