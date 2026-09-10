/**
 * Per-event page fetch. Homepage HTTP 200 is never SUCCESS.
 * Team names must appear in the body or the result is NO_EVENT.
 * No WAF/CAPTCHA bypass. Ordinary GET only; 403 stays BLOCKED.
 */
import { scrapeDecisionIsAllow, scrapingAllowedForSource } from "@/domain/sources/scraping-policy";

export type EventPageFetch = {
  source_id: string;
  url: string;
  http_status: number | null;
  status: "BLOCKED" | "HTTP_ERROR" | "NO_EVENT" | "PARTIAL" | "DENIED" | "RATE_LIMITED";
  fields_extracted: string[];
  reason: string;
  fetched: boolean;
};

function mentions(body: string, name: string): boolean {
  const n = name.trim();
  if (n.length < 3) return false;
  return body.toLowerCase().includes(n.toLowerCase());
}

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
      // No per-event URL without a fixture id. League table would false-positive
      // any EPL team names. Empty → DENIED / no invented SUCCESS.
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
    default:
      return "";
  }
}

export async function fetchEventPage(input: {
  sourceId: string;
  home: string;
  away: string;
  fetchImpl?: typeof fetch;
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
    const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "text/html,*/*",
        "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
      },
    });
    const status = res.status;
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
    const body = await res.text();
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
    const homeOk = mentions(body, input.home);
    const awayOk = mentions(body, input.away);
    if (!homeOk || !awayOk) {
      return {
        source_id: input.sourceId,
        url,
        http_status: status,
        status: "NO_EVENT",
        fields_extracted: [],
        reason: `HTTP ${status} but the page does not contain both team names. Not treated as event data.`,
        fetched: true,
      };
    }
    const hasXg = /xg|expected goals/i.test(body);
    return {
      source_id: input.sourceId,
      url,
      http_status: status,
      status: "PARTIAL",
      fields_extracted: hasXg ? ["page_mentions_xg"] : ["page_mentions_both_teams"],
      reason: hasXg
        ? "Both teams mentioned and xG text present; no typed xG value extracted."
        : "Both teams mentioned; no typed match statistics extracted.",
      fetched: true,
    };
  } catch (e) {
    return {
      source_id: input.sourceId,
      url,
      http_status: null,
      status: "HTTP_ERROR",
      fields_extracted: [],
      reason: e instanceof Error ? e.message : String(e),
      fetched: false,
    };
  }
}
