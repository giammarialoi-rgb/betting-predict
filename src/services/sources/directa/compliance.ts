/**
 * Directa compliance firewall — default DENY.
 * No CAPTCHA/WAF/TLS/login/proxy/fingerprint bypass.
 */

import { scrapingAllowedForSource, assertScrapingDenied } from "@/domain/sources/scraping-policy";

export type DirectaPolicyStatus054 =
  | "DISABLED_BY_POLICY"
  | "ENABLED_AWAITING_AUTHORIZATION"
  | "ACTIVE"
  | "UNAVAILABLE"
  | "ERROR";

export function envFlagTrue(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveDirectaPolicy054(): {
  enabled: boolean;
  scraping_enabled: boolean;
  policy_status: DirectaPolicyStatus054;
  reason: string;
  min_interval_ms: number;
  max_concurrency: number;
  max_retries: number;
  timeout_ms: number;
} {
  const enabled = envFlagTrue("DIRECTA_ENABLED");
  const scraping = envFlagTrue("DIRECTA_SCRAPING_ENABLED");
  const scrapingDecision = scrapingAllowedForSource("directa");

  // Hard deny: scraping policy is DENY and env must both be true to proceed
  if (!enabled || !scraping || scrapingDecision === "DENY") {
    return {
      enabled: false,
      scraping_enabled: false,
      policy_status: "DISABLED_BY_POLICY",
      reason:
        !enabled
          ? "DIRECTA_ENABLED=false (default)"
          : !scraping
            ? "DIRECTA_SCRAPING_ENABLED=false (default)"
            : "scrapingAllowedForSource(directa)=DENY — no bypass of CAPTCHA/WAF/login/paywall",
      min_interval_ms: Number(process.env.DIRECTA_MIN_REQUEST_INTERVAL_MS ?? 2500),
      max_concurrency: Number(process.env.DIRECTA_MAX_CONCURRENCY ?? 1),
      max_retries: Number(process.env.DIRECTA_MAX_RETRIES ?? 2),
      timeout_ms: Number(process.env.DIRECTA_TIMEOUT_MS ?? 15000),
    };
  }

  // Even if env says enabled, never allow bypass actions
  assertScrapingDenied("bypass_cloudflare");
  assertScrapingDenied("bypass_captcha");
  assertScrapingDenied("bypass_login");
  assertScrapingDenied("bypass_paywall");

  return {
    enabled: true,
    scraping_enabled: true,
    policy_status: "ENABLED_AWAITING_AUTHORIZATION",
    reason: "Flags set but live HTML fetch requires explicit human-reviewed authorization path",
    min_interval_ms: Number(process.env.DIRECTA_MIN_REQUEST_INTERVAL_MS ?? 2500),
    max_concurrency: Number(process.env.DIRECTA_MAX_CONCURRENCY ?? 1),
    max_retries: Number(process.env.DIRECTA_MAX_RETRIES ?? 2),
    timeout_ms: Number(process.env.DIRECTA_TIMEOUT_MS ?? 15000),
  };
}

export function assertNoBypass054(action: string): void {
  assertScrapingDenied(action);
  const forbidden = [
    "bypass_waf",
    "bypass_tls",
    "proxy_rotation_evasion",
    "fingerprint_spoof",
    "credential_harvest",
    "captcha_solve",
  ];
  if (forbidden.includes(action)) {
    throw new Error(`DIRECTA_COMPLIANCE_DENY: ${action}`);
  }
}
