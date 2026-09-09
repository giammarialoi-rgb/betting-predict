import { strictUsable } from "@/domain/eval/attack-024/temporal";
import type {
  GateTrace024,
  KickoffPrecision024,
  TemporalClass024,
  TemporalRelation024,
  TimestampPrecision024,
} from "@/domain/eval/attack-024/types";

export function buildGateTrace(input: {
  sourceId: string;
  exists: boolean;
  acquired: boolean;
  parsed: boolean;
  hasTimestamp: boolean;
  kickoff: KickoffPrecision024;
  quote: TimestampPrecision024;
  relation: TemporalRelation024;
  temporal_class: TemporalClass024;
  note: string;
}): GateTrace024 {
  const relationProven = input.relation !== "UNKNOWN";
  return {
    sourceId: input.sourceId,
    SOURCE_EXISTS: input.exists,
    SOURCE_ACQUIRED: input.acquired,
    SOURCE_PARSED: input.parsed,
    SOURCE_HAS_TIMESTAMP: input.hasTimestamp,
    TIMESTAMP_IS_EXACT: input.quote === "EXACT",
    KICKOFF_IS_EXACT: input.kickoff === "EXACT",
    TEMPORAL_RELATION_PROVEN: relationProven,
    STRICT_USABLE: strictUsable({
      acquired: input.acquired,
      parsed: input.parsed,
      kickoff: input.kickoff,
      quote: input.quote,
      relation: input.relation,
    }),
    temporal_class: input.temporal_class,
    note: input.note,
  };
}
