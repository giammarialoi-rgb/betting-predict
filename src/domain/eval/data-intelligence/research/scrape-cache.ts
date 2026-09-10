/**
 * URL fetch cache. Does not invent event data.
 * Historical sources cache longer; injuries/lineups/weather refresh sooner.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export type CachedPage = {
  url: string;
  retrieved_at: string;
  http_status: number;
  content_hash: string;
  body: string;
};

export type CacheTtlKind =
  | "historical"
  | "injuries"
  | "lineups"
  | "weather"
  | "referee"
  | "search";

const TTL_MS: Record<CacheTtlKind, number> = {
  historical: 12 * 60 * 60 * 1000,
  referee: 12 * 60 * 60 * 1000,
  search: 2 * 60 * 60 * 1000,
  weather: 90 * 60 * 1000,
  injuries: 30 * 60 * 1000,
  lineups: 20 * 60 * 1000,
};

export function ttlKindForSource(sourceId: string): CacheTtlKind {
  switch (sourceId) {
    case "fbref":
    case "understat":
    case "football-data-co-uk":
    case "club-football-match-data":
      return "historical";
    case "open-meteo":
      return "weather";
    case "api-sports":
      return "injuries";
    case "sofascore":
    case "directa":
    case "flashscore":
    case "uefa":
      return "lineups";
    default:
      return "search";
  }
}

function cachePath(root: string): string {
  return join(root, "scrape-cache.json");
}

type CacheFile = { pages: Record<string, CachedPage> };

function loadFile(root: string): CacheFile {
  const p = cachePath(root);
  if (!existsSync(p)) return { pages: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as CacheFile;
  } catch {
    return { pages: {} };
  }
}

function saveFile(file: CacheFile, root: string): void {
  mkdirSync(root, { recursive: true });
  const entries = Object.entries(file.pages).sort((a, b) =>
    a[1].retrieved_at < b[1].retrieved_at ? 1 : -1,
  );
  file.pages = Object.fromEntries(entries.slice(0, 400));
  writeFileSync(cachePath(root), JSON.stringify(file));
}

export function readScrapeCache(input: {
  url: string;
  sourceId: string;
  nowMs?: number;
  root?: string;
}): CachedPage | null {
  const root = input.root ?? permanentRoot044();
  const file = loadFile(root);
  const page = file.pages[input.url];
  if (!page) return null;
  const now = input.nowMs ?? Date.now();
  const ttl = TTL_MS[ttlKindForSource(input.sourceId)];
  if (now - Date.parse(page.retrieved_at) > ttl) return null;
  return page;
}

export function writeScrapeCache(input: {
  url: string;
  http_status: number;
  body: string;
  content_hash: string;
  nowIso?: string;
  root?: string;
}): CachedPage {
  const root = input.root ?? permanentRoot044();
  const file = loadFile(root);
  const page: CachedPage = {
    url: input.url,
    retrieved_at: input.nowIso ?? new Date().toISOString(),
    http_status: input.http_status,
    content_hash: input.content_hash,
    body: input.body.slice(0, 400_000),
  };
  file.pages[input.url] = page;
  saveFile(file, root);
  return page;
}
