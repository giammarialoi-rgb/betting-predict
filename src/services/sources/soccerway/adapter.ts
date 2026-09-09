import { createPolicyGatedCatalogAdapter055 } from "@/services/sources/policy-stub";
import type { SportsSourceAdapter } from "@/services/sources/types";

export function createSoccerwayAdapter055(): SportsSourceAdapter {
  return createPolicyGatedCatalogAdapter055({
    sourceId: "SOCCERWAY",
    enabledEnv: "SOCCERWAY_ENABLED",
    scrapingEnv: "SOCCERWAY_SCRAPING_ENABLED",
  });
}
