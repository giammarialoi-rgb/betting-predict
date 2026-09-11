/**
 * Public sports RSS — CONTEXT only when BOTH teams appear in the same item.
 * Never invents injuries/lineups from headlines. 403/WAF = BLOCKED.
 */
export type RssSourceId = "ansa" | "sky-sport" | "bbc-sport" | "gazzetta";

export type RssItem = {
  title: string;
  link: string | null;
  pubDate: string | null;
  text: string;
};

export type RssMatch = {
  source_id: RssSourceId;
  status: "PARTIAL" | "NO_EVENT" | "HTTP_ERROR" | "BLOCKED" | "NO_DATA";
  http_status: number | null;
  url: string;
  items_scanned: number;
  matched_title: string | null;
  matched_link: string | null;
  matched_pubDate: string | null;
  reason: string;
};

export const RSS_FEEDS: Record<RssSourceId, string> = {
  ansa: "https://www.ansa.it/sito/notizie/sport/calcio/calcio_rss.xml",
  "sky-sport": "https://sport.sky.it/rss/calcio.xml",
  "bbc-sport": "https://feeds.bbci.co.uk/sport/football/rss.xml",
  gazzetta: "https://www.gazzetta.it/rss/calcio.xml",
};

const cache = new Map<RssSourceId, { at: number; items: RssItem[]; http: number | null; error: string | null }>();
const CACHE_MS = 5 * 60 * 1000;

function significantTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|afc|cf|sc|club|as|ss|ac|ud|us)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

export function rssItemMentionsBoth(text: string, home: string, away: string): boolean {
  const hay = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const h = significantTokens(home);
  const a = significantTokens(away);
  if (!h.length || !a.length) return false;
  const has = (tokens: string[]) => tokens.every((t) => hay.includes(t));
  return has(h) && has(a);
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const chunk = block.split(/<\/item>/i)[0] ?? "";
    const title = (chunk.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:]]>)?<\/title>/i)?.[1] ?? "").trim();
    const link = (chunk.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:]]>)?<\/link>/i)?.[1] ?? "").trim() || null;
    const pubDate = (chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "").trim() || null;
    const desc = (chunk.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:]]>)?<\/description>/i)?.[1] ?? "").trim();
    const text = `${title} ${desc}`.replace(/<[^>]+>/g, " ");
    if (title) items.push({ title, link, pubDate, text });
  }
  return items;
}

export async function loadRssFeed(
  sourceId: RssSourceId,
  deps?: { fetchImpl?: typeof fetch; xmlText?: string; nowMs?: number },
): Promise<{ items: RssItem[]; http: number | null; error: string | null; url: string }> {
  const url = RSS_FEEDS[sourceId];
  if (deps?.xmlText != null) {
    return { items: parseRssItems(deps.xmlText), http: 200, error: null, url };
  }
  const now = deps?.nowMs ?? Date.now();
  const hit = cache.get(sourceId);
  if (hit && now - hit.at < CACHE_MS) {
    return { items: hit.items, http: hit.http, error: hit.error, url };
  }
  try {
    const fetchImpl = deps?.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const res = await fetchImpl(url, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "betmind-research/0.1" },
    });
    if (res.status === 403 || res.status === 429 || res.status === 401) {
      const packed = { at: now, items: [] as RssItem[], http: res.status, error: `HTTP_${res.status}` };
      cache.set(sourceId, packed);
      return { items: [], http: res.status, error: packed.error, url };
    }
    if (!res.ok) {
      const packed = { at: now, items: [] as RssItem[], http: res.status, error: `HTTP_${res.status}` };
      cache.set(sourceId, packed);
      return { items: [], http: res.status, error: packed.error, url };
    }
    const xml = await res.text();
    const items = parseRssItems(xml);
    cache.set(sourceId, { at: now, items, http: res.status, error: null });
    return { items, http: res.status, error: null, url };
  } catch (e) {
    const packed = { at: now, items: [] as RssItem[], http: null, error: e instanceof Error ? e.message : String(e) };
    cache.set(sourceId, packed);
    return { items: [], http: null, error: packed.error, url };
  }
}

export async function matchRssToEvent(input: {
  sourceId: RssSourceId;
  home: string;
  away: string;
  deps?: { fetchImpl?: typeof fetch; xmlText?: string; nowMs?: number };
}): Promise<RssMatch> {
  const feed = await loadRssFeed(input.sourceId, input.deps);
  if (feed.http === 403 || feed.http === 401) {
    return {
      source_id: input.sourceId,
      status: "BLOCKED",
      http_status: feed.http,
      url: feed.url,
      items_scanned: 0,
      matched_title: null,
      matched_link: null,
      matched_pubDate: null,
      reason: `BLOCKED HTTP ${feed.http} — no WAF bypass`,
    };
  }
  if (feed.error || feed.http == null || feed.http >= 400) {
    return {
      source_id: input.sourceId,
      status: "HTTP_ERROR",
      http_status: feed.http,
      url: feed.url,
      items_scanned: 0,
      matched_title: null,
      matched_link: null,
      matched_pubDate: null,
      reason: feed.error ?? "RSS fetch failed",
    };
  }
  if (feed.items.length === 0) {
    return {
      source_id: input.sourceId,
      status: "NO_DATA",
      http_status: feed.http,
      url: feed.url,
      items_scanned: 0,
      matched_title: null,
      matched_link: null,
      matched_pubDate: null,
      reason: "RSS vuoto — nessun item parsato",
    };
  }
  const hit = feed.items.find((it) => rssItemMentionsBoth(it.text, input.home, input.away));
  if (!hit) {
    return {
      source_id: input.sourceId,
      status: "NO_EVENT",
      http_status: feed.http,
      url: feed.url,
      items_scanned: feed.items.length,
      matched_title: null,
      matched_link: null,
      matched_pubDate: null,
      reason: `RSS letto (${feed.items.length} item) ma nessuna voce cita entrambe le squadre`,
    };
  }
  return {
    source_id: input.sourceId,
    status: "PARTIAL",
    http_status: feed.http,
    url: feed.url,
    items_scanned: feed.items.length,
    matched_title: hit.title,
    matched_link: hit.link,
    matched_pubDate: hit.pubDate,
    reason: "Voce RSS cita entrambe le squadre — CONTEXT only, non e un infortunio strutturato",
  };
}
