import { buildObservatory053 } from "@/domain/eval/bankroll-053/observatory";
import { loadCoverage054, loadCurrentActivity054, readCatalogActivity054, runCatalogCycle054 } from "@/domain/eval/catalog-054/coverage";
import { createDirectaAdapter054 } from "@/services/sources/directa";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { buildNextEvents046 } from "@/domain/eval/control-046/dashboard";

/** Disk-only observatory with Directa/catalog triangulation. Zero Odds API from UI. */
export async function buildObservatory054(nowIso = new Date().toISOString()) {
  const base = buildObservatory053(nowIso);
  const root = permanentRoot044();
  let coverage = loadCoverage054(root);
  if (!coverage) {
    coverage = await runCatalogCycle054({ nowIso });
  }
  const health = createDirectaAdapter054().health();
  const activity = loadCurrentActivity054(root);
  const feed = readCatalogActivity054(root, 40);
  // Backend returns all unique upcoming events; UI paginates (no acquisition cap).
  const store = loadStore044(root);
  const next_events = buildNextEvents046(store, Date.parse(nowIso), Number.MAX_SAFE_INTEGER);

  return {
    ...base,
    next_events,
    catalog_054: {
      title: "GLOBAL EVENT COVERAGE",
      artificial_cap: false as const,
      coverage,
      directa: health,
      current_activity: activity ?? coverage.current_activity,
      activity_feed: feed,
      sources: coverage.sources,
      by_sport: coverage.by_sport,
      capital: "PAPER_ONLY" as const,
      real_money: false as const,
      paper_bankroll: 1000 as const,
      model_edge: "UNKNOWN" as const,
      api_calls_ui: 0 as const,
    },
    api_calls_ui: 0 as const,
  };
}

export type Observatory054 = Awaited<ReturnType<typeof buildObservatory054>>;
