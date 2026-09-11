/**
 * Real Understat xG acquisition check. No mocks. Writes artifacts/phase-8/xg-acquisition-report.json.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";
import {
  parseUnderstatLeagueJson,
  researchUnderstatLeague,
  overlayUnderstatXgOnFeatureData,
  understatLeagueDataUrl,
  type UnderstatMatch,
} from "@/domain/eval/data-intelligence/research/understat-league";
import { europeanSeasonYear } from "@/domain/eval/data-intelligence/research/identity-normalize";
import { buildAnalyzedTopics } from "@/domain/eval/betmind-runtime/explain/analyzed-topics";
import { buildFoundFacts } from "@/domain/eval/betmind-runtime/explain/found-facts";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

const LEAGUES: Array<{ slug: string; competition: string }> = [
  { slug: "EPL", competition: "soccer_epl" },
  { slug: "Serie_A", competition: "Serie A" },
  { slug: "La_liga", competition: "La Liga" },
  { slug: "Bundesliga", competition: "Bundesliga" },
  { slug: "Ligue_1", competition: "Ligue 1" },
];

function isoFromUnderstat(dt: string): string {
  const t = Date.parse(dt.includes("T") ? dt : dt.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

async function fetchLeagueJson(slug: string, year: number): Promise<{ http: number; matches: UnderstatMatch[]; bytes: number; url: string }> {
  const url = understatLeagueDataUrl(slug, year);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `https://understat.com/league/${slug}/${year}`,
      "User-Agent": "betmind-research/1.0 (+local; ordinary GET; no WAF bypass)",
    },
  });
  const text = await res.text();
  return { http: res.status, matches: parseUnderstatLeagueJson(text), bytes: text.length, url };
}

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const nowIso = new Date().toISOString();
  const cacheRoot = join(process.cwd(), "artifacts", "phase-8", "xg-verify-cache");
  mkdirSync(cacheRoot, { recursive: true });

  const sourcesFetched: Array<{ league: string; url: string; http: number; matches: number; bytes: number }> = [];
  const discovered: Array<{
    home: string;
    away: string;
    competition: string;
    kickoffIso: string;
    understat_id: string;
    is_result: boolean;
  }> = [];

  const season = europeanSeasonYear(nowIso);
  for (const lg of LEAGUES) {
    const got = await fetchLeagueJson(lg.slug, season);
    sourcesFetched.push({ league: lg.slug, url: got.url, http: got.http, matches: got.matches.length, bytes: got.bytes });
    const upcoming = got.matches.filter((m) => !m.is_result);
    const recent = got.matches.filter((m) => m.is_result).sort((a, b) => a.datetime.localeCompare(b.datetime)).slice(-8);
    for (const m of [...upcoming.slice(0, 3), ...recent.slice(-2)]) {
      discovered.push({
        home: m.home,
        away: m.away,
        competition: lg.competition,
        kickoffIso: isoFromUnderstat(m.datetime),
        understat_id: m.id,
        is_result: m.is_result,
      });
    }
  }

  let storeEvents: PermanentEvent044[] = [];
  try {
    const store = loadStore044(permanentRoot044());
    const nowMs = Date.now();
    storeEvents = store.events.filter((e) => {
      const ko = e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN;
      const sport = String((e as { sport?: string }).sport ?? "soccer").toLowerCase();
      return Number.isFinite(ko) && ko >= nowMs - 14 * 86400_000 && /soccer|football|calcio/.test(sport);
    }).slice(0, 12);
  } catch {
    storeEvents = [];
  }

  const batch: Array<{
    eventId: string;
    home: string;
    away: string;
    competition: string;
    kickoffIso: string;
    origin: "store" | "understat_calendar";
  }> = [];
  for (const e of storeEvents) {
    batch.push({
      eventId: e.event_id,
      home: e.home_or_a,
      away: e.away_or_b,
      competition: e.competition ?? "soccer_epl",
      kickoffIso: e.kickoff_utc ?? nowIso,
      origin: "store",
    });
  }
  for (const d of discovered) {
    if (batch.length >= 20) break;
    batch.push({
      eventId: `xg-verify-${d.understat_id}`,
      home: d.home,
      away: d.away,
      competition: d.competition,
      kickoffIso: d.kickoffIso,
      origin: "understat_calendar",
    });
  }

  const results = [];
  let withXg = 0;
  let obsCount = 0;
  const teamNames = new Set<string>();
  for (const ev of batch) {
    const lane = await researchUnderstatLeague({
      eventId: ev.eventId,
      home: ev.home,
      away: ev.away,
      competition: ev.competition,
      kickoffIso: ev.kickoffIso,
      nowIso,
      cacheRoot,
    });
    const xgObs = lane.observations.filter((o) => /xg/i.test(o.feature_key) && typeof o.value === "number");
    if (xgObs.length) {
      withXg += 1;
      obsCount += xgObs.length;
      teamNames.add(ev.home);
      teamNames.add(ev.away);
    }
    const bag = overlayUnderstatXgOnFeatureData({
      featureData: [
        {
          key: "home_xg_prematch",
          source: "none",
          available_at: null,
          feature_time: nowIso,
          value: null,
          quality: null,
          status: "UNAVAILABLE",
          temporal_precision: "UNKNOWN",
          entered_model: false,
        },
      ],
      observations: lane.observations,
      eventId: ev.eventId,
      featureTime: nowIso,
    });
    const bagXg = bag.filter((d) => /xg/i.test(d.key) && d.value != null);
    const fields = lane.observations.map((o) => o.feature_key);
    const topics = buildAnalyzedTopics({
      entered_keys: [],
      excluded_keys: [],
      research_fields: fields,
      temporal_excluded: false,
    });
    const xgTopic = topics.find((t) => t.id === "xg");
    const found = buildFoundFacts({ observations: lane.observations, home: ev.home, away: ev.away });
    results.push({
      event_id: ev.eventId,
      match: `${ev.home} vs ${ev.away}`,
      competition: ev.competition,
      kickoff_utc: ev.kickoffIso,
      origin: ev.origin,
      status: lane.status,
      url: lane.url,
      http_status: lane.http_status,
      match_id: lane.match_id,
      reason: lane.reason,
      observation_count: lane.observations.length,
      xg_values: xgObs.map((o) => ({ key: o.feature_key, value: o.value, available_at: o.available_at, enters_model: o.enters_independent_model })),
      feature_bag_xg: bagXg.map((d) => ({ key: d.key, value: d.value, status: d.status, entered_model: d.entered_model })),
      italian_xg: xgTopic ? { light: xgTopic.light, note_it: xgTopic.note_it } : null,
      found_lines: found.filter((l) => /xg|Expected/i.test(l)).slice(0, 6),
    });
  }

  const report = {
    at: nowIso,
    runtime: ANALYSIS_RUNTIME_VERSION,
    events_attempted: batch.length,
    events_with_real_xg_obs: withXg,
    observation_counts: obsCount,
    sample_team_names: [...teamNames].slice(0, 24),
    sources_fetched: sourcesFetched,
    notes: {
      endpoint: "GET https://understat.com/getLeagueData/{league}/{season} with X-Requested-With: XMLHttpRequest (public page XHR, not a WAF bypass)",
      html_datesData: "League HTML still has no datesData; JSON path is the production path",
      model: "xG observations have available_at=null and enters_independent_model=false; overlay status NOT_ELIGIBLE",
      zeros: "Missing xG stays null; completed-match 0 would persist only if Understat published 0",
    },
    results,
  };

  const outDir = join(process.cwd(), "artifacts", "phase-8");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "xg-acquisition-report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        events_attempted: report.events_attempted,
        events_with_real_xg_obs: report.events_with_real_xg_obs,
        observation_counts: report.observation_counts,
        sample_team_names: report.sample_team_names,
        sources_fetched: report.sources_fetched,
        sample: report.results.slice(0, 6).map((r) => ({
          match: r.match,
          status: r.status,
          n: r.observation_count,
          italian: r.italian_xg,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
