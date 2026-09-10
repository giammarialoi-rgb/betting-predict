import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";
import { resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";

/** Resolve as-of PI form/history for a live Lab B event — never invents; returns null if unmatched. */
export function resolvePiFormHistoryForEvent(input: {
  home: string;
  away: string;
  kickoff_utc: string | null;
  competition?: string | null;
  labBRoot?: string;
}): {
  form_features: Record<string, number | null>;
  history_features: Record<string, number | null>;
} | null {
  const matches = loadPiMatches(input.labBRoot);
  if (matches.length < 100) return null;
  const home = input.home.trim().toLowerCase();
  const away = input.away.trim().toLowerCase();
  if (!home || !away) return null;

  const resolved = resolveLivePiTarget({
    home_team: input.home,
    away_team: input.away,
    competition: input.competition,
    matches,
  });
  const homeId = resolved.home_team_id;
  const awayId = resolved.away_team_id;
  const kick = input.kickoff_utc ?? new Date().toISOString();
  const day = kick.slice(0, 10);

  const target: PiMatchRow = {
    canonical_id: `live-snap|${day}|${homeId}|${awayId}`,
    source: "football-data-co-uk",
    season: resolved.season,
    league: resolved.division ?? input.competition ?? "UNK",
    match_date: day,
    event_time: kick,
    home_team: input.home,
    away_team: input.away,
    home_team_id: homeId,
    away_team_id: awayId,
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

  const feat = buildFeatureVectorPi(target, matches);
  if (feat.missing_keys.length > 45) return null;

  const form_features: Record<string, number | null> = {};
  const history_features: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(feat.values)) {
    if (k.includes("_l3") || k.includes("_l5") || k.includes("pts") || k.includes("rest")) {
      form_features[k] = v;
    } else {
      history_features[k] = v;
    }
  }
  return { form_features, history_features };
}
