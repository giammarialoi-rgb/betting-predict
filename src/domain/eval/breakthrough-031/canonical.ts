import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import { dedupeQuotesDeterministic } from "@/domain/eval/breakthrough-031/leakage";
import type { CanonicalEvent031, CanonicalQuote031 } from "@/domain/eval/breakthrough-031/types";

const SELECTIONS = ["HOME", "DRAW", "AWAY"] as const;

export function eventToQuotes(event: CanonicalEvent031): CanonicalQuote031[] {
  const odds = [event.home_odds, event.draw_odds, event.away_odds];
  return SELECTIONS.map((selection, i) => ({
    event_id: event.event_id,
    competition: event.competition,
    season: event.season,
    home_team: event.home_team,
    away_team: event.away_team,
    kickoff: event.kickoff,
    market: "1X2" as const,
    selection,
    odds: odds[i]!,
    quote_timestamp: event.quote_timestamp,
    timestamp_timezone: event.timestamp_timezone,
    available_at: event.available_at,
    source: event.source,
    source_dataset: event.source_dataset,
    bookmaker: event.bookmaker,
    temporal_basis: event.temporal_basis,
    license: event.license,
    match_confidence: event.match_confidence,
    strict_status: event.strict_status,
  }));
}

export function fromStrict027(event: StrictCandidate027): CanonicalEvent031 {
  return {
    event_id: event.event_id,
    competition: event.competition,
    season: event.season,
    home_team: event.home,
    away_team: event.away,
    kickoff: event.kickoff,
    market: "1X2",
    home_odds: event.home_odds,
    draw_odds: event.draw_odds,
    away_odds: event.away_odds,
    quote_timestamp: event.odds_timestamp,
    timestamp_timezone: "UTC",
    available_at: event.available_at,
    source: event.source,
    source_dataset: "DATASET_031_BASE",
    bookmaker: event.bookmaker,
    temporal_basis: "EXACT_RELATIVE",
    license: event.license_status,
    match_confidence: event.match_confidence,
    strict_status: "STRICT",
    ft_home: event.ft_home,
    ft_away: event.ft_away,
  };
}

export function complete1x2(event: CanonicalEvent031): boolean {
  return event.home_odds > 1 && event.draw_odds > 1 && event.away_odds > 1;
}

export function unionCanonical(base: readonly CanonicalEvent031[], added: readonly CanonicalEvent031[]): CanonicalEvent031[] {
  const seen = new Set(base.map((e) => e.event_id));
  const extra = added.filter((e) => {
    if (e.strict_status !== "STRICT") return false;
    if (e.match_confidence !== "MATCH_EXACT") return false;
    if (!complete1x2(e)) return false;
    if (seen.has(e.event_id)) return false;
    seen.add(e.event_id);
    return true;
  });
  return [...base, ...extra].sort(
    (a, b) => a.kickoff.localeCompare(b.kickoff) || a.event_id.localeCompare(b.event_id),
  );
}

export function quotesForEvents(events: readonly CanonicalEvent031[]): CanonicalQuote031[] {
  return dedupeQuotesDeterministic(events.flatMap(eventToQuotes));
}
