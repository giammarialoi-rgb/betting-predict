import type { PermanentEvent044, PermanentPrediction044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";
import type { DataQualityStatus048 } from "@/domain/eval/factory-048/config";
import { coverageBinsForEvent047 } from "@/domain/eval/factory-047/coverage";
import { catalogMarketsForEvent047 } from "@/domain/eval/factory-047/market-catalog";

export type FeatureSnapshot048 = {
  event_id: string;
  observed_at: string;
  decision_context: "PRE_LOCK" | "LOCK" | "POST_LOCK" | "SETTLEMENT" | "AUTOPSY";
  market: string;
  probabilities: Record<string, number> | null;
  devig_probabilities: Record<string, number> | null;
  odds: { selection: string; price: number; bookmaker: string; available_at: string | null }[];
  consensus: number | null;
  movement: number | null;
  schedule_features: { kickoff_utc: string | null; hours_to_kickoff: number | null };
  form_features: Record<string, number | null> | null;
  history_features: Record<string, number | null> | null;
  market_features: {
    n_books: number;
    dispersion: number | null;
    markets_available: string[];
    markets_analyzed: string[];
    markets_rejected: string[];
    markets_rejection_reason: string | null;
  };
  data_quality: number;
  data_quality_status: DataQualityStatus048;
  data_quality_reasons: string[];
  feature_availability: Record<string, "AVAILABLE" | "NOT_AVAILABLE">;
  model_version: string;
  null_reasons: Record<string, string>;
};

/** Build PRE_LOCK feature snapshot — never invent missing features. */
export function buildFeatureSnapshot048(input: {
  event: PermanentEvent044;
  quotes: PermanentQuote044[];
  prediction: PermanentPrediction044 | null;
  observedAt: string;
  decisionContext: FeatureSnapshot048["decision_context"];
  modelVersion: string;
  dispersion: number | null;
  nBooks: number;
  /** Optional PI as-of form/history — only when independently computed upstream. */
  piFormFeatures?: Record<string, number | null> | null;
  piHistoryFeatures?: Record<string, number | null> | null;
}): FeatureSnapshot048 {
  const markets = catalogMarketsForEvent047(input.quotes);
  const keys = [...new Set(markets.map((m) => m.market_key))];
  const bins = coverageBinsForEvent047(input.event, input.quotes);
  const reasons: string[] = [];
  if (!bins.T72) reasons.push("MISSING_T72");
  if (!bins.T24) reasons.push("MISSING_T24");
  if (!bins.T1H) reasons.push("MISSING_T1H");
  if (!keys.length) reasons.push("MISSING_MARKET");
  if (!input.event.kickoff_utc) reasons.push("MISSING_KICKOFF");

  let status: DataQualityStatus048 = "COMPLETE";
  if (reasons.includes("MISSING_MARKET") || reasons.includes("MISSING_KICKOFF")) status = "BLOCKED";
  else if (reasons.length >= 3) status = "LOW_QUALITY";
  else if (reasons.length > 0) status = "PARTIAL";

  const kickMs = input.event.kickoff_utc ? Date.parse(input.event.kickoff_utc) : NaN;
  const obsMs = Date.parse(input.observedAt);
  const hours =
    Number.isFinite(kickMs) && Number.isFinite(obsMs) ? (kickMs - obsMs) / 3600_000 : null;

  const null_reasons: Record<string, string> = {};
  if (!input.prediction?.probability_model) null_reasons.probabilities = "NO_MODEL_PROBS";
  const form = input.piFormFeatures ?? null;
  const history = input.piHistoryFeatures ?? null;
  if (!form) null_reasons.form_features = "NOT_AVAILABLE";
  if (!history) null_reasons.history_features = "NOT_AVAILABLE";

  return {
    event_id: input.event.event_id,
    observed_at: input.observedAt,
    decision_context: input.decisionContext,
    market: input.prediction?.market ?? keys[0] ?? "UNKNOWN",
    probabilities: input.prediction?.probability_model ?? null,
    devig_probabilities: input.prediction?.probability_market ?? null,
    odds: input.quotes.slice(0, 40).map((q) => ({
      selection: q.selection,
      price: q.price,
      bookmaker: q.bookmaker,
      available_at: q.available_at_utc,
    })),
    consensus: input.prediction?.probability_market
      ? Object.values(input.prediction.probability_market).reduce((a, b) => a + b, 0) /
        Object.keys(input.prediction.probability_market).length
      : null,
    movement: input.prediction?.edge_absolute ?? null,
    schedule_features: {
      kickoff_utc: input.event.kickoff_utc,
      hours_to_kickoff: hours,
    },
    form_features: form,
    history_features: history,
    market_features: {
      n_books: input.nBooks,
      dispersion: input.dispersion,
      markets_available: keys,
      markets_analyzed: keys,
      markets_rejected: [],
      markets_rejection_reason: keys.length ? null : "NO_QUOTES_FROM_PROVIDER",
    },
    data_quality: input.prediction?.data_quality_score ?? (keys.length ? 0.4 : 0.1),
    data_quality_status: status,
    data_quality_reasons: reasons,
    feature_availability: {
      market: keys.length ? "AVAILABLE" : "NOT_AVAILABLE",
      form: form ? "AVAILABLE" : "NOT_AVAILABLE",
      history: history ? "AVAILABLE" : "NOT_AVAILABLE",
      injury: "NOT_AVAILABLE",
      lineup: "NOT_AVAILABLE",
    },
    model_version: input.modelVersion,
    null_reasons,
  };
}
