/**
 * Calendar congestion from prior matches only. Target excluded. DATE_ONLY.
 */
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { resolveLivePiTarget } from "@/domain/eval/predictive-intelligence/live-resolve";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

function countInWindow(
  dates: string[],
  kickoffIso: string,
  days: number,
): number {
  const ko = Date.parse(kickoffIso);
  if (!Number.isFinite(ko)) return 0;
  const from = ko - days * 86400_000;
  let n = 0;
  for (const d of dates) {
    const t = Date.parse(d.includes("T") ? d : `${d}T12:00:00.000Z`);
    if (!Number.isFinite(t)) continue;
    if (t < ko && t >= from) n += 1;
  }
  return n;
}

function lastMatchDays(dates: string[], kickoffIso: string): number | null {
  const ko = Date.parse(kickoffIso);
  if (!Number.isFinite(ko)) return null;
  let best: number | null = null;
  for (const d of dates) {
    const t = Date.parse(d.includes("T") ? d : `${d}T12:00:00.000Z`);
    if (!Number.isFinite(t) || t >= ko) continue;
    const days = (ko - t) / 86400_000;
    if (best == null || days < best) best = days;
  }
  return best == null ? null : Math.round(best * 10) / 10;
}

export function extractCalendarObservations(input: {
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
  const target = resolveLivePiTarget({
    home_team: input.home,
    away_team: input.away,
    competition: input.competition,
    matches,
  });
  if (!target.home_matched || !target.away_matched) return [];
  const kickDay = input.kickoffIso.slice(0, 10);
  const homeDates: string[] = [];
  const awayDates: string[] = [];
  for (const m of matches) {
    if (m.match_date >= kickDay) continue; // exclude target and future
    if (m.home_team_id === target.home_team_id || m.away_team_id === target.home_team_id) {
      homeDates.push(m.event_time || m.match_date);
    }
    if (m.home_team_id === target.away_team_id || m.away_team_id === target.away_team_id) {
      awayDates.push(m.event_time || m.match_date);
    }
  }
  const rows: Array<{ key: string; value: number | null }> = [
    { key: "home_matches_last_7_days", value: countInWindow(homeDates, input.kickoffIso, 7) },
    { key: "away_matches_last_7_days", value: countInWindow(awayDates, input.kickoffIso, 7) },
    { key: "home_matches_last_14_days", value: countInWindow(homeDates, input.kickoffIso, 14) },
    { key: "away_matches_last_14_days", value: countInWindow(awayDates, input.kickoffIso, 14) },
    { key: "home_matches_last_21_days", value: countInWindow(homeDates, input.kickoffIso, 21) },
    { key: "away_matches_last_21_days", value: countInWindow(awayDates, input.kickoffIso, 21) },
    { key: "home_days_since_last_match", value: lastMatchDays(homeDates, input.kickoffIso) },
    { key: "away_days_since_last_match", value: lastMatchDays(awayDates, input.kickoffIso) },
  ];
  return rows
    .filter((r) => r.value != null && Number.isFinite(r.value))
    .map((r) => ({
      event_id: input.eventId,
      feature_key: r.key,
      value: r.value,
      source: "football-data-co-uk",
      source_url: "https://www.football-data.co.uk/",
      observed_at: input.nowIso,
      available_at: null,
      extraction_method: "pi_archive_calendar_asof",
      confidence: null,
      status: "REAL" as const,
      kind: "DERIVED" as const,
      derived_from: ["pi_matches", "excluded_target=true"],
      enters_independent_model: false,
    }));
}
