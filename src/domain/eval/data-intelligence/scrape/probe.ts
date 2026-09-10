import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  assertScrapingDenied,
  scrapeDecisionIsAllow,
  scrapingAllowedForSource,
} from "@/domain/sources/scraping-policy";
import type { SourceObservation } from "@/domain/eval/data-intelligence/types";

export type ScrapeProbeResult = {
  source_id: string;
  url: string;
  http_status: number;
  status: "OK" | "BLOCKED" | "DENIED" | "INVALID";
  bytes: number;
  content_hash: string | null;
  observations: SourceObservation[];
  reason: string | null;
  enters_independent_model: false;
  legal_status: "research_test" | "forbidden";
};

export type PoliteFetchDeps = {
  fetchImpl?: typeof fetch;
  /** Inject body for offline/unit tests — no network */
  bodyText?: string;
  httpStatus?: number;
};

const MIN_INTERVAL_MS = 0;
const lastFetchAt = new Map<string, number>();

async function politeGet(
  sourceId: string,
  url: string,
  deps: PoliteFetchDeps = {},
): Promise<{ status: number; text: string }> {
  if (deps.bodyText != null) {
    return { status: deps.httpStatus ?? 200, text: deps.bodyText };
  }
  const now = Date.now();
  const prev = lastFetchAt.get(sourceId) ?? 0;
  const wait = MIN_INTERVAL_MS - (now - prev);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt.set(sourceId, Date.now());

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const res = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "text/html,application/json,*/*",
      "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
    },
  });
  const text = await res.text();
  return { status: res.status, text };
}

function deniedResult(sourceId: string, url: string): ScrapeProbeResult {
  return {
    source_id: sourceId,
    url,
    http_status: 0,
    status: "DENIED",
    bytes: 0,
    content_hash: null,
    observations: [],
    reason: "scraping policy denied this source",
    enters_independent_model: false,
    legal_status: "forbidden",
  };
}

function cacheScrape(
  labBRoot: string,
  sourceId: string,
  url: string,
  text: string,
): void {
  const dir = join(labBRoot, "predictive-intelligence", "data-intelligence", "scrape-cache", sourceId);
  mkdirSync(dir, { recursive: true });
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  writeFileSync(join(dir, `${hash}.raw.txt`), text.slice(0, 500_000), "utf8");
  writeFileSync(
    join(dir, `${hash}.meta.json`),
    JSON.stringify({ url, hash, at: new Date().toISOString(), bytes: text.length }, null, 2),
    "utf8",
  );
}

/** Shared probe: ordinary GET, no WAF bypass. Scrape always allowed unless policy DENY. */
export async function probeScrapeSource(input: {
  sourceId: "fbref" | "understat" | "uefa" | "sofascore";
  url: string;
  eventId: string;
  eventTime?: string | null;
  labBRoot?: string;
  deps?: PoliteFetchDeps;
  parse: (html: string) => Array<{ key: string; value: number | string | null }>;
}): Promise<ScrapeProbeResult> {
  const decision = scrapingAllowedForSource(input.sourceId);
  if (!scrapeDecisionIsAllow(decision)) {
    return deniedResult(input.sourceId, input.url);
  }
  assertScrapingDenied("scrape");

  const retrieved_at = new Date().toISOString();
  try {
    const { status, text } = await politeGet(input.sourceId, input.url, input.deps);
    if (status === 403 || status === 429 || status === 503) {
      return {
        source_id: input.sourceId,
        url: input.url,
        http_status: status,
        status: "BLOCKED",
        bytes: text.length,
        content_hash: createHash("sha256").update(text).digest("hex").slice(0, 24),
        observations: [],
        reason: `HTTP_${status}`,
        enters_independent_model: false,
        legal_status: "research_test",
      };
    }
    if (status !== 200 || (text.length < 50 && input.deps?.bodyText == null)) {
      return {
        source_id: input.sourceId,
        url: input.url,
        http_status: status,
        status: "INVALID",
        bytes: text.length,
        content_hash: null,
        observations: [],
        reason: status === 200 ? "EMPTY_OR_SHORT" : `HTTP_${status}`,
        enters_independent_model: false,
        legal_status: "research_test",
      };
    }

    if (input.labBRoot) cacheScrape(input.labBRoot, input.sourceId, input.url, text);

    const parsed = input.parse(text);
    const observations: SourceObservation[] = parsed.map((p) => ({
      source_id: input.sourceId,
      event_id: input.eventId,
      event_time: input.eventTime ?? null,
      available_at: null, // unknown clock from HTML — NOT_ELIGIBLE for STRICT
      retrieved_at,
      key: p.key,
      value: p.value,
      quality: "research",
      legal_status: "research_test",
      timestamp_precision: "unknown",
      status: "NOT_ELIGIBLE",
      enters_independent_model: false,
    }));

    return {
      source_id: input.sourceId,
      url: input.url,
      http_status: status,
      status: "OK",
      bytes: text.length,
      content_hash: createHash("sha256").update(text).digest("hex").slice(0, 24),
      observations,
      reason: null,
      enters_independent_model: false,
      legal_status: "research_test",
    };
  } catch (e) {
    return {
      source_id: input.sourceId,
      url: input.url,
      http_status: 0,
      status: "BLOCKED",
      bytes: 0,
      content_hash: null,
      observations: [],
      reason: (e as Error).message,
      enters_independent_model: false,
      legal_status: "research_test",
    };
  }
}

