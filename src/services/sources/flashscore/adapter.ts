import { createPolicyGatedCatalogAdapter055 } from "@/services/sources/policy-stub";
import type { SportsSourceAdapter } from "@/services/sources/types";

export function createFlashscoreAdapter055(): SportsSourceAdapter {
  return createPolicyGatedCatalogAdapter055({
    sourceId: "FLASHSCORE",
    enabledEnv: "FLASHSCORE_ENABLED",
    scrapingEnv: "FLASHSCORE_SCRAPING_ENABLED",
  });
}
