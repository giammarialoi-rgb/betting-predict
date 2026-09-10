/**
 * Event-specific Football-Data archive lookup.
 * File presence is not event success. Teams must match and priors must exist.
 */
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { priorMatchesAsOf } from "@/domain/eval/predictive-intelligence/features/asof";
import { resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

export type ArchiveLookup = {
  file_present: boolean;
  home_canonical_id: string;
  away_canonical_id: string;
  home_matched: boolean;
  away_matched: boolean;
  division: string | null;
  season: string;
  prior_n_home: number;
  prior_n_away: number;
  prior_ids_home: string[];
  prior_ids_away: string[];
  status: "SUCCESS" | "PARTIAL" | "NO_EVENT" | "NO_DATA" | "MISSING_FILE";
  fields_extracted: string[];
  reason: string;
};

function teamPriors(all: PiMatchRow[], teamId: string, cutoffIso: string): PiMatchRow[] {
  const priors = priorMatchesAsOf(all, cutoffIso);
  return priors.filter((m) => m.home_team_id === teamId || m.away_team_id === teamId);
}

export function inspectFootballDataArchive(input: {
  home: string;
  away: string;
  competition?: string | null;
  kickoffIso: string;
  labBRoot?: string;
}): ArchiveLookup {
  const matches = loadPiMatches(input.labBRoot);
  if (matches.length === 0) {
    return {
      file_present: false,
      home_canonical_id: "",
      away_canonical_id: "",
      home_matched: false,
      away_matched: false,
      division: null,
      season: "live",
      prior_n_home: 0,
      prior_n_away: 0,
      prior_ids_home: [],
      prior_ids_away: [],
      status: "MISSING_FILE",
      fields_extracted: [],
      reason: "Nessun archivio Football-Data locale (matches.jsonl assente).",
    };
  }
  const target = resolveLivePiTarget({
    home_team: input.home,
    away_team: input.away,
    competition: input.competition,
    matches,
  });
  const cutoff = input.kickoffIso.includes("T")
    ? `${input.kickoffIso.slice(0, 10)}T00:00:00.000Z`
    : `${input.kickoffIso}T00:00:00.000Z`;
  const homePriors = target.home_matched ? teamPriors(matches, target.home_team_id, cutoff) : [];
  const awayPriors = target.away_matched ? teamPriors(matches, target.away_team_id, cutoff) : [];
  const prior_ids_home = homePriors.slice(-10).map((m) => m.canonical_id);
  const prior_ids_away = awayPriors.slice(-10).map((m) => m.canonical_id);

  if (!target.home_matched || !target.away_matched || !target.division) {
    return {
      file_present: true,
      home_canonical_id: target.home_team_id,
      away_canonical_id: target.away_team_id,
      home_matched: target.home_matched,
      away_matched: target.away_matched,
      division: target.division,
      season: target.season,
      prior_n_home: homePriors.length,
      prior_n_away: awayPriors.length,
      prior_ids_home,
      prior_ids_away,
      status: "NO_EVENT",
      fields_extracted: [],
      reason:
        "Archivio Football-Data presente, ma questa partita non e stata abbinata (squadre o competizione assenti dal dataset storico).",
    };
  }
  if (homePriors.length === 0 && awayPriors.length === 0) {
    return {
      file_present: true,
      home_canonical_id: target.home_team_id,
      away_canonical_id: target.away_team_id,
      home_matched: true,
      away_matched: true,
      division: target.division,
      season: target.season,
      prior_n_home: 0,
      prior_n_away: 0,
      prior_ids_home: [],
      prior_ids_away: [],
      status: "NO_DATA",
      fields_extracted: [],
      reason: "Squadre riconosciute nell'archivio, ma nessun match completato prima del kickoff.",
    };
  }
  const n = Math.min(homePriors.length, awayPriors.length);
  const fields = ["form_priors"];
  if (homePriors.length >= 3) fields.push("form_l3");
  if (homePriors.length >= 5) fields.push("form_l5");
  if (homePriors.length >= 10) fields.push("form_l10");
  return {
    file_present: true,
    home_canonical_id: target.home_team_id,
    away_canonical_id: target.away_team_id,
    home_matched: true,
    away_matched: true,
    division: target.division,
    season: target.season,
    prior_n_home: homePriors.length,
    prior_n_away: awayPriors.length,
    prior_ids_home,
    prior_ids_away,
    status: n >= 3 ? "SUCCESS" : "PARTIAL",
    fields_extracted: fields,
    reason: `Archivio: ${homePriors.length} match precedenti casa, ${awayPriors.length} trasferta, division=${target.division}. Target escluso.`,
  };
}

export function cutoffFromKickoff(kickoffIso: string): string {
  const d = kickoffIso.slice(0, 10);
  return `${d}T00:00:00.000Z`;
}
