import { existsSync, readFileSync } from "node:fs";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { classifyEloProvenance } from "@/domain/features/elo";
import type { ClubEloObservation } from "@/domain/features/clubelo-asof";
import { clubEloAsOf } from "@/domain/features/clubelo-asof";
import { findClubEloCachePaths } from "@/domain/eval/data-intelligence/registry";

export function clubKeyFromTeamName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/** ClubElo club keys often differ from Odds display names. */
const CLUBELO_NAME_ALIASES: Record<string, string> = {
  nottinghamforest: "forest",
  nottmforest: "forest",
  astonvilla: "astonvilla",
  mancity: "manchestercity",
  manunited: "manchesterunited",
  manutd: "manchesterunited",
  intermilan: "inter",
  acmilan: "milan",
  psg: "parissg",
  parissaintgermain: "parissg",
  bayernmunich: "bayern",
  hullcity: "hull",
  coventrycity: "coventry",
  ipswichtown: "ipswich",
  unionberlin: "unionberlin",
  schalke04: "schalke",
  atleticomadrid: "atletico",
};

export function clubEloKeysForTeamName(name: string): string[] {
  const base = clubKeyFromTeamName(name);
  const out = new Set<string>([base]);
  if (CLUBELO_NAME_ALIASES[base]) out.add(CLUBELO_NAME_ALIASES[base]!);
  // also try without common suffixes
  out.add(base.replace(/united$/, "").replace(/city$/, "").replace(/fc$/, ""));
  return [...out].filter(Boolean);
}

export function parseClubEloCsvSync(csvText: string, ratingDateIso: string): ClubEloObservation[] {
  const table = parseCsv(csvText);
  const ratingDate = new Date(`${ratingDateIso}T00:00:00.000Z`);
  const observations: ClubEloObservation[] = [];
  for (const row of table.rows) {
    const club = row.Club ?? row.club;
    const elo = Number(row.Elo ?? row.elo);
    if (!club || !Number.isFinite(elo)) continue;
    const from = row.From ? new Date(`${row.From}T00:00:00.000Z`) : ratingDate;
    observations.push({
      teamId: clubKeyFromTeamName(club),
      rating: elo,
      ratingDate: from,
      availableAt: from,
      provenance: classifyEloProvenance(ratingDateIso),
    });
  }
  return observations;
}

/** Load ClubElo observations from local CSV only (no network). */
export function loadClubEloCacheSync(cwd = process.cwd()): ClubEloObservation[] {
  const paths = findClubEloCachePaths(cwd);
  const all: ClubEloObservation[] = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    const m = p.match(/(\d{4}-\d{2}-\d{2})/);
    const ratingDate = m?.[1] ?? "2019-08-01";
    all.push(...parseClubEloCsvSync(text, ratingDate));
  }
  return all;
}

/** Resolve Elo as-of match date; null if missing or rating_date >= match_date. */
export function resolveTeamEloAsOf(input: {
  observations: readonly ClubEloObservation[];
  teamName: string;
  matchDateIso: string;
}): { rating: number; available_at: string } | null {
  if (!input.observations.length) return null;
  const matchDay = new Date(`${input.matchDateIso.slice(0, 10)}T00:00:00.000Z`);
  const asOf = new Date(matchDay.getTime() - 1);
  for (const teamId of clubEloKeysForTeamName(input.teamName)) {
    const cell = clubEloAsOf({
      observations: input.observations,
      teamId,
      asOf,
    });
    if (cell.value == null || cell.availableAt == null) continue;
    if (cell.availableAt.getTime() >= matchDay.getTime()) continue;
    return {
      rating: cell.value,
      available_at: cell.availableAt.toISOString(),
    };
  }
  return null;
}
