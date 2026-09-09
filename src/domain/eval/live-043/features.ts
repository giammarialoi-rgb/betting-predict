import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";

export type FeatureFlag043 = "OK" | "FEATURE_BLOCKED" | "UNKNOWN";

export type FeaturePacket043 = {
  family: string;
  value: number | string | null;
  available_at: string | null;
  flag: FeatureFlag043;
};

/** Timestamp-safe feature gate: blocked if available_at missing or after asOf. */
export function admitFeature043(availableAt: string | null, asOf: string): FeatureFlag043 {
  if (!availableAt) return "FEATURE_BLOCKED";
  const a = parseExactUtcMs(availableAt);
  const b = parseExactUtcMs(asOf);
  if (a == null || b == null) return "FEATURE_BLOCKED";
  if (a > b) return "FEATURE_BLOCKED";
  return "OK";
}

export function buildFeatureSnapshot043(input: {
  asOf: string;
  marketDispersion: number | null;
  nBooks: number;
  sport: string;
}): Record<string, FeaturePacket043> {
  const asOf = input.asOf;
  return {
    MARKET: {
      family: "MARKET",
      value: input.nBooks,
      available_at: asOf,
      flag: admitFeature043(asOf, asOf),
    },
    BOOKMAKER_DISPERSION: {
      family: "BOOKMAKER_DISPERSION",
      value: input.marketDispersion,
      available_at: asOf,
      flag: input.marketDispersion == null ? "UNKNOWN" : admitFeature043(asOf, asOf),
    },
    ELO_RANKING: { family: "ELO/RANKING", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    FORM: { family: "FORM", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    HISTORY_H2H: { family: "HISTORY/H2H", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    SCHEDULE: { family: "SCHEDULE", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    REST: { family: "REST", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    HOME_AWAY: { family: "HOME/AWAY", value: input.sport === "soccer" ? 1 : null, available_at: asOf, flag: input.sport === "soccer" ? "OK" : "FEATURE_BLOCKED" },
    COMPETITION: { family: "COMPETITION", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    MOVEMENT: { family: "MOVEMENT", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    TENNIS_SURFACE: { family: "TENNIS_SURFACE", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    PLAYER_CONTEXT: { family: "PLAYER_CONTEXT", value: null, available_at: null, flag: "FEATURE_BLOCKED" },
    DATA_QUALITY: {
      family: "DATA_QUALITY",
      value: Math.min(1, input.nBooks / 10),
      available_at: asOf,
      flag: "OK",
    },
  };
}

export function dataQualityScore043(features: Record<string, FeaturePacket043>): number {
  const vals = Object.values(features);
  if (!vals.length) return 0;
  const ok = vals.filter((f) => f.flag === "OK").length;
  return ok / vals.length;
}
