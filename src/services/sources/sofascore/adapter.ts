import { createPolicyGatedCatalogAdapter055 } from "@/services/sources/policy-stub";
import type { SportsSourceAdapter } from "@/services/sources/types";

export function createSofascoreAdapter055(): SportsSourceAdapter {
  return createPolicyGatedCatalogAdapter055({
    sourceId: "SOFASCORE",
    enabledEnv: "SOFASCORE_ENABLED",
    scrapingEnv: "SOFASCORE_SCRAPING_ENABLED",
  });
}
