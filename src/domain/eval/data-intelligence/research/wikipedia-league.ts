/**
 * Wikipedia REST HTML — public GET. Standings / stadium lists are CONTEXT.
 * available_at = retrieved_at of this GET (page revision at fetch time).
 * Never treated as SUCCESS unless both teams appear in a parsed row.
 */
export type WikiStandingRow = {
  rank: number;
  team: string;
  played: number | null;
  win: number | null;
  draw: number | null;
  loss: number | null;
  gf: number | null;
  ga: number | null;
  pts: number | null;
};

export type WikiStadiumRow = {
  team: string;
  location: string | null;
  stadium: string | null;
  capacity: number | null;
};

export type WikiPageResult = {
  url: string;
  http_status: number | null;
  retrieved_at: string;
  title: string;
  standings: WikiStandingRow[];
  stadiums: WikiStadiumRow[];
  teams: string[];
  error: string | null;
};

const WIKI_PAGES: Record<string, { title: string; url: string }> = {
  E0: {
    title: "2026–27 Premier League",
    url: "https://en.wikipedia.org/api/rest_v1/page/html/2026%E2%80%9327_Premier_League",
  },
  I1: {
    title: "2026–27 Serie A",
    url: "https://en.wikipedia.org/api/rest_v1/page/html/2026%E2%80%9327_Serie_A",
  },
  SP1: {
    title: "2026–27 La Liga",
    url: "https://en.wikipedia.org/api/rest_v1/page/html/2026%E2%80%9327_La_Liga",
  },
  D1: {
    title: "2026–27 Bundesliga",
    url: "https://en.wikipedia.org/api/rest_v1/page/html/2026%E2%80%9327_Bundesliga",
  },
  F1: {
    title: "2026–27 Ligue 1",
    url: "https://en.wikipedia.org/api/rest_v1/page/html/2026%E2%80%9327_Ligue_1",
  },
};

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function num(s: string | undefined): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseWikiTables(html: string): { standings: WikiStandingRow[]; stadiums: WikiStadiumRow[] } {
  const tables = [...html.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)];
  const standings: WikiStandingRow[] = [];
  const stadiums: WikiStadiumRow[] = [];
  for (const m of tables) {
    const table = m[1] ?? "";
    const header = stripTags((table.match(/<tr[\s\S]*?<\/tr>/i)?.[0] ?? "")).toLowerCase();
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1);
    if (/\bpos\b/.test(header) && /\bpts\b/.test(header) && /\bpld\b/.test(header)) {
      for (const row of rows) {
        const cells = [...row[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1] ?? ""));
        if (cells.length < 8) continue;
        const rank = num(cells[0]);
        const team = cells[1]?.replace(/\[.*?\]/g, "").trim();
        if (rank == null || !team || team.length < 2) continue;
        standings.push({
          rank,
          team,
          played: num(cells[2]),
          win: num(cells[3]),
          draw: num(cells[4]),
          loss: num(cells[5]),
          gf: num(cells[6]),
          ga: num(cells[7]),
          pts: num(cells[9] ?? cells[8]),
        });
      }
      continue;
    }
    if (/stadium/.test(header) && /team/.test(header) && /capacity/.test(header)) {
      for (const row of rows) {
        const cells = [...row[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1] ?? ""));
        if (cells.length < 3) continue;
        const team = cells[0]?.replace(/\[.*?\]/g, "").trim();
        if (!team || team.length < 2) continue;
        stadiums.push({
          team,
          location: cells[1] || null,
          stadium: cells[2] || null,
          capacity: num(cells[3]),
        });
      }
    }
  }
  return { standings, stadiums };
}

export async function fetchWikipediaLeaguePage(input: {
  division: keyof typeof WIKI_PAGES;
  nowIso?: string;
  fetchImpl?: typeof fetch;
  htmlText?: string;
}): Promise<WikiPageResult> {
  const page = WIKI_PAGES[input.division];
  const retrieved_at = input.nowIso ?? new Date().toISOString();
  if (!page) {
    return {
      url: "",
      http_status: null,
      retrieved_at,
      title: String(input.division),
      standings: [],
      stadiums: [],
      teams: [],
      error: "NO_WIKI_PAGE_FOR_DIVISION",
    };
  }
  if (input.htmlText != null) {
    const parsed = parseWikiTables(input.htmlText);
    return {
      url: page.url,
      http_status: 200,
      retrieved_at,
      title: page.title,
      standings: parsed.standings,
      stadiums: parsed.stadiums,
      teams: [...new Set(parsed.stadiums.map((s) => s.team).concat(parsed.standings.map((s) => s.team)))],
      error: null,
    };
  }
  try {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const res = await fetchImpl(page.url, {
      headers: { Accept: "text/html", "User-Agent": "betmind-research/1.0 (ordinary GET; Wikipedia REST)" },
    });
    if (res.status === 403 || res.status === 401) {
      return {
        url: page.url,
        http_status: res.status,
        retrieved_at,
        title: page.title,
        standings: [],
        stadiums: [],
        teams: [],
        error: `BLOCKED HTTP ${res.status}`,
      };
    }
    if (!res.ok) {
      return {
        url: page.url,
        http_status: res.status,
        retrieved_at,
        title: page.title,
        standings: [],
        stadiums: [],
        teams: [],
        error: `HTTP_${res.status}`,
      };
    }
    const html = await res.text();
    const parsed = parseWikiTables(html);
    return {
      url: page.url,
      http_status: res.status,
      retrieved_at,
      title: page.title,
      standings: parsed.standings,
      stadiums: parsed.stadiums,
      teams: [...new Set(parsed.stadiums.map((s) => s.team).concat(parsed.standings.map((s) => s.team)))],
      error: parsed.standings.length === 0 && parsed.stadiums.length === 0 ? "NO_TABLES_PARSED" : null,
    };
  } catch (e) {
    return {
      url: page.url,
      http_status: null,
      retrieved_at,
      title: page.title,
      standings: [],
      stadiums: [],
      teams: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function standingForTeam(rows: WikiStandingRow[], teamName: string): WikiStandingRow | null {
  const n = teamName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const toks = n.split(" ").filter((t) => t.length >= 3);
  for (const r of rows) {
    const rn = r.team.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (rn === n) return r;
    if (toks.length && toks.every((t) => rn.includes(t))) return r;
  }
  return null;
}
