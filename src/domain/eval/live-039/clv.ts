import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { Quote039 } from "@/domain/eval/live-039/types";

export type Clv039 =
  | {
      status: "OK";
      entry_timestamp: string;
      entry_price: number;
      later_timestamp: string;
      later_price: number;
    }
  | { status: "CLV_UNAVAILABLE" };

export function clv039(input: {
  entry: Quote039;
  later: readonly Quote039[];
}): Clv039 {
  const entryMs = parseExactUtcMs(input.entry.source_quote_timestamp);
  if (entryMs == null) return { status: "CLV_UNAVAILABLE" };
  const later = input.later
    .filter(
      (q) =>
        q.event_id === input.entry.event_id &&
        q.bookmaker === input.entry.bookmaker &&
        q.market === input.entry.market &&
        q.outcome === input.entry.outcome &&
        q.source_quote_timestamp,
    )
    .map((q) => ({ q, ms: parseExactUtcMs(q.source_quote_timestamp) }))
    .filter((x): x is { q: Quote039; ms: number } => x.ms != null && x.ms > entryMs);
  if (!later.length) return { status: "CLV_UNAVAILABLE" };
  const best = later.reduce((a, b) => (a.ms >= b.ms ? a : b));
  return {
    status: "OK",
    entry_timestamp: input.entry.source_quote_timestamp!,
    entry_price: input.entry.price,
    later_timestamp: best.q.source_quote_timestamp!,
    later_price: best.q.price,
  };
}
