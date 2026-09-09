import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import { teamKey } from "@/domain/eval/breakthrough-027/features";
import { marketDevig } from "@/domain/eval/turnaround-025/models";
import { actualIdx } from "@/domain/eval/validation-028/metrics";
import { corpusPartition } from "@/domain/eval/validation-028/partition";
import type { Exp028Config } from "@/domain/eval/validation-028/types";
import type { Exp029Config, Family029, Partition029 } from "@/domain/eval/incremental-029/types";
import {
  emptyTeam,
  familyVector,
  updateTeam,
  type TeamState029,
} from "@/domain/eval/incremental-029/features";
import {
  disagreementVsPrimary,
  type BookQuote029,
  type Disagreement029,
} from "@/domain/eval/incremental-029/overlay";

const FAMILIES: Family029[] = ["elo", "form", "schedule", "disagreement", "news", "weather"];

export type WalkRow029 = {
  event: StrictCandidate027;
  partition: Partition029;
  year: number;
  week: string;
  actual: 0 | 1 | 2;
  market: [number, number, number];
  asOf: string;
  x: Record<Family029, number[]>;
  disagree: Disagreement029;
};

export function walk029(input: {
  events: readonly StrictCandidate027[];
  cfg029: Exp029Config;
  books: Map<string, BookQuote029[]>;
}): WalkRow029[] {
  const cfg028 = { corpus_partitions: input.cfg029.corpus_partitions } as Exp028Config;
  const teams = new Map<string, TeamState029>();
  const rows: WalkRow029[] = [];
  for (const event of input.events) {
    const asOfMs = Date.parse(event.as_of);
    const kickMs = Date.parse(event.kickoff);
    if (!(asOfMs < kickMs)) throw new BlindLeakageError("quote not < kickoff");
    const hk = teamKey(event.home);
    const ak = teamKey(event.away);
    const home = teams.get(hk) ?? emptyTeam();
    const away = teams.get(ak) ?? emptyTeam();
    if (!teams.has(hk)) teams.set(hk, home);
    if (!teams.has(ak)) teams.set(ak, away);
    const market = marketDevig({
      home: event.home_odds,
      draw: event.draw_odds,
      away: event.away_odds,
    });
    if (!market) continue;
    const payload: Record<string, unknown> = {
      event_id: event.event_id,
      as_of: event.as_of,
      odds: { home: event.home_odds, draw: event.draw_odds, away: event.away_odds },
    };
    if ("ft_home" in payload || "outcome" in payload || "clv" in payload) {
      throw new BlindLeakageError("forbidden field in DecisionContext");
    }
    const disagree = disagreementVsPrimary(input.books.get(event.match_id), {
      home: event.home_odds,
      draw: event.draw_odds,
      away: event.away_odds,
    });
    const args = { home, away, asOfMs, disagree };
    const x = {} as Record<Family029, number[]>;
    for (const f of FAMILIES) x[f] = familyVector({ family: f, ...args });
    const y0 = Date.UTC(Number(event.kickoff.slice(0, 4)), 0, 1);
    const weekN = Math.floor((kickMs - y0) / (7 * 86_400_000));
    rows.push({
      event,
      partition: corpusPartition(event.kickoff, cfg028),
      year: Number(event.kickoff.slice(0, 4)),
      week: `${event.kickoff.slice(0, 4)}-W${weekN}`,
      actual: actualIdx(event.ft_home, event.ft_away),
      market,
      asOf: event.as_of,
      x,
      disagree,
    });
    updateTeam({
      home,
      away,
      ftHome: event.ft_home,
      ftAway: event.ft_away,
      kickMs,
    });
  }
  return rows;
}
