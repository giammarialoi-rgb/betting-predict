/**
 * Deterministic team/competition normalization.
 * Aliases are exact string keys only — no fuzzy / Levenshtein matching.
 */

import type { MatchingConfidence } from "@/domain/eval/acquisition-019/types";

const TEAM_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "man united": "manchester-united",
  "man utd": "manchester-united",
  "manchester utd": "manchester-united",
  "manchester united": "manchester-united",
  "man city": "manchester-city",
  "manchester city": "manchester-city",
  "west ham": "west-ham",
  "west ham utd": "west-ham",
  "west ham united": "west-ham",
  "crystal palace": "crystal-palace",
  "aston villa": "aston-villa",
  "sheffield united": "sheffield-united",
  "sheffield utd": "sheffield-united",
  "sheffield weds": "sheffield-wednesday",
  "sheffield wednesday": "sheffield-wednesday",
  "nott'm forest": "nottingham-forest",
  "nottingham forest": "nottingham-forest",
  "notts forest": "nottingham-forest",
  "qpr": "queens-park-rangers",
  "queens park rangers": "queens-park-rangers",
  "wolves": "wolverhampton",
  "wolverhampton": "wolverhampton",
  "wolverhampton wanderers": "wolverhampton",
  "spurs": "tottenham",
  tottenham: "tottenham",
  "tottenham hotspur": "tottenham",
  "newcastle": "newcastle",
  "newcastle utd": "newcastle",
  "newcastle united": "newcastle",
  "inter": "inter",
  "inter milan": "inter",
  "internazionale": "inter",
  "ac milan": "milan",
  milan: "milan",
  "m'gladbach": "monchengladbach",
  "mgladbach": "monchengladbach",
  gladbach: "monchengladbach",
  "borussia monchengladbach": "monchengladbach",
  "bayern munich": "bayern-munich",
  "bayern munchen": "bayern-munich",
  "athletico madrid": "atletico-madrid",
  "atletico madrid": "atletico-madrid",
  "ath madrid": "atletico-madrid",
  "ath bilbao": "athletic-bilbao",
  "athletic bilbao": "athletic-bilbao",
  "real madrid": "real-madrid",
  "man  utd": "manchester-united",
  liverpool: "liverpool",
  chelsea: "chelsea",
  arsenal: "arsenal",
  everton: "everton",
  leicester: "leicester",
  brighton: "brighton",
  southampton: "southampton",
  fulham: "fulham",
  brentford: "brentford",
  leeds: "leeds",
  burnley: "burnley",
  watford: "watford",
  norwich: "norwich",
  bournemouth: "bournemouth",
  juventus: "juventus",
  napoli: "napoli",
  roma: "roma",
  lazio: "lazio",
});

const COMPETITION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  e0: "e0",
  "premier league": "e0",
  premier: "e0",
  eng1: "e0",
  e1: "e1",
  championship: "e1",
  e2: "e2",
  e3: "e3",
  i1: "i1",
  "serie a": "i1",
  i2: "i2",
  "serie b": "i2",
  sp1: "sp1",
  "la liga": "sp1",
  primera: "sp1",
  sp2: "sp2",
  d1: "d1",
  bundesliga: "d1",
  d2: "d2",
  f1: "f1",
  "ligue 1": "f1",
  f2: "f2",
  n1: "n1",
  p1: "p1",
  b1: "b1",
  t1: "t1",
  g1: "g1",
  sc0: "sc0",
});

export function slugifyToken(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTeam(raw: string): {
  slug: string;
  confidence: MatchingConfidence;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { slug: "", confidence: "unmatched" };
  }
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  const aliased = TEAM_ALIASES[key];
  if (aliased) {
    return { slug: aliased, confidence: "exact_alias" };
  }
  const slug = slugifyToken(trimmed);
  if (!slug) {
    return { slug: "", confidence: "unmatched" };
  }
  return { slug, confidence: "deterministic_slug" };
}

export function normalizeCompetition(raw: string): string {
  const key = raw.trim().toLowerCase();
  return COMPETITION_ALIASES[key] ?? slugifyToken(raw);
}

export function combineMatchConfidence(
  a: MatchingConfidence,
  b: MatchingConfidence,
): MatchingConfidence {
  if (a === "unmatched" || b === "unmatched") return "unmatched";
  if (a === "exact_alias" && b === "exact_alias") return "exact_alias";
  return "deterministic_slug";
}
