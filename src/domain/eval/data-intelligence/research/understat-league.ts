/**
 * Understat xG acquisition.
 *
 * League HTML no longer embeds datesData (JS loads it). The public endpoint the
 * page itself calls is GET /getLeagueData/{league}/{season} with
 * X-Requested-With: XMLHttpRequest — ordinary GET, not a WAF/CAPTCHA bypass.
 *
 * Target-match xG is never used for pre-match MODEL. Rolling L5 priors from
 * completed matches only. available_at stays null unless a publication clock
 * is demonstrated — so values enter the feature bag as CONTEXT / NOT_ELIGIBLE.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  identityKey,
  normalizeTeamName,
  resolveCompetitionMatrix,
  europeanSeasonYear,
} from "@/domain/eval/data-intelligence/research/identity-normalize";
import { pickUniqueTeam } from "@/domain/eval/data-intelligence/research/identity-match";
import { mergeSourceEventIdentity } from "@/domain/eval/data-intelligence/research/source-identity-cache";
import { upsertTeamIdentity } from "@/domain/eval/data-intelligence/research/identity-registry";
import { readScrapeCache, writeScrapeCache } from "@/domain/eval/data-intelligence/research/scrape-cache";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import type { FeatureDatum } from "@/domain/eval/predictive-intelligence/types";

export type UnderstatMatch = {
  id: string;
  datetime: string;
  home: string;
  away: string;
  home_id: string | null;
  away_id: string | null;
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

export const UNDERSTAT_XG_FEATURE_KEYS = [
  "home_xg_l5",
  "away_xg_l5",
  "home_xga_l5",
  "away_xga_l5",
  "home_xg_prematch",
  "away_xg_prematch",
  "home_xga_prematch",
  "away_xga_prematch",
] as const;

const JSON_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

function decodeJsStringArg(raw: string): string {
  return raw
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function teamTitle(v: unknown): { title: string; id: string | null } | null {
  if (v && typeof v === "object") {
    const o = v as { title?: unknown; id?: unknown; name?: unknown };
    const title = String(o.title ?? o.name ?? "").trim();
    if (!title) return null;
    const id = o.id != null && String(o.id).trim() ? String(o.id) : null;
    return { title, id };
  }
  if (typeof v === "string" && v.trim()) return { title: v.trim(), id: null };
  return null;
}

function rowToMatch(row: unknown): UnderstatMatch | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const h = teamTitle(r.h ?? r.home);
  const a = teamTitle(r.a ?? r.away);
  const id = r.id != null ? String(r.id) : "";
  if (!id || !h?.title || !a?.title) return null;
  const xg = (r.xG ?? r.xg) as { h?: unknown; a?: unknown } | undefined;
  return {
    id,
    datetime: String(r.datetime ?? r.date ?? ""),
    home: h.title,
    away: a.title,
    home_id: h.id,
    away_id: a.id,
    home_xg: numOrNull(xg?.h),
    away_xg: numOrNull(xg?.a),
    is_result: Boolean(r.isResult ?? r.is_result),
  };
}

function datesArrayFromParsed(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const o = parsed as Record<string, unknown>;
  if (Array.isArray(o.dates)) return o.dates;
  if (Array.isArray(o.datesData)) return o.datesData;
  return [];
}

/** Parse Understat getLeagueData JSON (`{ dates, teams, players }`). */
export function parseUnderstatLeagueJson(text: string): UnderstatMatch[] {
  const trimmed = String(text ?? "").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const dates = datesArrayFromParsed(parsed);
    const out: UnderstatMatch[] = [];
    const seen = new Set<string>();
    for (const row of dates) {
      const m = rowToMatch(row);
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  } catch {
    return [];
  }
}

