import type { EventType } from "../sports/types";

/**
 * Legacy generic labels retained for sport-agnostic event types.
 * Prefer sport-specific ids (e.g. result, total_goals) when modeling football.
 */
export const LEGACY_MARKET_TYPES = [
  "winner",
  "draw",
  "moneyline",
  "spread",
  "total",
  "handicap",
  "set_winner",
  "game_winner",
  "race_winner",
  "podium",
] as const;

export type LegacyMarketType = (typeof LEGACY_MARKET_TYPES)[number];

/** @deprecated Use catalog market ids; kept as alias of LegacyMarketType. */
export type MarketType = string;

export const SELECTION_KINDS = [
  "binary",
  "ternary",
  "n_way",
  "numeric_line",
] as const;

export type SelectionKind = (typeof SELECTION_KINDS)[number];

export const MARKET_FAMILIES = [
  "match_result",
  "goals",
  "handicap",
  "halves",
  "corners",
  "cards",
  "shots",
  "player",
  "generic",
  "other",
] as const;

export type MarketFamily = (typeof MARKET_FAMILIES)[number];

/**
 * CATALOG_CAPABILITY — theoretically modellable for this sport/event type.
 * DISCOVERED — seen in a provider payload once (not yet validated).
 * OBSERVED — repeatedly observed with provenance.
 * MODEL_READY — outcome + features + temporal policy approved.
 */
export const MARKET_READINESS = [
  "CATALOG_CAPABILITY",
  "DISCOVERED",
  "OBSERVED",
  "MODEL_READY",
] as const;

export type MarketReadiness = (typeof MARKET_READINESS)[number];

export type OutcomeType =
  | "enum_selection"
  | "over_under"
  | "handicap_cover"
  | "correct_score"
  | "range"
  | "player_threshold"
  | "unknown";

export type MarketDefinition = {
  readonly id: string;
  readonly name: string;
  /** Sport slug or "*" for cross-sport generic markets. */
  readonly sport: string | "*";
  readonly family: MarketFamily;
  readonly selections: readonly string[];
  readonly requiresLine: boolean;
  readonly requiresPlayer: boolean;
  readonly requiresTeam: boolean;
  readonly outcomeType: OutcomeType;
  readonly selectionKind: SelectionKind;
  readonly applicableEventTypes: readonly EventType[];
  readonly readiness: MarketReadiness;
  readonly notes?: string;
};

/** @deprecated Prefer MARKET ids from catalog; retained for older imports. */
export const MARKET_TYPES = LEGACY_MARKET_TYPES;
