/**
 * Paths + env for API-Sports (TASK 057).
 * Keys: API_SPORTS_KEY preferred, API_FOOTBALL_KEY accepted as alias.
 */

import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export const API_SPORTS_BASE_URL_057 = "https://v3.football.api-sports.io";
export const API_SPORTS_LIMIT_DAY_057 = 100;
export const API_SPORTS_LIMIT_MINUTE_057 = 10;
export const API_SPORTS_MIN_INTERVAL_MS_057 = 6500; // ~9/min safe under 10/min
export const API_SPORTS_TIMEOUT_MS_057 = 15_000;

export function apiSportsRoot057(labB = permanentRoot044()): string {
  return join(labB, "api-sports");
}

export function getApiSportsKey057(): string | null {
  const a = process.env.API_SPORTS_KEY?.trim();
  if (a) return a;
  const b = process.env.API_FOOTBALL_KEY?.trim();
  if (b) return b;
  return null;
}

export function getApiSportsBaseUrl057(): string {
  return (
    process.env.API_SPORTS_BASE_URL?.trim() ||
    process.env.API_FOOTBALL_BASE_URL?.trim() ||
    API_SPORTS_BASE_URL_057
  );
}

/** Redact any accidental key substrings from strings written to disk/logs. */
export function redactSecrets057(text: string): string {
  let out = text;
  for (const envName of ["API_SPORTS_KEY", "API_FOOTBALL_KEY", "THE_ODDS_API_KEY"] as const) {
    const v = process.env[envName]?.trim();
    if (v && v.length >= 8) {
      out = out.split(v).join(`[REDACTED:${envName}]`);
    }
  }
  // header-style accidental dumps
  out = out.replace(/x-apisports-key\s*[:=]\s*\S+/gi, "x-apisports-key:[REDACTED]");
  return out;
}