/** Minimal parsers — extract numbers if present; never invent clocks. */
export function parseFbrefStub(html: string): Array<{ key: string; value: number | null }> {
  const m = html.match(/xG[^0-9]*([0-9]+\.[0-9]+)/i);
  return [{ key: "fbref_xg_hint", value: m ? Number(m[1]) : null }];
}

export function parseUnderstatStub(html: string): Array<{ key: string; value: number | null }> {
  const m = html.match(/xG['":\s]+([0-9]+\.[0-9]+)/i);
  return [{ key: "understat_xg_hint", value: m ? Number(m[1]) : null }];
}

export function parseUefaStub(html: string): Array<{ key: string; value: number | string | null }> {
  const lineup = /line-?up|starting xi/i.test(html);
  return [{ key: "uefa_lineup_page_detected", value: lineup ? 1 : 0 }];
}

export function parseSofascoreStub(html: string): Array<{ key: string; value: number | null }> {
  const m = html.match(/"possession"[^0-9]*([0-9]+)/i);
  return [{ key: "sofa_possession_hint", value: m ? Number(m[1]) : null }];
}

export async function runTestScrapeProbes(input: {
  eventId: string;
  eventTime?: string | null;
  labBRoot?: string;
  deps?: Partial<Record<"fbref" | "understat" | "uefa" | "sofascore", PoliteFetchDeps>>;
}): Promise<ScrapeProbeResult[]> {
  const results: ScrapeProbeResult[] = [];
  results.push(
    await probeScrapeSource({
      sourceId: "fbref",
      url: "https://fbref.com/en/",
      eventId: input.eventId,
      eventTime: input.eventTime,
      labBRoot: input.labBRoot,
      deps: input.deps?.fbref,
      parse: parseFbrefStub,
    }),
  );
  results.push(
    await probeScrapeSource({
      sourceId: "understat",
      url: "https://understat.com/",
      eventId: input.eventId,
      eventTime: input.eventTime,
      labBRoot: input.labBRoot,
      deps: input.deps?.understat,
      parse: parseUnderstatStub,
    }),
  );
  results.push(
    await probeScrapeSource({
      sourceId: "uefa",
      url: "https://www.uefa.com/uefachampionsleague/",
      eventId: input.eventId,
      eventTime: input.eventTime,
      labBRoot: input.labBRoot,
      deps: input.deps?.uefa,
      parse: parseUefaStub,
    }),
  );
  results.push(
    await probeScrapeSource({
      sourceId: "sofascore",
      url: "https://www.sofascore.com/",
      eventId: input.eventId,
      eventTime: input.eventTime,
      labBRoot: input.labBRoot,
      deps: input.deps?.sofascore,
      parse: parseSofascoreStub,
    }),
  );
  return results;
}

export function scrapeCacheDir(labBRoot: string): string {
  return join(labBRoot, "predictive-intelligence", "data-intelligence", "scrape-cache");
}

export function scrapeCachePresent(labBRoot: string): boolean {
  return existsSync(scrapeCacheDir(labBRoot));
}
