import type { MarketQuoteTick, MarketSignalStatus, MarketTemporalPrecision } from "@/domain/eval/market-intelligence/types";

/** Classify a tick against decision asOf — never invent available_at. */
export function classifyTickTemporal(input: {
  available_at: string | null | undefined;
  asOf: string;
}): { status: MarketSignalStatus; temporal_precision: MarketTemporalPrecision } {
  if (!input.available_at) {
    return { status: "NOT_ELIGIBLE", temporal_precision: "UNKNOWN" };
  }
  const t = Date.parse(input.available_at);
  const asOfMs = Date.parse(input.asOf);
  if (!Number.isFinite(t) || !Number.isFinite(asOfMs)) {
    return { status: "NOT_ELIGIBLE", temporal_precision: "UNKNOWN" };
  }
  if (t > asOfMs) {
    return { status: "NOT_ELIGIBLE", temporal_precision: "STRICT_AS_OF" };
  }
  return { status: "ELIGIBLE", temporal_precision: "STRICT_AS_OF" };
}

export function filterEligibleTicks(
  ticks: readonly MarketQuoteTick[],
  asOf: string,
): { eligible: MarketQuoteTick[]; blocked: MarketQuoteTick[] } {
  const eligible: MarketQuoteTick[] = [];
  const blocked: MarketQuoteTick[] = [];
  for (const raw of ticks) {
    const cls = classifyTickTemporal({ available_at: raw.available_at, asOf });
    const tick: MarketQuoteTick = {
      ...raw,
      status: cls.status,
      temporal_precision: cls.temporal_precision,
      volume: null,
    };
    if (cls.status === "ELIGIBLE") eligible.push(tick);
    else blocked.push(tick);
  }
  return { eligible, blocked };
}

/** Hard assert: market-intelligence fields must never be passed as MODEL feature keys. */
export function assertMarketSignalsNotInModelFeatures(featureKeys: readonly string[]): void {
  const bans = [
    "odds",
    "price",
    "quote",
    "drift",
    "steam",
    "market_prob",
    "implied_prob",
    "devig",
    "liquidity",
    "volume",
    "rlm",
    "movement_label",
  ];
  for (const k of featureKeys) {
    const low = k.toLowerCase();
    for (const ban of bans) {
      if (low.includes(ban)) {
        throw new Error(`MARKET_SIGNAL_FORBIDDEN_IN_MODEL_FEATURES: ${k}`);
      }
    }
  }
}
