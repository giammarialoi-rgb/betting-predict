import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import type { CoverageCell025 } from "@/domain/eval/turnaround-025/types";

const DIVISION_COUNTRY: Readonly<Record<string, string>> = Object.freeze({
  E0: "England",
  E1: "England",
  E2: "England",
  E3: "England",
  EC: "England",
  I1: "Italy",
  I2: "Italy",
  D1: "Germany",
  D2: "Germany",
  SP1: "Spain",
  SP2: "Spain",
  F1: "France",
  F2: "France",
  N1: "Netherlands",
  P1: "Portugal",
  B1: "Belgium",
  SC0: "Scotland",
  SC1: "Scotland",
  SC2: "Scotland",
  SC3: "Scotland",
});

export const TRACKED_COUNTRIES = [
  "England",
  "Italy",
  "Germany",
  "Spain",
  "France",
  "Netherlands",
  "Portugal",
  "Belgium",
  "Scotland",
] as const;

export function countryForDivision(division: string): string | null {
  return DIVISION_COUNTRY[division] ?? null;
}

export function coverageFromClubMatches(
  matches: readonly ClubMatchLite[],
  strictByYearCompetition: ReadonlyMap<string, number>,
): CoverageCell025[] {
  const acc = new Map<
    string,
    { year: number; competition: string; events: number; odds: number }
  >();
  for (const m of matches) {
    const key = `${m.year}|${m.division || "UNKNOWN"}`;
    const cur = acc.get(key) ?? {
      year: m.year,
      competition: m.division || "UNKNOWN",
      events: 0,
      odds: 0,
    };
    cur.events += 1;
    if (
      m.oddHome != null &&
      m.oddDraw != null &&
      m.oddAway != null &&
      m.oddHome > 1 &&
      m.oddDraw > 1 &&
      m.oddAway > 1
    ) {
      cur.odds += 1;
    }
    acc.set(key, cur);
  }
  const cells: CoverageCell025[] = [];
  for (const cur of acc.values()) {
    const strict = strictByYearCompetition.get(`${cur.year}|${cur.competition}`) ?? 0;
    const events = cur.events;
    cells.push({
      year: cur.year,
      competition: cur.competition,
      events,
      odds: cur.odds,
      exact_timestamp: strict,
      date_only: cur.odds,
      strict,
      strict_ratio: events === 0 ? 0 : strict / events,
      research_ratio: events === 0 ? 0 : cur.odds / events,
      observed: true,
    });
  }
  return cells.sort((a, b) => a.year - b.year || a.competition.localeCompare(b.competition));
}

export function countryObservation(cells: readonly CoverageCell025[]): {
  country: string;
  status: "observed" | "not observed";
  events: number;
}[] {
  const byCountry = new Map<string, number>();
  for (const c of cells) {
    const country = countryForDivision(c.competition);
    if (!country) continue;
    byCountry.set(country, (byCountry.get(country) ?? 0) + c.events);
  }
  return TRACKED_COUNTRIES.map((country) => ({
    country,
    status: (byCountry.get(country) ?? 0) > 0 ? "observed" : "not observed",
    events: byCountry.get(country) ?? 0,
  }));
}
