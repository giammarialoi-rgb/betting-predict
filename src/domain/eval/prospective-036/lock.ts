import { hashPayload } from "@/ingest/hash";
import { computeOverround, decimalOddsToImpliedProbability, normalizeMarketProbabilities } from "@/domain/odds/math";
import { ProspectiveIntegrityError, assertLockedImmutable, assertNotCloseAsDecision, assertOutcomeAfterLock } from "@/domain/eval/prospective-036/integrity";
import type { DecisionContext036, DecisionState036, ProspectiveQuote036 } from "@/domain/eval/prospective-036/types";

export function tripleFromQuotes(quotes: readonly ProspectiveQuote036[]): {
  home: number;
  draw: number;
  away: number;
} | null {
  const h = quotes.find((q) => q.selection === "HOME");
  const d = quotes.find((q) => q.selection === "DRAW");
  const a = quotes.find((q) => q.selection === "AWAY");
  if (!h || !d || !a) return null;
  return { home: h.odds_decimal, draw: d.odds_decimal, away: a.odds_decimal };
}

export function marketDevig036(odds: { home: number; draw: number; away: number }): {
  home_raw: number;
  draw_raw: number;
  away_raw: number;
  home_devig: number;
  draw_devig: number;
  away_devig: number;
  overround: number;
} {
  const list = [odds.home, odds.draw, odds.away];
  const ov = computeOverround(list);
  const raw = list.map(decimalOddsToImpliedProbability);
  const dev = normalizeMarketProbabilities(list);
  return {
    home_raw: raw[0]!,
    draw_raw: raw[1]!,
    away_raw: raw[2]!,
    home_devig: dev[0]!,
    draw_devig: dev[1]!,
    away_devig: dev[2]!,
    overround: ov.overround,
  };
}

export function buildDecisionContext(input: {
  decisionId: string;
  eventId: string;
  decisionTimestampUtc: string;
  quotes: readonly ProspectiveQuote036[];
  bookmaker: string;
}): Omit<DecisionContext036, "state"> & { state: "LOCKED" } {
  assertNotCloseAsDecision(false);
  const odds = tripleFromQuotes(input.quotes.filter((q) => q.market === "1X2" && q.bookmaker === input.bookmaker));
  if (!odds) throw new ProspectiveIntegrityError("MISSING_QUOTE_TIME", "incomplete 1X2");
  const d = marketDevig036(odds);
  const ctx: Omit<DecisionContext036, "decision_context_hash" | "state"> & { state: "LOCKED" } = {
    decision_id: input.decisionId,
    event_id: input.eventId,
    decision_timestamp_utc: input.decisionTimestampUtc,
    window: "T-1h",
    state: "LOCKED",
    market: "1X2",
    ...d,
    bookmaker: input.bookmaker,
    observation_ids: input.quotes.map((q) => q.observation_id),
    observation_only: true,
  };
  return { ...ctx, decision_context_hash: hashPayload(ctx) };
}

export function advanceState(current: DecisionState036, next: DecisionState036): DecisionState036 {
  const order: DecisionState036[] = ["PRELOCK", "DECISION", "LOCKED", "KICKOFF", "SETTLED", "EVALUATED"];
  const i = order.indexOf(current);
  const j = order.indexOf(next);
  if (j < i) throw new ProspectiveIntegrityError("POST_LOCK_MUTATION");
  if (current === "LOCKED" && next === "PRELOCK") throw new ProspectiveIntegrityError("POST_LOCK_MUTATION");
  return next;
}

export function mutateDecision(dec: DecisionContext036, patch: Partial<DecisionContext036>): DecisionContext036 {
  assertLockedImmutable(dec.state, true);
  return { ...dec, ...patch };
}

export function attachSettlement(dec: DecisionContext036): void {
  assertOutcomeAfterLock(dec.state);
}
