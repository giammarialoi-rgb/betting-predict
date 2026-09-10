/**
 * Persist Football-Data priors as typed observations.
 * Values come from the same PI engine the model uses. Target match excluded.
 * DATE_ONLY: available_at stays null. Odds columns never emitted.
 */
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

const ODDS_RE = /^(odd|odds|price|implied|maxhome|maxdraw|maxaway|over25|under25)/i;

export function extractFootballDataObservations(input: {
  eventId: string;
  home: string;
  away: string;
  competition?: string | null;
  kickoffIso: string;
  nowIso: string;
  labBRoot?: string;
}): ResearchObservation[] {
  const matches = loadPiMatches(input.labBRoot);
  if (!matches.length) return [];
  const targetMeta = resolveLivePiTarget({
    home_team: input.home,
    away_team: input.away,
    competition: input.competition,
    matches,
  });
  if (!targetMeta.home_matched || !targetMeta.away_matched || !targetMeta.division) return [];
  const day = input.kickoffIso.slice(0, 10);
  const kick = input.kickoffIso.includes("T") ? input.kickoffIso : `${day}T12:00:00.000Z`;
  const dummy: PiMatchRow = {
    canonical_id: `live|${day}|${targetMeta.home_team_id}|${targetMeta.away_team_id}`,
    source: "football-data-co-uk",
    season: targetMeta.season,
    league: targetMeta.division,
    match_date: day,
    event_time: kick,
    home_team: input.home,
    away_team: input.away,
    home_team_id: targetMeta.home_team_id,
    away_team_id: targetMeta.away_team_id,
    fthg: 0,
    ftag: 0,
    ftr: "DRAW",
    hthg: null,
    htag: null,
    htr: null,
    hs: null,
    as: null,
    hst: null,
    ast: null,
    hc: null,
    ac: null,
    hy: null,
    ay: null,
    hr: null,
    ar: null,
    odds_open: {
      B365: { home: null, draw: null, away: null },
      PS: { home: null, draw: null, away: null },
      Avg: { home: null, draw: null, away: null },
    },
    research_odds_close: {
      B365C: { home: null, draw: null, away: null },
      PSC: { home: null, draw: null, away: null },
    },
    label_time: kick,
    result_available_at: kick,
  };
  const vec = buildFeatureVectorPi(dummy, matches);
  const out: ResearchObservation[] = [];
  for (const d of vec.feature_data) {
    if (ODDS_RE.test(d.key)) continue;
    if (d.status !== "ELIGIBLE" || d.value == null || !Number.isFinite(d.value)) continue;
    out.push({
      event_id: input.eventId,
      feature_key: d.key,
      value: d.value,
      source: "football-data-co-uk",
      source_url: "https://www.football-data.co.uk/",
      observed_at: input.nowIso,
      available_at: d.available_at ?? null,
      extraction_method: "pi_archive_asof",
      confidence: null,
      status: "REAL",
      kind: d.origin === "DERIVED" || d.origin === "STATIC" ? "DERIVED" : "HISTORICAL_PRIOR",
      enters_independent_model: d.entered_model === true,
      derived_from: d.derived_from ?? [],
    });
  }
  return out;
}
