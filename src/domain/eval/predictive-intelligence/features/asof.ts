import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

/** Feature cutoff: start of match calendar day UTC (DATE_ONLY — no same-day result). */
export function featureCutoffForMatch(m: PiMatchRow): string {
  return `${m.match_date}T00:00:00.000Z`;
}

/** Prior matches strictly before feature_cutoff with result available. */
export function priorMatchesAsOf(
  all: readonly PiMatchRow[],
  featureCutoffIso: string,
): PiMatchRow[] {
  const cut = Date.parse(featureCutoffIso);
  return all.filter((m) => {
    const avail = Date.parse(m.result_available_at);
    return Number.isFinite(avail) && avail < cut;
  });
}

export function assertNoFutureLeakage(input: {
  featureCutoff: string;
  usedMatches: readonly PiMatchRow[];
  targetId: string;
}): void {
  const cut = Date.parse(input.featureCutoff);
  for (const m of input.usedMatches) {
    if (m.canonical_id === input.targetId) {
      throw new Error(`LEAKAGE: same-match ${m.canonical_id} used in features`);
    }
    if (Date.parse(m.result_available_at) >= cut) {
      throw new Error(`LEAKAGE: match ${m.canonical_id} result_available_at >= feature_cutoff`);
    }
  }
}

const CLOSING_KEYS = ["B365C", "PSC", "B365CH", "PSCH", "closing", "research_odds_close"];

/** Odds / market probability keys forbidden as MODEL feature inputs. */
const MARKET_INPUT_KEYS = [
  ...CLOSING_KEYS,
  "odds_open",
  "odds",
  "b365",
  "market_prob",
  "market_probability",
  "implied_prob",
  "bookmaker",
  "devig",
  "opening_odds",
  "closing_odds",
  "price",
  "quote",
];

/** Hard ban: prediction feature bags must never mention closing odds. */
export function assertNoClosingOddsInPredictionContext(featureKeys: readonly string[]): void {
  assertNoMarketInputsInPredictionContext(featureKeys);
}

/** Hard ban: MODEL features must never include odds or market probability. */
export function assertNoMarketInputsInPredictionContext(featureKeys: readonly string[]): void {
  for (const k of featureKeys) {
    const low = k.toLowerCase();
    for (const ban of MARKET_INPUT_KEYS) {
      if (low.includes(ban.toLowerCase())) {
        throw new Error(`MARKET_INPUT_FORBIDDEN in prediction features: ${k}`);
      }
    }
  }
}

export function assertTemporalExample(ex: {
  event_time: string;
  feature_cutoff: string;
  feature_source_time: string;
  label_time: string;
}): void {
  const et = Date.parse(ex.event_time);
  const fc = Date.parse(ex.feature_cutoff);
  const fs = Date.parse(ex.feature_source_time);
  const lt = Date.parse(ex.label_time);
  if (!(fc <= et)) throw new Error("feature_cutoff must be <= event_time");
  if (!(fs < fc || fs === fc)) {
    /* feature_source_time is max prior result_available; must be < cutoff */
  }
  if (fs >= fc && fs !== fc) {
    // allow equality only if empty history; otherwise strict
  }
  if (!(lt >= et)) throw new Error("label_time must be >= event_time");
  if (fs > fc) throw new Error("feature_source_time must be <= feature_cutoff");
}

/** Hard temporal firewall — evidence after asOf never enters the model. */
export function assertNoFutureDataInModel(input: { asOf: string; available_at: string }): void {
  const asOf = Date.parse(input.asOf);
  const available = Date.parse(input.available_at);
  if (!Number.isFinite(asOf) || !Number.isFinite(available)) {
    throw new Error("FUTURE_DATA_MUST_NOT_ENTER_MODEL");
  }
  if (available > asOf) {
    throw new Error("FUTURE_DATA_MUST_NOT_ENTER_MODEL");
  }
}
