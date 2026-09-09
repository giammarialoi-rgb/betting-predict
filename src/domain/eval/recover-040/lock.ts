import { hashPayload } from "@/ingest/hash";
import { buildDecisionContext } from "@/domain/eval/prospective-036/lock";
import type { ProspectiveQuote036 } from "@/domain/eval/prospective-036/types";
import { asOfComplete1x2Books040 } from "@/domain/eval/recover-040/inventory";
import { appendDecision039, type Store039 } from "@/domain/eval/live-039/store";
import type { Decision039, Quote039 } from "@/domain/eval/live-039/types";

export type LockedDecisionRow040 = {
  event_id: string;
  kickoff: string;
  as_of: string;
  market: "1X2";
  home_price: number;
  draw_price: number;
  away_price: number;
  market_devig: { home: number; draw: number; away: number; overround: number };
  source: string;
  available_at: string;
  decision_context_hash: string;
  bookmaker: string;
  decision_id: string;
};

function toLockQuotes(
  qs: readonly Quote039[],
  ev: { home_team: string; away_team: string; commence_time: string; sport_key: string },
): ProspectiveQuote036[] {
  return qs.map((q) => ({
    event_id: q.event_id,
    source_event_id: ev.sport_key,
    competition: ev.sport_key,
    season: null,
    home_team: ev.home_team,
    away_team: ev.away_team,
    kickoff_at_utc: ev.commence_time,
    market: q.market,
    selection: q.outcome,
    odds_decimal: q.price,
    quote_observed_at_utc: q.available_at ?? q.source_quote_timestamp!,
    source_timestamp_utc: q.source_quote_timestamp,
    collector_timestamp_utc: q.collected_at,
    requested_at_utc: q.collected_at,
    received_at_utc: q.collected_at,
    source: "the-odds-api",
    bookmaker: q.bookmaker,
    source_record_id: `${q.event_id}|${q.bookmaker}|${q.market}|${q.outcome}`,
    observation_id: hashPayload({
      e: q.event_id,
      b: q.bookmaker,
      m: q.market,
      o: q.outcome,
      t: q.source_quote_timestamp,
      p: q.price,
    }).slice(0, 32),
    ingested_at_utc: q.collected_at,
    temporal_basis: "SOURCE_TIMESTAMP",
    availability_class: "STRICT",
    decision_id: null,
    snapshot_id: "",
    data_fingerprint: "",
    window: q.window,
    seconds_to_kickoff: q.offset_seconds_from_kickoff,
  }));
}

/** Recovery LOCK: AS_OF T−1h without waiting for the live [cutoff, kickoff) window. */
export function recoverLocks040(store: Store039): {
  locked: number;
  rows: LockedDecisionRow040[];
  decisions: Decision039[];
} {
  const rows: LockedDecisionRow040[] = [];
  const decisions: Decision039[] = [];
  let locked = 0;
  for (const ev of store.events) {
    if (store.decisions.some((d) => d.event_id === ev.event_id)) {
      const d = store.decisions.find((x) => x.event_id === ev.event_id)!;
      rows.push({
        event_id: d.event_id,
        kickoff: ev.commence_time ?? "",
        as_of: d.decision_timestamp_utc,
        market: "1X2",
        home_price: 1 / d.home_raw,
        draw_price: 1 / d.draw_raw,
        away_price: 1 / d.away_raw,
        market_devig: {
          home: d.home_devig,
          draw: d.draw_devig,
          away: d.away_devig,
          overround: d.overround,
        },
        source: "the-odds-api",
        available_at: d.decision_timestamp_utc,
        decision_context_hash: d.decision_context_hash,
        bookmaker: d.bookmaker,
        decision_id: d.decision_id,
      });
      decisions.push(d);
      continue;
    }
    const hit = asOfComplete1x2Books040(store, ev);
    if (!hit || !ev.commence_time) continue;
    const home = hit.chosen.find((q) => q.outcome === "HOME")!;
    const draw = hit.chosen.find((q) => q.outcome === "DRAW")!;
    const away = hit.chosen.find((q) => q.outcome === "AWAY")!;
    const cutoffMs = Date.parse(ev.commence_time) - 3600_000;
    if (hit.chosen.some((q) => Date.parse(q.available_at!) > cutoffMs)) {
      continue;
    }
    const dec = buildDecisionContext({
      decisionId: hashPayload({ eventId: ev.event_id, book: hit.bookmaker, w: "T-1h", task: "040" }).slice(0, 24),
      eventId: ev.event_id,
      decisionTimestampUtc: hit.asOf,
      bookmaker: hit.bookmaker,
      quotes: toLockQuotes(hit.chosen, {
        home_team: ev.home_team,
        away_team: ev.away_team,
        commence_time: ev.commence_time,
        sport_key: ev.sport_key,
      }),
    });
    const decision: Decision039 = { ...dec, observation_only: true };
    appendDecision039(store, decision);
    locked += 1;
    decisions.push(decision);
    rows.push({
      event_id: ev.event_id,
      kickoff: ev.commence_time,
      as_of: hit.asOf,
      market: "1X2",
      home_price: home.price,
      draw_price: draw.price,
      away_price: away.price,
      market_devig: {
        home: decision.home_devig,
        draw: decision.draw_devig,
        away: decision.away_devig,
        overround: decision.overround,
      },
      source: "the-odds-api",
      available_at: hit.asOf,
      decision_context_hash: decision.decision_context_hash,
      bookmaker: hit.bookmaker,
      decision_id: decision.decision_id,
    });
  }
  return { locked, rows, decisions };
}

export function assertDecisionHasNoSettlement040(decision: Decision039, settlementPayload: unknown): void {
  const text = JSON.stringify(decision);
  const bad = ["home_score", "away_score", "FT", "HT", "outcome", "settled_at"];
  for (const k of bad) {
    if (k in (decision as unknown as Record<string, unknown>)) {
      throw new Error(`settlement field ${k} in DecisionContext`);
    }
  }
  if (text.includes('"FT"') || text.includes('"HT"')) throw new Error("FT/HT in DecisionContext");
  void settlementPayload;
}
