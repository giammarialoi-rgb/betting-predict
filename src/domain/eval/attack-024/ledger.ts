/**
 * STRICT_EVENT_LEDGER — only events with proven quote_timestamp < kickoff.
 */

import { readFileSync } from "node:fs";
import { loadExp023Config, matchOddsFixturePath } from "@/domain/eval/temporal-023/config";
import { parseMcmNdjson } from "@/domain/eval/temporal-023/parse-mcm";
import { runBlindLock023 } from "@/domain/eval/temporal-023/replay";
import { classifyTemporalRelation } from "@/domain/eval/attack-024/temporal";
import type { StrictLedgerRow024 } from "@/domain/eval/attack-024/types";

export function buildStrictLedgerFromBetfairFixture(): StrictLedgerRow024[] {
  const parsed = parseMcmNdjson(readFileSync(matchOddsFixturePath(), "utf8"));
  const blind = runBlindLock023({ cfg: loadExp023Config(), parsed });
  const timestamps = [blind.entry.HOME.timestamp, blind.entry.DRAW.timestamp, blind.entry.AWAY.timestamp]
    .filter((t): t is string => t != null)
    .map((t) => Date.parse(t));
  if (timestamps.length === 0) return [];
  const quoteMs = Math.max(...timestamps);
  const kickoffMs = Date.parse(blind.kickoff);
  const relation = classifyTemporalRelation({ quoteMs, kickoffMs });
  if (relation !== "QUOTE_BEFORE_KICKOFF") return [];
  if (!blind.triple_complete || blind.unknown_ticks > 0) return [];
  if (!blind.kickoff.endsWith("Z")) return [];
  const quoteIso = new Date(quoteMs).toISOString();
  const outcome = blind.settlement_winner ?? "UNKNOWN";
  const competition = /middlesbrough/i.test(blind.eventName) ? "EPL" : "UNKNOWN";
  return [
    {
      event: "M001",
      competition,
      kickoff_utc: blind.kickoff,
      market: "MATCH_ODDS",
      bookmaker_or_exchange: "Betfair Exchange",
      quote_timestamp: quoteIso,
      delta_kickoff_sec: Math.round((quoteMs - kickoffMs) / 1000),
      outcome,
      strict: "YES",
      lineage_root: "historicdata.betfair.com",
      independence: "MIRROR",
    },
  ];
}
