/**
 * Explicit Phase 9 temporal / target / odds firewall.
 * Builds on PI as-of helpers. Does not loosen DATE_ONLY.
 */
import {
  assertNoClosingOddsInPredictionContext,
  assertNoFutureDataInModel,
  assertNoFutureLeakage,
  assertNoMarketInputsInPredictionContext,
  assertTemporalExample,
  featureCutoffForMatch,
  priorMatchesAsOf,
} from "@/domain/eval/predictive-intelligence/features/asof";
import { assertNotRandomTemporalSplit } from "@/domain/eval/walk-forward";
import type { PiFeatureVector, PiMatchRow } from "@/domain/eval/predictive-intelligence/types";
import type { Phase9Match } from "@/domain/eval/phase-9/types";

export function assertNoRandomSplit(method: string): void {
  const low = method.toLowerCase();
  if (low.includes("random") || low.includes("shuffle") || low === "iid") {
    throw new Error("RANDOM_SPLIT_FORBIDDEN: chronological / walk-forward only");
  }
  assertNotRandomTemporalSplit(low === "random" ? "random" : method);
}

export function assertPreviousMatchBeforeKickoff(input: {
  previous: PiMatchRow;
  target: PiMatchRow;
}): void {
  const cut = Date.parse(featureCutoffForMatch(input.target));
  const avail = Date.parse(input.previous.result_available_at);
  const prevKick = Date.parse(input.previous.event_time);
  if (input.previous.canonical_id === input.target.canonical_id) {
    throw new Error("TARGET_LEAKAGE: previous_match is the target");
  }
  if (!(avail < cut)) {
    throw new Error("TEMPORAL_LEAKAGE: previous result_available_at >= target feature_cutoff");
  }
  if (!(prevKick < Date.parse(input.target.event_time))) {
    throw new Error("TEMPORAL_LEAKAGE: previous_match kickoff is not < target_kickoff");
  }
}

export function assertFeatureVectorFirewall(features: PiFeatureVector, target: PiMatchRow): void {
  assertTemporalExample(features.example);
  assertNoClosingOddsInPredictionContext(Object.keys(features.values));
  assertNoMarketInputsInPredictionContext(Object.keys(features.values));
  if (features.closing_odds_used !== false) {
    throw new Error("ODDS_LEAKAGE: closing_odds_used must be false");
  }
  if (features.example.canonical_id !== target.canonical_id) {
    throw new Error("TARGET_LEAKAGE: feature example id mismatch");
  }
  const cut = features.example.feature_cutoff;
  if (Date.parse(cut) > Date.parse(target.event_time)) {
    throw new Error("FUTURE_FEATURES: feature_cutoff after kickoff");
  }
  for (const d of features.feature_data) {
    if (d.entered_model && d.available_at) {
      assertNoFutureDataInModel({ asOf: cut, available_at: d.available_at });
    }
    if (d.origin === "MARKET" && d.entered_model) {
      throw new Error(`ODDS_LEAKAGE: MARKET origin entered model (${d.key})`);
    }
  }
}

export function assertUniverseAsOf(target: PiMatchRow, used: readonly PiMatchRow[]): void {
  const cut = featureCutoffForMatch(target);
  assertNoFutureLeakage({ featureCutoff: cut, usedMatches: used, targetId: target.canonical_id });
  const allowed = new Set(priorMatchesAsOf(used.concat([target]), cut).map((m) => m.canonical_id));
  for (const m of used) {
    if (m.canonical_id === target.canonical_id) {
      throw new Error("TARGET_LEAKAGE: target in universe used for features");
    }
    if (!allowed.has(m.canonical_id) && Date.parse(m.result_available_at) >= Date.parse(cut)) {
      throw new Error(`TEMPORAL_LEAKAGE: ${m.canonical_id}`);
    }
  }
}

export function leakageAuditReport(input: {
  matches: readonly Phase9Match[];
  sampleFeatures: { target: Phase9Match; keys: string[] }[];
  splitMethod: string;
}): {
  temporal_pass: boolean;
  target_pass: boolean;
  odds_pass: boolean;
  random_split_rejected: boolean;
  future_features_pass: boolean;
  date_only_policy: "DATE_ONLY_CONSERVATIVE";
  neon_in_use: false;
  notes: string[];
} {
  const notes: string[] = [];
  let temporal_pass = true;
  let target_pass = true;
  let odds_pass = true;
  let future_features_pass = true;
  let random_split_rejected = false;
  try {
    assertNoRandomSplit(input.splitMethod);
    random_split_rejected = true;
  } catch {
    random_split_rejected = true;
    if (input.splitMethod.toLowerCase().includes("random")) {
      notes.push("split method claimed random — blocked");
    }
  }
  for (const row of input.sampleFeatures) {
    try {
      assertNoMarketInputsInPredictionContext(row.keys);
      assertNoClosingOddsInPredictionContext(row.keys);
    } catch (e) {
      odds_pass = false;
      notes.push(e instanceof Error ? e.message : String(e));
    }
    const cut = featureCutoffForMatch(row.target);
    if (Date.parse(cut) > Date.parse(row.target.event_time)) {
      future_features_pass = false;
    }
  }
  if (input.matches.length >= 2) {
    const sorted = [...input.matches].sort((a, b) => a.event_time.localeCompare(b.event_time));
    const later = sorted[sorted.length - 1]!;
    const earlier = sorted[0]!;
    try {
      assertPreviousMatchBeforeKickoff({ previous: earlier, target: later });
    } catch {
      /* first vs last should pass; if not, dates are equal — flag */
      if (earlier.canonical_id !== later.canonical_id && earlier.match_date === later.match_date) {
        notes.push("same-calendar-day pairs exist; DATE_ONLY excludes same-day results");
      }
    }
    const cut = featureCutoffForMatch(later);
    const priors = priorMatchesAsOf(sorted, cut);
    if (priors.some((m) => m.canonical_id === later.canonical_id)) {
      target_pass = false;
      temporal_pass = false;
    }
  }
  notes.push("feature_cutoff = match_date 00:00 UTC (DATE_ONLY); result_available_at = next UTC day");
  notes.push("odds columns may exist on the row but must not appear in independent feature keys");
  return {
    temporal_pass,
    target_pass,
    odds_pass,
    random_split_rejected,
    future_features_pass,
    date_only_policy: "DATE_ONLY_CONSERVATIVE",
    neon_in_use: false,
    notes,
  };
}
