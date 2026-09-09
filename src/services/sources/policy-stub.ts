/**
 * Policy-gated web catalog stub factory.
 * Default DENY — no CAPTCHA/WAF/login/proxy bypass.
 */

import { scrapingAllowedForSource, assertScrapingDenied } from "@/domain/sources/scraping-policy";
import {
  envFlagTrue055,
  type SourceEvent055,
  type SourceHealth055,
  type SourceRuntimeStatus055,
  type SportsSourceAdapter,
  type SportsSourceId055,
  type ProvenanceField055,
} from "@/services/sources/types";

export function createPolicyGatedCatalogAdapter055(input: {
  sourceId: SportsSourceId055;
  enabledEnv: string;
  scrapingEnv: string;
}): SportsSourceAdapter {
  const enabledFlag = envFlagTrue055(input.enabledEnv);
  const scrapingFlag = envFlagTrue055(input.scrapingEnv);
  const scrapingDecision = scrapingAllowedForSource(input.sourceId.toLowerCase());
  const allowed = enabledFlag && scrapingFlag && scrapingDecision !== "DENY";

  const status: SourceRuntimeStatus055 = allowed ? "UNAVAILABLE" : "DISABLED_BY_POLICY";
  const reason = !enabledFlag
    ? `${input.enabledEnv}=false (default)`
    : !scrapingFlag
      ? `${input.scrapingEnv}=false (default)`
      : scrapingDecision === "DENY"
        ? `scrapingAllowedForSource(${input.sourceId})=DENY — no bypass`
        : "flags set but live fetch requires human-reviewed authorization";

  if (allowed) {
    // Even if flags flip, never allow bypass actions
    assertScrapingDenied("bypass_cloudflare");
    assertScrapingDenied("bypass_captcha");
  }

  const health = (): SourceHealth055 => ({
    sourceId: input.sourceId,
    status,
    enabled: allowed,
    last_success_at: null,
    last_error: reason,
    events_discovered: 0,
    events_matched: 0,
    quotes: 0,
    markets: 0,
    api_calls: 0,
    rate_limit_note: "min_interval enforced when authorized",
    last_update: null,
    reason,
  });

  const empty = async () => ({
    events: [] as SourceEvent055[],
    status,
    error: null as string | null,
  });

  const emptyDetails = async () => ({
    detail: null as Record<string, ProvenanceField055> | null,
    status,
    error: reason,
  });

  const emptyFields = async () => ({
    markets: [] as ProvenanceField055[],
    status,
    error: reason,
  });

  const emptyStats = async () => ({
    statistics: [] as ProvenanceField055[],
    status,
    error: reason,
  });

  const emptyResult = async () => ({
    result: null as ProvenanceField055 | null,
    status,
    error: reason,
  });

  return {
    sourceId: input.sourceId,
    enabled: () => allowed,
    health,
    async discoverEvents() {
      return empty();
    },
    fetchEventDetails: emptyDetails,
    fetchMarkets: emptyFields,
    fetchStatistics: emptyStats,
    fetchResults: emptyResult,
  };
}
