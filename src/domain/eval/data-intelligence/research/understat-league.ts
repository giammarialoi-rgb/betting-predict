/**
 * Understat league-page xG. Target match xG is never used for pre-match MODEL.
 * DATE_ONLY / scrape clock: rolling priors stay CONTEXT unless available_at is demonstrated.
 */
import { namesEqual, resolveCompetitionMatrix, europeanSeasonYear } from "@/domain/eval/data-intelligence/research/identity-normalize";
import { mergeSourceEventIdentity } from "@/domain/eval/data-intelligence/research/source-identity-cache";
import { readScrapeCache, writeScrapeCache } from "@/domain/eval/data-intelligence/research/scrape-cache";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

export type UnderstatMatch = {
  id: string;
  datetime: string;
  home: string;
  away: string;
  home_xg: number | null;
  away_xg: number | null;
  is_result: boolean;
};

export type UnderstatLaneResult = {
  status: "SUCCESS" | "PARTIAL" | "NO_EVENT" | "BLOCKED" | "HTTP_ERROR" | "NO_DATA" | "PARSE_ERROR" | "DENIED";
  http_status: number | null;
  url: string;
  match_id: string | null;
  observations: ResearchObservation[];
  reason: string;
  fetched: boolean;
};

function decodeJsStringArg(raw: string): string {
  return raw
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export function parseUnderstatDatesData(html: string): UnderstatMatch[] {
  const m =
    html.match(/datesData\s*=\s*JSON\.parse\('((?:\\'|[^'])*)'\)/) ??
    html.match(/datesData\s*=\s*JSON\.parse\("((?:\\"|[^"])*)"\)/);
  if (!m) return [];
  try {
    const decoded = decodeJsStringArg(m[1]!);
    const parsed = JSON.parse(decoded) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: UnderstatMatch[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const h = r.h as { title?: string; id?: string } | undefined;
      const a = r.a as { title?: string; id?: string } | undefined;
      const xg = r.xG as { h?: string | number; a?: string | number } | undefined;
      const id = r.id != null ? String(r.id) : "";
      if (!id || !h?.title || !a?.title) continue;
      const hx = xg?.h != null ? Number(xg.h) : NaN;
      const ax = xg?.a != null ? Number(xg.a) : NaN;
      out.push({
        id,
        datetime: String(r.datetime ?? r.date ?? ""),
        home: h.title,
        away: a.title,
        home_xg: Number.isFinite(hx) ? hx : null,
        away_xg: Number.isFinite(ax) ? ax : null,
        is_result: Boolean(r.isResult),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000;
}

function kickMs(iso: string): number {
  const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? t : NaN;
}

export function rollingPriorXg(input: {
  matches: UnderstatMatch[];
  home: string;
  away: string;
  kickoffIso: string;
  window?: number;
}): {
  target: UnderstatMatch | null;
  home_xg_l5: number | null;
  away_xg_l5: number | null;
  home_xga_l5: number | null;
  away_xga_l5: number | null;
  prior_n_home: number;
  prior_n_away: number;
} {
  const window = input.window ?? 5;
  const cutoff = Date.parse(input.kickoffIso);
  const day = input.kickoffIso.slice(0, 10);
  const target =
    input.matches.find(
      (m) =>
        namesEqual(m.home, input.home) &&
        namesEqual(m.away, input.away) &&
        (m.datetime.slice(0, 10) === day || Math.abs(kickMs(m.datetime) - cutoff) < 36 * 3600_000),
    ) ?? null;

  const priorsHome: { xg: number; xga: number; t: number }[] = [];
  const priorsAway: { xg: number; xga: number; t: number }[] = [];
  for (const m of input.matches) {
    if (target && m.id === target.id) continue; // never include target
    const t = kickMs(m.datetime);
    if (!Number.isFinite(t) || !Number.isFinite(cutoff) || t >= cutoff) continue;
    if (m.home_xg == null || m.away_xg == null) continue;
    if (namesEqual(m.home, input.home)) priorsHome.push({ xg: m.home_xg, xga: m.away_xg, t });
    else if (namesEqual(m.away, input.home)) priorsHome.push({ xg: m.away_xg, xga: m.home_xg, t });
    if (namesEqual(m.home, input.away)) priorsAway.push({ xg: m.home_xg, xga: m.away_xg, t });
    else if (namesEqual(m.away, input.away)) priorsAway.push({ xg: m.away_xg, xga: m.home_xg, t });
  }
  const last = (xs: { xg: number; xga: number; t: number }[]) =>
    xs.sort((a, b) => a.t - b.t).slice(-window);
  const h = last(priorsHome);
  const a = last(priorsAway);
  return {
    target,
    home_xg_l5: mean(h.map((x) => x.xg)),
    away_xg_l5: mean(a.map((x) => x.xg)),
    home_xga_l5: mean(h.map((x) => x.xga)),
    away_xga_l5: mean(a.map((x) => x.xga)),
    prior_n_home: h.length,
    prior_n_away: a.length,
  };
}

export async function researchUnderstatLeague(input: {
  eventId: string;
  home: string;
  away: string;
  competition?: string | null;
  kickoffIso: string;
  nowIso: string;
  cacheRoot?: string;
  fetchImpl?: typeof fetch;
  htmlText?: string;
}): Promise<UnderstatLaneResult> {
  const comp = resolveCompetitionMatrix(input.competition);
  if (!comp.understat_slug) {
    return {
      status: "DENIED",
      http_status: null,
      url: "",
      match_id: null,
      observations: [],
      reason: "No Understat league slug for this competition — not guessed.",
      fetched: false,
    };
  }
  const season = europeanSeasonYear(input.kickoffIso);
  const seasons = [season, season - 1];
  const html: string | null = input.htmlText ?? null;
  let http: number | null = null;
  let url = `https://understat.com/league/${comp.understat_slug}/${season}`;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const fetchSeason = async (year: number): Promise<{ html: string; http: number; url: string } | null> => {
    const u = `https://understat.com/league/${comp.understat_slug}/${year}`;
    const cached = readScrapeCache({ url: u, sourceId: "understat", root: input.cacheRoot });
    if (cached && cached.http_status < 400) return { html: cached.body, http: cached.http_status, url: u };
    try {
      const res = await fetchImpl(u, {
        headers: {
          Accept: "text/html,*/*",
          "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
        },
      });
      const body = await res.text();
      writeScrapeCache({
        url: u,
        http_status: res.status,
        body,
        content_hash: `understat-${body.length}`,
        nowIso: input.nowIso,
        root: input.cacheRoot,
      });
      return { html: body, http: res.status, url: u };
    } catch {
      return null;
    }
  };

  const matches: UnderstatMatch[] = [];
  if (html != null) {
    matches.push(...parseUnderstatDatesData(html));
    http = 200;
  } else {
    for (const year of seasons) {
      const got = await fetchSeason(year);
      if (!got) continue;
      url = got.url;
      http = got.http;
      if (got.http === 403 || got.http === 401 || got.http === 429) {
        return {
          status: "BLOCKED",
          http_status: got.http,
          url: got.url,
          match_id: null,
          observations: [],
          reason: `BLOCKED HTTP ${got.http} — no WAF bypass`,
          fetched: true,
        };
      }
      if (got.http >= 400) continue;
      matches.push(...parseUnderstatDatesData(got.html));
    }
  }
  if (!matches.length) {
    return {
      status: "PARSE_ERROR",
      http_status: http,
      url,
      match_id: null,
      observations: [],
      reason: "PARSE_ERROR — datesData not found or empty",
      fetched: true,
    };
  }
  const roll = rollingPriorXg({
    matches,
    home: input.home,
    away: input.away,
    kickoffIso: input.kickoffIso,
  });
  if (roll.target) {
    mergeSourceEventIdentity(
      input.eventId,
      {
        understat_match_id: roll.target.id,
        source_event_url: { understat: `https://understat.com/match/${roll.target.id}` },
        retrieved_at: input.nowIso,
      },
      input.cacheRoot,
    );
  }
  const obs: ResearchObservation[] = [];
  const push = (key: string, value: number | null) => {
    if (value == null || !Number.isFinite(value)) return;
    obs.push({
      event_id: input.eventId,
      feature_key: key,
      value,
      source: "understat",
      source_url: url,
      observed_at: input.nowIso,
      available_at: null,
      extraction_method: "understat_datesData_prior_only",
      confidence: null,
      status: "CONTEXT",
      kind: "HISTORICAL_PRIOR",
      derived_from: ["understat_datesData", "excluded_target=true"],
      enters_independent_model: false,
    });
  };
  push("home_xg_l5", roll.home_xg_l5);
  push("away_xg_l5", roll.away_xg_l5);
  push("home_xga_l5", roll.home_xga_l5);
  push("away_xga_l5", roll.away_xga_l5);
  // Target-match xG is post/in-play — never persisted into pre-match MODEL path.
  if (!obs.length && !roll.target) {
    return {
      status: "NO_EVENT",
      http_status: http,
      url,
      match_id: null,
      observations: [],
      reason: "NO_EVENT — teams not found on Understat league page",
      fetched: true,
    };
  }
  if (!obs.length) {
    return {
      status: "NO_DATA",
      http_status: http,
      url,
      match_id: roll.target?.id ?? null,
      observations: [],
      reason: "Event listed but no prior xG rows before kickoff",
      fetched: true,
    };
  }
  return {
    status: roll.prior_n_home >= 3 && roll.prior_n_away >= 3 ? "SUCCESS" : "PARTIAL",
    http_status: http ?? 200,
    url,
    match_id: roll.target?.id ?? null,
    observations: obs,
    reason: `Prior xG only (excluded_target=true). home_n=${roll.prior_n_home} away_n=${roll.prior_n_away}`,
    fetched: true,
  };
}
