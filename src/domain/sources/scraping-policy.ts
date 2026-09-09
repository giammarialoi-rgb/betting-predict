/**
 * Scraping policy — default DENY.
 * TEST_SCRAPE lane: BETMIND_TEST_SCRAPE=true and not production (unless CI allow flag).
 * Never allows Cloudflare/CAPTCHA/login/paywall bypass.
 */

export const SCRAPING_DEFAULT = "DENY" as const;

export type ScrapingDecision = "DENY" | "ALLOW_TEST_RESEARCH" | "UNKNOWN_REQUIRES_REVIEW";

export function isTestScrapeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.BETMIND_TEST_SCRAPE !== "true") return false;
  if (env.NODE_ENV === "production" && env.BETMIND_ALLOW_TEST_SCRAPE_IN_CI !== "true") {
    return false;
  }
  return true;
}

export function scrapingAllowedForSource(
  sourceId: string,
  env: NodeJS.ProcessEnv = process.env,
): ScrapingDecision {
  const scrapeSources = new Set(["fbref", "understat", "uefa", "sofascore"]);
  if (!scrapeSources.has(sourceId.toLowerCase())) return "DENY";
  if (isTestScrapeEnabled(env)) return "ALLOW_TEST_RESEARCH";
  return "DENY";
}

export function assertScrapingDenied(action: string, env: NodeJS.ProcessEnv = process.env): void {
  if (
    action === "bypass_cloudflare" ||
    action === "bypass_captcha" ||
    action === "bypass_login" ||
    action === "bypass_paywall"
  ) {
    throw new Error(`SCRAPING_DENY: ${action} is forbidden`);
  }
  if (action === "scrape" && !isTestScrapeEnabled(env)) {
    throw new Error(
      "SCRAPING_DENY: scrape is forbidden (set BETMIND_TEST_SCRAPE=true for RESEARCH_TEST only)",
    );
  }
}
