import { config } from "dotenv";
import { createAllSourceAdapters055 } from "@/services/sources/registry-055";
import { runMultiSourceCycle055 } from "@/domain/eval/catalog-055/cycle";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const mode = process.argv[2] ?? "once";
  const adapters = createAllSourceAdapters055();
  if (mode === "status") {
    console.log(JSON.stringify(adapters.map((a) => a.health()), null, 2));
    return;
  }
  if (mode === "discover") {
    const out = [];
    for (const a of adapters) {
      const d = await a.discoverEvents({ horizon: "NEXT_24H" });
      out.push({ source: a.sourceId, status: d.status, events: d.events.length, error: d.error });
    }
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const coverage = await runMultiSourceCycle055();
  console.log(
    JSON.stringify(
      {
        ok: true,
        artificial_cap: coverage.artificial_cap,
        universal_events: coverage.universal_events,
        odds_available: coverage.odds_available,
        sources: coverage.source_health.map((s) => ({ id: s.sourceId, status: s.status, events: s.events_discovered })),
        current_activity: coverage.current_activity,
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
