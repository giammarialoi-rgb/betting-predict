import { isAggregateBookmakerLabel } from "@/domain/eval/recovery-022/bookmakers";
import type {
  BeatTheBookieRecord,
  ObservationTemporalClass022,
  RecordLane022,
} from "@/domain/eval/recovery-022/types";

export function classifyLane(input: {
  kind: "closing_aggregate" | "series_hourly" | "sql_odds_datetime" | "unknown";
  bookmaker: string | null;
  precision: ObservationTemporalClass022;
  timezoneVerified: boolean;
}): RecordLane022 {
  if (input.kind === "closing_aggregate") return "RESEARCH_ONLY";
  if (input.bookmaker && isAggregateBookmakerLabel(input.bookmaker)) return "RESEARCH_ONLY";
  if (input.kind === "unknown") return "BLOCKED";
  if (input.kind === "series_hourly") {
    if (input.precision === "RELATIVE_TO_KICKOFF_APPROX") return "STRICT_CANDIDATE";
    return "RESEARCH_ONLY";
  }
  if (input.kind === "sql_odds_datetime") {
    if (input.precision === "EXACT_TIMESTAMP" && input.timezoneVerified) {
      return "STRICT_CANDIDATE";
    }
    return "RESEARCH_ONLY";
  }
  return "BLOCKED";
}

export function assertNoStrictPromotion(row: BeatTheBookieRecord): void {
  if (row.usable_strict_capital) {
    throw new Error("MODEL_READY/STRICT auto-promotion is forbidden on BeatTheBookie v1");
  }
}
