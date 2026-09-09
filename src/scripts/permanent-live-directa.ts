import { config } from "dotenv";
import { createDirectaAdapter054 } from "@/services/sources/directa";
import { runCatalogCycle054 } from "@/domain/eval/catalog-054/coverage";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const mode = process.argv[2] ?? "once";
  const adapter = createDirectaAdapter054();
  if (mode === "status") {
    console.log(JSON.stringify(adapter.health(), null, 2));
    return;
  }
  if (mode === "discover") {
    const sports = await adapter.discoverSports();
    const events = await adapter.discoverEvents({ horizon: "NEXT_24H" });
    console.log(JSON.stringify({ health: adapter.health(), sports, events: { n: events.events.length, status: events.status } }, null, 2));
    return;
  }
  // once — safe catalog cycle (Directa stays DISABLED_BY_POLICY unless explicitly enabled)
  const coverage = await runCatalogCycle054();
  console.log(
    JSON.stringify(
      {
        ok: true,
        directa_status: coverage.directa_status,
        directa_policy_status: coverage.directa_policy_status,
        catalog_events: coverage.catalog_events,
        odds_events: coverage.odds_events,
        matched: coverage.matched,
        artificial_cap: coverage.artificial_cap,
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
