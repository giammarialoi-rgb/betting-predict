/**
 * Provider live status — no bypass of HTTP blocks.
 */

export type ProviderLiveStatus = {
  provider: string;
  provider_status: "OK" | "BLOCKED" | "UNKNOWN";
  reason: string | null;
  http_status: number | null;
  checked_at: string;
};

export const FOOTBALL_DATA_CO_UK_LIVE_STATUS: ProviderLiveStatus = {
  provider: "football-data-co-uk",
  provider_status: "BLOCKED",
  reason: "HTTP_503",
  http_status: 503,
  checked_at: "2026-04-06T00:00:00.000Z",
};

/** Divisions planned when live CSV returns 200 — not claimed observed until downloaded. */
export const FOOTBALL_DATA_CO_UK_TARGET_DIVISIONS = [
  "E0",
  "E1",
  "E2",
  "E3",
  "I1",
  "I2",
  "SP1",
  "SP2",
  "D1",
  "D2",
  "F1",
  "F2",
  "N1",
  "N2",
  "B1",
  "P1",
] as const;

export function recordProviderBlocked(
  provider: string,
  httpStatus: number,
): ProviderLiveStatus {
  return {
    provider,
    provider_status: "BLOCKED",
    reason: `HTTP_${httpStatus}`,
    http_status: httpStatus,
    checked_at: new Date().toISOString(),
  };
}
