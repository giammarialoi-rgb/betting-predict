/**
 * Per-event page fetch. Homepage HTTP 200 is never SUCCESS.
 * SUCCESS requires EVENT_MATCHED plus at least one typed extracted field.
 * No WAF/CAPTCHA bypass. Ordinary GET only; 403 stays BLOCKED.
 */
import { scrapeDecisionIsAllow, scrapingAllowedForSource } from "@/domain/sources/scraping-policy";
import { extractEventHtml } from "@/domain/eval/data-intelligence/research/extract-html";
import { readScrapeCache, writeScrapeCache } from "@/domain/eval/data-intelligence/research/scrape-cache";
import type { SourceAttemptStatus } from "@/domain/eval/data-intelligence/research/source-attempt";

export type EventPageFetch = {
  source_id: string;
  url: string;
  http_status: number | null;
  status: SourceAttemptStatus | "DENIED" | "HTTP_ERROR";
  fields_extracted: string[];
  extracted_values?: Array<{ key: string; value: number | string; evidence: string }>;
  reason: string;
  fetched: boolean;
  content_hash?: string | null;
  event_matched?: boolean;
};

/** Honest block detection — record BLOCKED, never solve or spoof. */
function looksLikeChallengePage(body: string): boolean {
  const t = body.slice(0, 20_000).toLowerCase();
  return (
    t.includes("cf-challenge") ||
    t.includes("cf-browser-verification") ||
    t.includes("challenge-platform") ||
    t.includes("just a moment") ||
    t.includes("attention required") ||
    /<title>[^<]*captcha/i.test(body.slice(0, 4000))
  );
}

export function eventPageUrls(sourceId: string, home: string, away: string): string {
  const q = encodeURIComponent(`${home} ${away}`);
  switch (sourceId) {
    case "understat":
      return "";
    case "fbref":
      return `https://fbref.com/en/search/search.fcgi?search=${q}`;
    case "sofascore":
      return `https://www.sofascore.com/search?q=${q}`;
    case "uefa":
      return `https://www.uefa.com/search/?q=${q}`;
    case "directa":
      return `https://www.diretta.it/ricerca/?q=${q}`;
    case "flashscore":
      return `https://www.flashscore.com/search/?q=${q}`;
    case "soccerway":
      return `https://int.soccerway.com/search/?q=${q}`;
    case "whoscored":
      return `https://www.whoscored.com/search/?q=${q}`;
    case "soccervista":
      return `https://www.soccervista.com/search?q=${q}`;
    case "soccervital":
      return `https://www.soccervital.com/?s=${q}`;
    case "the-analyst":
      return `https://theanalyst.com/eu/search?q=${q}`;
    case "abseits":
      return `https://www.abseits.at/search/${q}`;
    default:
      return "";
  }
}

const FETCH_TIMEOUT_MS = 12_000;

function abortSignal(): AbortSignal | undefined {
  const anyAbort = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof anyAbort.timeout === "function") return anyAbort.timeout(FETCH_TIMEOUT_MS);
  return undefined;
}

function mapExtractStatus(
  status: ReturnType<typeof extractEventHtml>["status"],
): EventPageFetch["status"] {
  if (status === "PARSE_ERROR") return "NO_DATA";
  return status;
}

export async function fetchEventPage(input: {
  sourceId: string;
  home: string;
  away: string;
  fetchImpl?: typeof fetch;
  cacheRoot?: string;
  nowIso?: string;
  competition?: string | null;
}): Promise<EventPageFetch> {
  const allow = scrapingAllowedForSource(input.sourceId);
  const url = eventPageUrls(input.sourceId, input.home, input.away);
  if (!scrapeDecisionIsAllow(allow)) {
    return {
      source_id: input.sourceId,
      url,
      http_status: null,
      status: "DENIED",
      fields_extracted: [],
      reason: "Event-page scrape denied by policy. No invented success.",
      fetched: false,
    };
  }
  if (!url) {
    return {
      source_id: input.sourceId,
      url: "",
      http_status: null,
      status: "DENIED",
      fields_extracted: [],
      reason: "No event-page URL template for this source.",
      fetched: false,
    };
  }
  try {
    const cached = readScrapeCache({
      url,
      sourceId: input.sourceId,
      root: input.cacheRoot,
    });
    let status: number;
    let body: string;
    if (cached && cached.http_status < 400) {
      status = cached.http_status;
      body = cached.body;
    } else {
      const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
      const signal = abortSignal();
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "text/html,*/*",
          "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
        },
        ...(signal ? { signal } : {}),
      });
      status = res.status;
      body = await res.text();
    }
    if (status === 403) {
      return {
        source_id: input.sourceId,
        url,
        http_status: 403,
        status: "BLOCKED",
        fields_extracted: [],
        reason: `Event-page blocked HTTP 403. No data from ${input.sourceId} used.`,
        fetched: true,
      };
    }
    if (status === 429) {
      return {
        source_id: input.sourceId,
        url,
        http_status: 429,
        status: "RATE_LIMITED",
        fields_extracted: [],
        reason: `Rate limited HTTP 429.`,
        fetched: true,
      };
    }
    if (status === 401) {
      return {
        source_id: input.sourceId,
        url,
        http_status: 401,
        status: "AUTH_REQUIRED",
        fields_extracted: [],
        reason: `Authentication required HTTP 401. No bypass.`,
        fetched: true,
      };
    }
    if (status >= 400) {
      return {
        source_id: input.sourceId,
        url,
        http_status: status,
        status: "HTTP_ERROR",
        fields_extracted: [],
        reason: `HTTP ${status} on event search page.`,
        fetched: true,
      };
    }
    if (looksLikeChallengePage(body)) {
      return {
        source_id: input.sourceId,
        url,
        http_status: status,
        status: "BLOCKED",
        fields_extracted: [],
        reason: `Challenge/CAPTCHA page from ${input.sourceId}. Recorded as BLOCKED; no bypass.`,
        fetched: true,
      };
    }
    const extracted = extractEventHtml({ html: body, home: input.home, away: input.away });
    if (status < 400 && body.length > 0) {
      writeScrapeCache({
        url,
        http_status: status,
        body,
        content_hash: extracted.content_hash,
        nowIso: input.nowIso,
        root: input.cacheRoot,
      });
    }
    const fields = extracted.fields.map((f) => f.key);
    return {
      source_id: input.sourceId,
      url,
      http_status: status,
      status: mapExtractStatus(extracted.status),
      fields_extracted: fields,
      extracted_values: extracted.fields,
      reason: extracted.reason,
      fetched: true,
      content_hash: extracted.content_hash,
      event_matched: extracted.match === "EVENT_MATCHED",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const timedOut = /abort|timeout/i.test(msg);
    return {
      source_id: input.sourceId,
      url,
      http_status: null,
      status: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      fields_extracted: [],
      reason: msg,
      fetched: false,
    };
  }
}
