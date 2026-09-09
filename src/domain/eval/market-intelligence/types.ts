import type { MovementLabel034 } from "@/domain/eval/market-034/diagnostics";

export type MarketSignalStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNAVAILABLE";

export type MarketTemporalPrecision = "STRICT_AS_OF" | "DATE_ONLY" | "UNKNOWN";

export type LiquidityProxyBand = "high" | "medium" | "low" | "unknown";

/** Unified tick contract — volume always null until a licensed exchange feed exists. */
export type MarketQuoteTick = {
  source: string;
  event_id: string;
  market: string;
  selection: string;
  bookmaker: string;
  price: number;
  implied_prob: number;
  volume: null;
  retrieved_at: string;
  available_at: string | null;
  status: MarketSignalStatus;
  temporal_precision: MarketTemporalPrecision;
};

export type MarketSignalSnapshot = {
  event_id: string;
  market: string;
  as_of: string;
  delta_fav_p: number | null;
  drift_pct: number | null;
  movement: number | null;
  movement_velocity: number | null;
  movement_label: MovementLabel034;
  steam_move: boolean;
  steam_books_aligned: number;
  consensus_dispersion: number | null;
  n_books: number;
  liquidity_proxy: LiquidityProxyBand;
  liquidity_label: "LIQUIDITY_PROXY_BOOKS";
  volume: null;
  volume_status: "UNAVAILABLE";
  rlm_status: "UNAVAILABLE";
  reason_codes: string[];
  ticks_eligible: number;
  ticks_blocked: number;
  favorite_selection: string | null;
  snapshot_hash: string;
  contextual_factors: string[];
  real_money: false;
  enters_independent_model: false;
};
