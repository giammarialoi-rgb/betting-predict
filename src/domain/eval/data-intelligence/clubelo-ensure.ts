/**
 * Ensure ClubElo day CSV is on disk via public API (api.clubelo.com).
 * Never invents ratings; persists raw CSV under data/clubelo/.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchClubEloDay } from "@/providers/clubelo/adapter";

export type EnsureClubEloResult = {
  ok: boolean;
  path: string | null;
  rating_date: string;
  http_status: number | null;
  observations: number;
  reason: string | null;
  url: string;
};

export function clubEloDayPath(cwd: string, ratingDateIso: string): string {
  return join(cwd, "data", "clubelo", `${ratingDateIso}.csv`);
}

/**
 * Fetch ClubElo for as-of day (typically match_date - 1 day) and cache locally.
 */
export async function ensureClubEloCacheDay(input: {
  ratingDateIso: string;
  cwd?: string;
  force?: boolean;
}): Promise<EnsureClubEloResult> {
  const cwd = input.cwd ?? process.cwd();
  const day = input.ratingDateIso.slice(0, 10);
  const path = clubEloDayPath(cwd, day);
  const url = `http://api.clubelo.com/${day}`;

  if (!input.force && existsSync(path)) {
    return {
      ok: true,
      path,
      rating_date: day,
      http_status: 200,
      observations: -1,
      reason: "CACHE_HIT",
      url,
    };
  }

  const fetched = await fetchClubEloDay(day);
  if (fetched.provider_status !== "OK" || !fetched.rawText) {
    return {
      ok: false,
      path: null,
      rating_date: day,
      http_status: fetched.http_status,
      observations: 0,
      reason: fetched.reason ?? fetched.provider_status,
      url: fetched.url,
    };
  }

  mkdirSync(join(cwd, "data", "clubelo"), { recursive: true });
  writeFileSync(path, fetched.rawText, "utf8");
  return {
    ok: true,
    path,
    rating_date: day,
    http_status: fetched.http_status,
    observations: fetched.observations.length,
    reason: null,
    url: fetched.url,
  };
}

/** Day before match — Elo available_at must be < match_date. */
export function clubEloAsOfDateForKickoff(kickoffIso: string, nowIso = new Date().toISOString()): string {
  const matchDay = kickoffIso.slice(0, 10);
  const nowDay = nowIso.slice(0, 10);
  const asOfMs = Math.min(
    Date.parse(`${matchDay}T00:00:00.000Z`) - 86_400_000,
    Date.parse(`${nowDay}T00:00:00.000Z`),
  );
  return new Date(asOfMs).toISOString().slice(0, 10);
}
