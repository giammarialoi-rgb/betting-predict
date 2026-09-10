/**
 * SourceAvailabilityMatrix — catalog ≠ provider; blocked sources don't halt the lab.
 */

import { listSources } from "@/domain/sources/catalog";
import { SCRAPING_DEFAULT } from "@/domain/sources/scraping-policy";
import { FOOTBALL_DATA_CO_UK_LIVE_STATUS } from "@/domain/sources/provider-status";
import type { SourceType } from "@/domain/sources/types";

export type AccessType =
  | "official_api"
  | "public_endpoint"
  | "dataset"
  | "website"
  | "license_sensitive"
  | "scraping_candidate"
  | "unknown";

export type LicenseClass =
  | "public_dataset"
  | "free_tier_api"
  | "commercial"
  | "unknown"
  | "to_review";

export type SourceRuntimeStatus =
  | "observed"
  | "verified"
  | "implemented"
  | "blocked"
  | "not_implemented"
  | "catalogued";

export type SourceAvailabilityRow = {
  source: string;
  sport: string;
  competition: string | null;
  market: string | null;
  historical: boolean | "unknown";
  live: boolean | "unknown";
  temporal_precision: "exact" | "unknown" | "dataset_window" | "mixed";
  access_type: AccessType;
  license_class: LicenseClass;
  status: SourceRuntimeStatus;
  last_success: string | null;
  last_failure: string | null;
  http_status: number | null;
  reason: string | null;
  retry_policy: "backoff" | "manual" | "none";
  scraping: "DENY" | "ALLOW";
};

function mapAccessType(sourceType: SourceType, id: string): AccessType {
  if (id === "opta-stats-perform" || id === "the-athletic") return "license_sensitive";
  if (sourceType === "api") return "official_api";
  if (sourceType === "dataset") return "dataset";
  if (sourceType === "website") return "website";
  if (sourceType === "official") return "public_endpoint";
  return "unknown";
}

function mapLicense(id: string, freeTier: boolean | "unknown"): LicenseClass {
  if (id === "football-data-co-uk" || id === "clubelo" || id === "open-meteo") {
    return "public_dataset";
  }
  if (id === "opta-stats-perform" || id === "the-athletic") return "commercial";
  if (freeTier === true) return "free_tier_api";
  return "to_review";
}

/** Implemented domain/providers (not scrapers). */
const IMPLEMENTED = new Set([
  "football-data-org",
  "football-data-co-uk",
  "clubelo",
  "open-meteo",
  "api-football",
  "club-football-match-data",
]);

const VERIFIED_OFFLINE = new Set([
  "football-data-co-uk",
  "clubelo",
  "club-football-match-data",
]);

/**
 * Build availability matrix from catalog + known runtime probes.
 * Website sources stay not_implemented — never auto-scrape.
 */
export function buildSourceAvailabilityMatrix(input?: {
  now?: string;
}): SourceAvailabilityRow[] {
  const now = input?.now ?? new Date().toISOString();
  const rows: SourceAvailabilityRow[] = [];

  for (const s of listSources()) {
    for (const sport of s.sports) {
      let status: SourceRuntimeStatus = "catalogued";
      let http_status: number | null = null;
      let reason: string | null = null;
      let last_success: string | null = null;
      let last_failure: string | null = null;
      let temporal: SourceAvailabilityRow["temporal_precision"] = "unknown";

      if (s.id === "football-data-co-uk") {
        if (FOOTBALL_DATA_CO_UK_LIVE_STATUS.provider_status === "BLOCKED") {
          status = "blocked";
          http_status = FOOTBALL_DATA_CO_UK_LIVE_STATUS.http_status;
          reason = FOOTBALL_DATA_CO_UK_LIVE_STATUS.reason;
          last_failure = FOOTBALL_DATA_CO_UK_LIVE_STATUS.checked_at;
          // Offline pack still observed
          last_success = now;
        }
        temporal = "unknown";
      } else if (IMPLEMENTED.has(s.id)) {
        status = VERIFIED_OFFLINE.has(s.id) ? "verified" : "implemented";
        if (s.id === "club-football-match-data") {
          reason = "SECONDARY_BENCHMARK";
          temporal = "unknown";
        }
        if (s.id === "clubelo") temporal = "dataset_window";
        last_success = now;
      } else if (s.sourceType === "website") {
        status = "not_implemented";
        reason = "website_not_auto_scraped";
      } else {
        status = "not_implemented";
        reason = "provider_not_wired";
      }

      rows.push({
        source: s.id,
        sport,
        competition: sport === "football" ? null : null,
        market: null,
        historical: s.historicalData,
        live: s.realtime,
        temporal_precision: temporal,
        access_type: mapAccessType(s.sourceType, s.id),
        license_class: mapLicense(s.id, s.freeTier),
        status,
        last_success,
        last_failure,
        http_status,
        reason,
        retry_policy:
          status === "blocked" ? "backoff" : status === "not_implemented" ? "none" : "manual",
        scraping: SCRAPING_DEFAULT,
      });
    }
  }

  return rows;
}

export function summarizeSourceAvailability(rows: readonly SourceAvailabilityRow[]) {
  const count = (s: SourceRuntimeStatus) => rows.filter((r) => r.status === s).length;
  return {
    catalogued: rows.length,
    implemented: count("implemented") + count("verified"),
    verified: count("verified"),
    blocked: count("blocked"),
    not_implemented: count("not_implemented"),
    scraping: SCRAPING_DEFAULT,
  };
}

/** When primary live is blocked, list alternatives that remain usable. */
export function alternativesWhenBlocked(
  rows: readonly SourceAvailabilityRow[],
  blockedSource: string,
): string[] {
  return rows
    .filter(
      (r) =>
        r.source !== blockedSource &&
        (r.status === "verified" || r.status === "implemented") &&
        r.access_type !== "website",
    )
    .map((r) => r.source);
}
