/**
 * Thin Understat acquisition-engine adapter.
 * Reuses getLeagueData + parseUnderstatLeagueJson / rollingPriorXg.
 * Ordinary GET with X-Requested-With (the page's own XHR) — not a WAF bypass.
 * available_at unknown → CONTEXT / NOT_ELIGIBLE. Never independent MODEL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import {
  parseUnderstatLeagueJson,
  rollingPriorXg,
  understatLeagueDataUrl,
  understatLeaguePageUrl,
  type UnderstatMatch,
} from "@/domain/eval/data-intelligence/research/understat-league";
import { UNDERSTAT_LEAGUES, understatSeasonYear } from "@/domain/eval/acquisition-engine/catalog";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

export function parseUnderstatEngineMatches(jsonText: string): UnderstatMatch[] {
  return parseUnderstatLeagueJson(jsonText);
}

export async function runUnderstatLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  labEvents?: AcquisitionCycleInput["labEvents"];
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  const year = understatSeasonYear(input.nowIso);
  const years = [year, year - 1];

  let text = input.jsonText;
  let http = 200;
  let retries = 0;
  let url = input.url;
  let usedYear = year;
  let usedLeague: (typeof UNDERSTAT_LEAGUES)[number] = UNDERSTAT_LEAGUES[0]!;
  const leaguesHit: string[] = [];
  const allMatches: UnderstatMatch[] = [];

  if (text == null) {
    for (const league of UNDERSTAT_LEAGUES) {
      for (const tryYear of years) {
        const dataUrl = understatLeagueDataUrl(league.slug, tryYear);
        const pageUrl = understatLeaguePageUrl(league.slug, tryYear);
        const got = await acquisitionGet({
          url: dataUrl,
          sourceId: "understat",
          minIntervalMs: input.fetchImpl ? 0 : 2_000,
          headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            Referer: pageUrl,
          },
          fetchImpl: input.fetchImpl,
          maxRetries: input.maxRetries,
        });
        retries += got.retries;
        http = got.status;
        url = got.url;
        if (!got.ok) {
          if (http === 403 || http === 401) {
            return emptyLane({
              source_id: "understat",
              url,
              status: "BLOCKED",
              http_status: http,
              retries,
              reason: got.error ?? `HTTP_${http}`,
              reason_it: "Understat ha restituito HTTP 403. Nessun bypass. Nessun xG inventato.",
            });
          }
          continue;
        }
        const parsed = parseUnderstatLeagueJson(got.text);
        if (!parsed.length) continue;
        text = got.text;
        usedYear = tryYear;
        usedLeague = league;
        leaguesHit.push(`${league.slug}:${tryYear}`);
        allMatches.push(...parsed);
        const cacheDirEarly = join(input.cwd, "data", "acquisition", "understat");
        mkdirSync(cacheDirEarly, { recursive: true });
        writeFileSync(join(cacheDirEarly, `${league.slug}-${tryYear}.json`), got.text, "utf8");
        break;
      }
    }
    if (!allMatches.length) {
      return emptyLane({
        source_id: "understat",
        url,
        status: http === 429 ? "RATE_LIMITED" : http >= 400 ? "NETWORK_ERROR" : "PARSE_ERROR",
        http_status: http || null,
        retries,
        reason: `HTTP_${http}`,
        reason_it: `Understat getLeagueData non disponibile (HTTP ${http || "?"}). Nessun xG inventato.`,
      });
    }
  } else {
    allMatches.push(...parseUnderstatLeagueJson(text));
  }

  const matches = allMatches;
  if (!matches.length) {
    return emptyLane({
      source_id: "understat",
      url,
      status: "PARSE_ERROR",
      http_status: http,
      retries,
      reason: "EMPTY_LEAGUE_DATES",
      reason_it: "getLeagueData Understat non contiene date/partite. Nessun xG inventato.",
    });
  }

  const cacheDir = join(input.cwd, "data", "acquisition", "understat");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, `${usedLeague.slug}-${usedYear}.json`);
  if (text) writeFileSync(cachePath, text, "utf8");

  const records: AcquisitionRecord[] = [
    {
      source_id: "understat",
      kind: "research_dataset",
      feature_key: "understat_matches_parsed",
      value: matches.length,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "unknown",
      feature_status: "NOT_ELIGIBLE",
      enters_independent_model: false,
      extraction_method: "understat_getLeagueData",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `${matches.length} partite Understat (${leaguesHit.join(", ") || `${usedLeague.label} ${usedYear}`}). available_at sconosciuto; solo contesto, non modello.`,
    },
  ];

  for (const ev of input.labEvents ?? []) {
    const roll = rollingPriorXg({
      matches,
      home: ev.home,
      away: ev.away,
      kickoffIso: ev.kickoff_utc ?? input.nowIso,
    });
    if (!roll.home_identity.matched && !roll.away_identity.matched) continue;
    if (roll.home_xg_l5 != null) {
      records.push({
        source_id: "understat",
        kind: "research_dataset",
        feature_key: "home_xg_l5",
        value: roll.home_xg_l5,
        event_id: ev.event_id,
        home: ev.home,
        away: ev.away,
        kickoff_iso: ev.kickoff_utc ?? null,
        team_name: ev.home,
        observed_at: input.nowIso,
        available_at: null,
        temporal_precision: "unknown",
        feature_status: "NOT_ELIGIBLE",
        enters_independent_model: false,
        extraction_method: "understat_getLeagueData_prior_only",
        source_url: url,
        identity_status: roll.home_identity.status,
        reason_it: `xG L5 casa Understat. available_at sconosciuto; escluso dal modello pre-match. ${roll.home_identity.reason_it}`,
      });
    }
    if (roll.away_xg_l5 != null) {
      records.push({
        source_id: "understat",
        kind: "research_dataset",
        feature_key: "away_xg_l5",
        value: roll.away_xg_l5,
        event_id: ev.event_id,
        home: ev.home,
        away: ev.away,
        kickoff_iso: ev.kickoff_utc ?? null,
        team_name: ev.away,
        observed_at: input.nowIso,
        available_at: null,
        temporal_precision: "unknown",
        feature_status: "NOT_ELIGIBLE",
        enters_independent_model: false,
        extraction_method: "understat_getLeagueData_prior_only",
        source_url: url,
        identity_status: roll.away_identity.status,
        reason_it: `xG L5 trasferta Understat. available_at sconosciuto; escluso dal modello pre-match. ${roll.away_identity.reason_it}`,
      });
    }
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "understat",
      name: "Understat",
      licenseClass: "public_endpoint",
    });
  }

  return {
    source_id: "understat",
    ok: true,
    fetched: true,
    status: "OK",
    http_status: http,
    url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `matches=${matches.length}; leagues=${leaguesHit.join(",") || usedLeague.slug}; year=${usedYear}; NOT_ELIGIBLE available_at unknown`,
    reason_it: `Understat getLeagueData: ${matches.length} partite (${leaguesHit.join(", ") || usedLeague.label}). available_at sconosciuto; non entra nel modello indipendente.`,
    retries,
    cache_path: cachePath,
    neon,
    coverage: {
      leagues: UNDERSTAT_LEAGUES.map((l) => l.label),
      sports: ["football"],
    },
  };
}