/** Parse embedded `datesData = JSON.parse(...)` from HTML, or raw league JSON. */
export function parseUnderstatDatesData(html: string): UnderstatMatch[] {
  const fromJson = parseUnderstatLeagueJson(html);
  if (fromJson.length) return fromJson;
  const m =
    html.match(/datesData\s*=\s*JSON\.parse\('((?:\\'|[^'])*)'\)/) ??
    html.match(/datesData\s*=\s*JSON\.parse\("((?:\\"|[^"])*)"\)/);
  if (!m) return [];
  try {
    const decoded = decodeJsStringArg(m[1]!);
    return parseUnderstatLeagueJson(decoded);
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

function uniqueTeamTitles(matches: UnderstatMatch[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    for (const title of [m.home, m.away]) {
      const k = identityKey(title);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(title);
    }
  }
  return out;
}

function sameIdentity(candidate: string, key: string | null): boolean {
  return Boolean(key && identityKey(candidate) === key);
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
  prior_home_ids: string[];
  prior_away_ids: string[];
  home_team_id: string | null;
  away_team_id: string | null;
  home_identity: ReturnType<typeof pickUniqueTeam>;
  away_identity: ReturnType<typeof pickUniqueTeam>;
} {
  const window = input.window ?? 5;
  const cutoff = Date.parse(input.kickoffIso);
  const day = input.kickoffIso.slice(0, 10);
  const titles = uniqueTeamTitles(input.matches);
  const homeIdentity = pickUniqueTeam(input.home, titles);
  const awayIdentity = pickUniqueTeam(input.away, titles);
  const homeKey = homeIdentity.matched ? homeIdentity.identity_key : null;
  const awayKey = awayIdentity.matched ? awayIdentity.identity_key : null;

  const target =
    homeKey && awayKey
      ? (input.matches.find(
          (m) =>
            sameIdentity(m.home, homeKey) &&
            sameIdentity(m.away, awayKey) &&
            (m.datetime.slice(0, 10) === day || Math.abs(kickMs(m.datetime) - cutoff) < 36 * 3600_000),
        ) ?? null)
      : null;

  const priorsHome: { xg: number; xga: number; t: number; id: string }[] = [];
  const priorsAway: { xg: number; xga: number; t: number; id: string }[] = [];
  let homeTeamId: string | null = target?.home_id ?? null;
  let awayTeamId: string | null = target?.away_id ?? null;
  for (const m of input.matches) {
    if (target && m.id === target.id) continue; // never include target
    const t = kickMs(m.datetime);
    if (!Number.isFinite(t) || !Number.isFinite(cutoff) || t >= cutoff) continue;
    if (m.home_xg == null || m.away_xg == null) continue;
    if (sameIdentity(m.home, homeKey)) {
      priorsHome.push({ xg: m.home_xg, xga: m.away_xg, t, id: m.id });
      homeTeamId = homeTeamId ?? m.home_id;
    } else if (sameIdentity(m.away, homeKey)) {
      priorsHome.push({ xg: m.away_xg, xga: m.home_xg, t, id: m.id });
      homeTeamId = homeTeamId ?? m.away_id;
    }
    if (sameIdentity(m.home, awayKey)) {
      priorsAway.push({ xg: m.home_xg, xga: m.away_xg, t, id: m.id });
      awayTeamId = awayTeamId ?? m.home_id;
    } else if (sameIdentity(m.away, awayKey)) {
      priorsAway.push({ xg: m.away_xg, xga: m.home_xg, t, id: m.id });
      awayTeamId = awayTeamId ?? m.away_id;
    }
  }
  const last = (xs: { xg: number; xga: number; t: number; id: string }[]) =>
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
    prior_home_ids: h.map((x) => x.id),
    prior_away_ids: a.map((x) => x.id),
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    home_identity: homeIdentity,
    away_identity: awayIdentity,
  };
}

type CachedLeagueJson = {
  url: string;
  retrieved_at: string;
  http_status: number;
  body: string;
};

function jsonCachePath(root: string, slug: string, year: number): string {
  return join(root, "understat-cache", `${slug}-${year}.json`);
}

function readLeagueJsonCache(root: string, slug: string, year: number, nowMs: number): CachedLeagueJson | null {
  const p = jsonCachePath(root, slug, year);
  if (!existsSync(p)) return null;
  try {
    const row = JSON.parse(readFileSync(p, "utf8")) as CachedLeagueJson;
    if (!row?.body || typeof row.http_status !== "number") return null;
    const t = Date.parse(row.retrieved_at);
    if (!Number.isFinite(t) || nowMs - t > JSON_CACHE_TTL_MS) return null;
    return row;
  } catch {
    return null;
  }
}

function writeLeagueJsonCache(root: string, slug: string, year: number, row: CachedLeagueJson): void {
  mkdirSync(join(root, "understat-cache"), { recursive: true });
  writeFileSync(jsonCachePath(root, slug, year), JSON.stringify(row), "utf8");
}

function abortSignal(): AbortSignal | undefined {
  const anyAbort = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof anyAbort.timeout === "function") return anyAbort.timeout(FETCH_TIMEOUT_MS);
  return undefined;
}

export function understatLeagueDataUrl(slug: string, year: number): string {
  return `https://understat.com/getLeagueData/${slug}/${year}`;
}

export function understatLeaguePageUrl(slug: string, year: number): string {
  return `https://understat.com/league/${slug}/${year}`;
}

function xhrHeaders(referer: string): Record<string, string> {
  return {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Referer: referer,
    "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
  };
}

/**
 * Overlay Understat xG observations onto PI feature_data.
 * Never sets ELIGIBLE / entered_model — available_at is unknown.
 * Does not mutate `values` (caller must not feed these into independent MODEL).
 */
export function overlayUnderstatXgOnFeatureData(input: {
  featureData: FeatureDatum[];
  observations: ResearchObservation[];
  eventId: string;
  featureTime: string;
}): FeatureDatum[] {
  const out = [...input.featureData];
  const xgObs = input.observations.filter((o) => {
    if (o.source !== "understat") return false;
    if (!(UNDERSTAT_XG_FEATURE_KEYS as readonly string[]).includes(o.feature_key)) return false;
    return typeof o.value === "number" && Number.isFinite(o.value);
  });
  for (const o of xgObs) {
    const datum: FeatureDatum = {
      key: o.feature_key,
      source: "understat",
      event_id: input.eventId,
      available_at: o.available_at,
      feature_time: input.featureTime,
      value: o.value as number,
      quality: 0,
      status: "NOT_ELIGIBLE",
      temporal_precision: "UNKNOWN",
      derived_from: o.derived_from,
      calculation:
        "mean of last 5 completed Understat matches for this team; target excluded; available_at unknown so not MODEL",
      origin: "LIVE_RESEARCH",
      entered_model: false,
    };
    const idx = out.findIndex((f) => f.key === o.feature_key);
    if (idx >= 0) {
      if (out[idx]!.status === "ELIGIBLE") continue;
      out[idx] = datum;
    } else {
      out.push(datum);
    }
  }
  return out;
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
  jsonText?: string;
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
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const cacheRoot = input.cacheRoot;
  const nowMs = Date.parse(input.nowIso) || Date.now();

  let http: number | null = null;
  let url = understatLeagueDataUrl(comp.understat_slug, season);
  let primaryUrl: string | null = null;
  let sawBlocked: number | null = null;
  const matches: UnderstatMatch[] = [];
  const seenIds = new Set<string>();

  const pushMatches = (rows: UnderstatMatch[]) => {
    for (const m of rows) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      matches.push(m);
    }
  };

  if (input.jsonText != null) {
    pushMatches(parseUnderstatLeagueJson(input.jsonText));
    http = 200;
    url = understatLeagueDataUrl(comp.understat_slug, season);
  } else if (input.htmlText != null) {
    pushMatches(parseUnderstatDatesData(input.htmlText));
    http = 200;
    url = understatLeaguePageUrl(comp.understat_slug, season);
  } else {
    for (const year of seasons) {
      const dataUrl = understatLeagueDataUrl(comp.understat_slug, year);
      const pageUrl = understatLeaguePageUrl(comp.understat_slug, year);
      const noteOkUrl = (u: string) => {
        url = u;
        if (year === season) primaryUrl = u;
      };
      url = dataUrl;
      let body: string | null = null;
      let status: number | null = null;

      if (cacheRoot) {
        const cached = readLeagueJsonCache(cacheRoot, comp.understat_slug, year, nowMs);
        if (cached && cached.http_status < 400) {
          body = cached.body;
          status = cached.http_status;
          url = cached.url || dataUrl;
        }
      }

      if (body == null) {
        try {
          const signal = abortSignal();
          const res = await fetchImpl(dataUrl, {
            method: "GET",
            headers: xhrHeaders(pageUrl),
            ...(signal ? { signal } : {}),
          });
          status = res.status;
          body = await res.text();
          http = status;
          if (cacheRoot && status < 400 && body) {
            writeLeagueJsonCache(cacheRoot, comp.understat_slug, year, {
              url: dataUrl,
              retrieved_at: input.nowIso,
              http_status: status,
              body,
            });
          }
        } catch {
          status = null;
          body = null;
        }
      } else {
        http = status;
      }

      if (status === 403 || status === 401 || status === 429) {
        sawBlocked = status;
        continue;
      }
      if (status != null && status >= 400) {
        http = status;
        continue;
      }
      if (body) {
        const parsed = parseUnderstatDatesData(body);
        if (parsed.length) {
          pushMatches(parsed);
          http = status ?? 200;
          noteOkUrl(dataUrl);
          continue;
        }
      }

      // HTML fallback — datesData used to be inline; keep for regression / older pages.
      if (cacheRoot) {
        const htmlCached = readScrapeCache({ url: pageUrl, sourceId: "understat", root: cacheRoot, nowMs });
        if (htmlCached && htmlCached.http_status < 400) {
          const parsed = parseUnderstatDatesData(htmlCached.body);
          if (parsed.length) {
            pushMatches(parsed);
            http = htmlCached.http_status;
            noteOkUrl(pageUrl);
            continue;
          }
        }
      }
      try {
        const signal = abortSignal();
        const res = await fetchImpl(pageUrl, {
          method: "GET",
          headers: {
            Accept: "text/html,*/*",
            "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
          },
          ...(signal ? { signal } : {}),
        });
        const html = await res.text();
        http = res.status;
        if (cacheRoot) {
          writeScrapeCache({
            url: pageUrl,
            http_status: res.status,
            body: html,
            content_hash: `understat-html-${html.length}`,
            nowIso: input.nowIso,
            root: cacheRoot,
          });
        }
        if (res.status === 403 || res.status === 401 || res.status === 429) {
          sawBlocked = res.status;
          continue;
        }
        if (res.status >= 400) continue;
        const parsedHtml = parseUnderstatDatesData(html);
        if (parsedHtml.length) {
          pushMatches(parsedHtml);
          noteOkUrl(pageUrl);
        }
      } catch {
        /* next season */
      }
    }
  }

  if (primaryUrl) url = primaryUrl;

  if (!matches.length) {
    if (sawBlocked != null) {
      return {
        status: "BLOCKED",
        http_status: sawBlocked,
        url,
        match_id: null,
        observations: [],
        reason: `BLOCKED HTTP ${sawBlocked} — no WAF bypass`,
        fetched: true,
      };
    }
    return {
      status: "PARSE_ERROR",
      http_status: http,
      url,
      match_id: null,
      observations: [],
      reason: "PARSE_ERROR — getLeagueData/datesData not found or empty",
      fetched: true,
    };
  }

  const roll = rollingPriorXg({
    matches,
    home: input.home,
    away: input.away,
    kickoffIso: input.kickoffIso,
  });

  if (cacheRoot) {
    if (roll.target || roll.home_team_id || roll.away_team_id) {
      mergeSourceEventIdentity(
        input.eventId,
        {
          understat_match_id: roll.target?.id ?? null,
          source_event_url: roll.target
            ? { understat: `https://understat.com/match/${roll.target.id}` }
            : {},
          source_team_ids: {
            understat: {
              home: roll.home_team_id,
              away: roll.away_team_id,
            },
          },
          retrieved_at: input.nowIso,
        },
        cacheRoot,
      );
    }
    if (roll.home_team_id) {
      upsertTeamIdentity({
        canonical_id: normalizeTeamName(input.home),
        display_name: input.home,
        source_ids: { understat: roll.home_team_id },
        root: cacheRoot,
      });
    }
    if (roll.away_team_id) {
      upsertTeamIdentity({
        canonical_id: normalizeTeamName(input.away),
        display_name: input.away,
        source_ids: { understat: roll.away_team_id },
        root: cacheRoot,
      });
    }
  }

  const obs: ResearchObservation[] = [];
  const derivedFrom = [
    "understat_getLeagueData",
    "excluded_target=true",
    ...roll.prior_home_ids.map((id) => `home_prior:${id}`),
    ...roll.prior_away_ids.map((id) => `away_prior:${id}`),
  ];
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
      extraction_method: "understat_getLeagueData_prior_only",
      confidence: null,
      status: "REAL",
      kind: "HISTORICAL_PRIOR",
      derived_from: derivedFrom,
      enters_independent_model: false,
      source_event_id: roll.target?.id ?? null,
      target_event_id: input.eventId,
    });
  };
  push("home_xg_l5", roll.home_xg_l5);
  push("away_xg_l5", roll.away_xg_l5);
  push("home_xga_l5", roll.home_xga_l5);
  push("away_xga_l5", roll.away_xga_l5);
  // Canonical feature-bag keys (same values; still not MODEL).
  push("home_xg_prematch", roll.home_xg_l5);
  push("away_xg_prematch", roll.away_xg_l5);
  push("home_xga_prematch", roll.home_xga_l5);
  push("away_xga_prematch", roll.away_xga_l5);

  const identityNote = `home_identity=${roll.home_identity.status} away_identity=${roll.away_identity.status}`;
  const identityIt = [roll.home_identity.reason_it, roll.away_identity.reason_it].filter(Boolean).join(" ");
  if (!obs.length && !roll.target) {
    const blocked =
      roll.home_identity.status === "SHORT_NAME_BLOCKED" ||
      roll.away_identity.status === "SHORT_NAME_BLOCKED" ||
      roll.home_identity.status === "AMBIGUOUS" ||
      roll.away_identity.status === "AMBIGUOUS";
    return {
      status: "NO_EVENT",
      http_status: http,
      url,
      match_id: null,
      observations: [],
      reason: blocked
        ? `NO_EVENT — ${identityNote}. ${roll.home_identity.reason}; ${roll.away_identity.reason}. ${identityIt}`
        : `NO_EVENT — teams not found on Understat league payload. ${identityNote}. ${identityIt}`,
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
      reason: `Event listed but no prior xG rows before kickoff. ${identityNote}. ${identityIt}`,
      fetched: true,
    };
  }
  return {
    status: roll.prior_n_home >= 3 && roll.prior_n_away >= 3 ? "SUCCESS" : "PARTIAL",
    http_status: http ?? 200,
    url,
    match_id: roll.target?.id ?? null,
    observations: obs,
    reason: `Prior xG only (excluded_target=true). home_n=${roll.prior_n_home} away_n=${roll.prior_n_away} source=getLeagueData. ${identityNote}. ${identityIt}`,
    fetched: true,
  };
}
