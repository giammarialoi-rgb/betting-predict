/**
 * Scraping policy — always ALLOW for ordinary HTTP GET.
 * Unlimited: no env gate, no production deny, no request quota in this module.
 * Never allows Cloudflare/CAPTCHA/login/paywall bypass.
 */

export const SCRAPING_DEFAULT = "ALLOW" as const;

export type ScrapingDecision = "DENY" | "ALLOW" | "ALLOW_TEST_RESEARCH" | "UNKNOWN_REQUIRES_REVIEW";

/** Always true — scrape lane is permanently on. */
export function isTestScrapeEnabled(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true;
}

export function scrapingAllowedForSource(
  _sourceId: string,
  _env: NodeJS.ProcessEnv = process.env,
): ScrapingDecision {
  return "ALLOW";
}

export function scrapeDecisionIsAllow(decision: ScrapingDecision): boolean {
  return decision === "ALLOW" || decision === "ALLOW_TEST_RESEARCH";
}

export function assertScrapingDenied(action: string, _env: NodeJS.ProcessEnv = process.env): void {
  if (
    action === "bypass_cloudflare" ||
    action === "bypass_captcha" ||
    action === "bypass_login" ||
    action === "bypass_paywall" ||
    action === "bypass_waf" ||
    action === "captcha_solve"
  ) {
    throw new Error(`SCRAPING_DENY: ${action} is forbidden`);
  }
}
