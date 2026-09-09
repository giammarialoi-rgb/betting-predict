import type { MarketRow033, TemporalClass033, WindowId033 } from "@/domain/eval/market-033/types";
import { WINDOW_SECONDS_033 } from "@/domain/eval/market-033/types";

export function classifyMarketFamily(raw: string | null | undefined): MarketRow033 | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase().replace(/_/g, " ");
  if (n === "match odds" || n === "matchodds" || n === "1x2" || n === "result") return "1X2";
  if (n.includes("both teams to score") || n === "btts" || n.includes("both teams to score?")) return "BTTS";
  if (n.includes("draw no bet") || n === "dnb") return "DNB";
  if (n.includes("double chance") || n === "dc") return "DC";
  if (n.includes("correct score")) return "Correct Score";
  if (n.includes("corner")) return "Corners";
  if (n.includes("card") || n.includes("booking")) return "Cards";
  if (n.includes("player") || n.includes("scorer") || n.includes("hat trick") || n.includes("tricked")) {
    return "Player";
  }
  if (n.includes("over/under") || n.includes("over under") || n.startsWith("over under") || n.includes("total goals")) {
    return "OU";
  }
  if (
    n.includes("asian handicap") ||
    n.includes("handicap") ||
    /\+\d/.test(raw) ||
    n.includes("asian")
  ) {
    return "AH";
  }
  return null;
}

export function isExchangeSource(source: string): boolean {
  return /betfair|exchange/i.test(source);
}

/** Naive clocks may be ordered; they must not be treated as UTC. */
export function refuseNaiveAsUtc(value: string): "TEMPORALLY_UNKNOWN" {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value.trim())) {
    throw new Error("ISO offset present — do not call refuseNaiveAsUtc");
  }
  return "TEMPORALLY_UNKNOWN";
}

export function temporalClassFromEvidence(input: {
  quoteIsoZ: boolean;
  kickoffIsoZ: boolean;
  quoteBeforeKickoff: boolean;
  dateOnly: boolean;
  postMatch: boolean;
  closingAtKickoff: boolean;
}): TemporalClass033 {
  if (input.postMatch) return "POST_MATCH";
  if (input.closingAtKickoff) return "FORBIDDEN";
  if (input.dateOnly) return "LEVEL_B_DATE_ONLY";
  if (input.quoteIsoZ && input.kickoffIsoZ && input.quoteBeforeKickoff) return "LEVEL_A_EXACT";
  return "UNKNOWN";
}

const WINDOW_ORDER_DESC: WindowId033[] = [
  "72h",
  "48h",
  "24h",
  "12h",
  "6h",
  "3h",
  "1h",
  "30m",
  "15m",
  "5m",
  "1m",
];

/** True only if a real tick falls in that bucket. A T-3h tick does not fill T-72h or T-1h. */
export function coverageFromSeconds(values: readonly number[]): Record<WindowId033, boolean> {
  const out = {} as Record<WindowId033, boolean>;
  for (let i = 0; i < WINDOW_ORDER_DESC.length; i++) {
    const id = WINDOW_ORDER_DESC[i]!;
    const lo = WINDOW_SECONDS_033[id];
    const hi = i === 0 ? Number.POSITIVE_INFINITY : WINDOW_SECONDS_033[WINDOW_ORDER_DESC[i - 1]!];
    out[id] = values.some((s) => s >= lo && s < hi);
  }
  return out;
}
