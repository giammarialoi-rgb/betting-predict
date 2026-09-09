/**
 * Tiny disk cache for API-Sports GET responses (dedupe identical paths).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { apiSportsRoot057 } from "@/domain/data-sources/api-sports/config";

export function cacheKey057(pathWithQuery: string): string {
  return createHash("sha256").update(pathWithQuery).digest("hex").slice(0, 24);
}

export function readCache057(
  pathWithQuery: string,
  maxAgeMs: number,
  root = apiSportsRoot057(),
): { hit: true; body: unknown; cached_at: string } | { hit: false } {
  const dir = join(root, "cache");
  const p = join(dir, `${cacheKey057(pathWithQuery)}.json`);
  if (!existsSync(p)) return { hit: false };
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as { cached_at: string; body: unknown; path: string };
    if (Date.now() - Date.parse(j.cached_at) > maxAgeMs) return { hit: false };
    return { hit: true, body: j.body, cached_at: j.cached_at };
  } catch {
    return { hit: false };
  }
}

export function writeCache057(pathWithQuery: string, body: unknown, root = apiSportsRoot057()): void {
  const dir = join(root, "cache");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${cacheKey057(pathWithQuery)}.json`),
    JSON.stringify({ path: pathWithQuery, cached_at: new Date().toISOString(), body }, null, 2),
  );
}
