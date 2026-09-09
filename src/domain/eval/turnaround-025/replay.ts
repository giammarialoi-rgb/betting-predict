import { readFileSync } from "node:fs";
import { loadExp023Config, matchOddsFixturePath } from "@/domain/eval/temporal-023/config";
import {
  asOfFromKickoff,
  canonicalSnapshotAt,
} from "@/domain/eval/temporal-023/asof";
import { parseMcmNdjson } from "@/domain/eval/temporal-023/parse-mcm";
import { runBlindLock023 } from "@/domain/eval/temporal-023/replay";
import { matchOddsMarketId, ticksForMarket } from "@/domain/eval/temporal-023/parse-mcm";
import { canonicalSelection } from "@/domain/eval/temporal-023/classify";
import { AS_OF_WINDOWS } from "@/domain/eval/temporal-023/types";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import { buildTurnaround025Assessment } from "@/domain/eval/turnaround-025/evidence";
import { loadExp025Config } from "@/domain/eval/turnaround-025/config";
import { marketDevig, stage2Decision } from "@/domain/eval/turnaround-025/models";
import { movementFromObserved, TTK_LABEL, type TtkRow025 } from "@/domain/eval/turnaround-025/ttk";
import type { AnnualRow025, MatchGrade025 } from "@/domain/eval/turnaround-025/types";
import { STRICT_EVENT_GATE } from "@/domain/eval/turnaround-025/types";

export type BlindDecision025 = {
  eventId: string;
  asOf: string;
  decision: "BET" | "NO_BET";
  candidate: boolean;
  reason: string;
  capitalEligible: boolean;
  market: "MATCH_ODDS";
  prices: { home: number | null; draw: number | null; away: number | null };
  clv_diagnostic: {
    used_in_decision: false;
    computed_after_lock: true;
    implied_delta: number | null;
  };
  match_grade: MatchGrade025 | "SELF_CONTAINED";
  evidence_graph: true;
};

function runnerIds(parsed: ReturnType<typeof parseMcmNdjson>, marketId: string) {
  const def = parsed.definitions.find((d) => d.marketId === marketId && d.runners.length >= 3);
  const out = { HOME: null as number | null, DRAW: null as number | null, AWAY: null as number | null };
  if (!def) return out;
  for (const r of def.runners) {
    const side = canonicalSelection(r);
    if (side === "HOME" || side === "DRAW" || side === "AWAY") out[side] = r.selectionId;
  }
  return out;
}

export function runStrictBlind025(input: {
  club: ClubMatchLite | null;
  matchGrade: MatchGrade025 | "SELF_CONTAINED";
}): {
  decision: BlindDecision025;
  ttk: TtkRow025[];
  movement: ReturnType<typeof movementFromObserved>;
  assessment: ReturnType<typeof buildTurnaround025Assessment>;
  kickoff: string;
  quote_timestamp: string | null;
} {
  const cfg025 = loadExp025Config();
  const cfg023 = loadExp023Config();
  const parsed = parseMcmNdjson(readFileSync(matchOddsFixturePath(), "utf8"));
  const blind = runBlindLock023({ cfg: cfg023, parsed });
  const marketId = matchOddsMarketId(parsed)!;
  const ticks = ticksForMarket(parsed, marketId);
  const ids = runnerIds(parsed, marketId);
  const ttk: TtkRow025[] = AS_OF_WINDOWS.map((w) => {
    const asOf = asOfFromKickoff(blind.kickoff, w.requestedSec);
    const snap = ids.HOME
      ? canonicalSnapshotAt({
          eventId: blind.eventId,
          kickoff: blind.kickoff,
          asOf,
          market: "MATCH_ODDS",
          selection: "HOME",
          ticks,
          selectionId: ids.HOME,
          source: "betfair-historic-basic-mirror",
        })
      : null;
    return {
      bucket: TTK_LABEL[w.window],
      observed: snap?.status === "OK" && snap.price != null,
      price: snap?.price ?? null,
      timestamp: snap?.timestamp ?? null,
      seconds_before_kickoff: snap?.secondsToKickoff ?? null,
    };
  });
  const odds =
    blind.entry.HOME.price && blind.entry.DRAW.price && blind.entry.AWAY.price
      ? { home: blind.entry.HOME.price, draw: blind.entry.DRAW.price, away: blind.entry.AWAY.price }
      : null;
  const probs = odds ? marketDevig(odds) : null;
  const stage = stage2Decision({
    capitalEligible: true,
    declaredEdge: cfg025.declared_edge,
    probs,
    market: probs,
    threshold: cfg025.frozen_edge_threshold,
    trainN: 1,
    minTrain: STRICT_EVENT_GATE,
    calibrationOk: false,
    liquidityOk: false,
    timestampStrict: true,
    evidenceGraph: true,
  });
  const asOf = new Date(blind.asOf);
  const assessment = buildTurnaround025Assessment({
    asOf,
    eventId: blind.eventId,
    eventName: blind.eventName,
    homeLtp: blind.entry.HOME.price,
    drawLtp: blind.entry.DRAW.price,
    awayLtp: blind.entry.AWAY.price,
    marketProbs: probs,
    matchGrade: input.matchGrade,
    club: input.club,
    kickoffIso: blind.kickoff,
  });
  const timestamps = [blind.entry.HOME.timestamp, blind.entry.DRAW.timestamp, blind.entry.AWAY.timestamp].filter(
    (t): t is string => t != null,
  );
  return {
    decision: {
      eventId: blind.eventId,
      asOf: blind.asOf,
      decision: stage.decision,
      candidate: stage.candidate,
      reason: stage.reason,
      capitalEligible: stage.capitalEligible,
      market: "MATCH_ODDS",
      prices: {
        home: blind.entry.HOME.price,
        draw: blind.entry.DRAW.price,
        away: blind.entry.AWAY.price,
      },
      clv_diagnostic: {
        used_in_decision: false,
        computed_after_lock: true,
        implied_delta: blind.clv.implied_delta,
      },
      match_grade: input.matchGrade,
      evidence_graph: true,
    },
    ttk,
    movement: movementFromObserved(ttk),
    assessment,
    kickoff: blind.kickoff,
    quote_timestamp: timestamps.length ? timestamps.sort()[timestamps.length - 1]! : null,
  };
}

export function annualBankroll025(input: {
  years: readonly number[];
  strictByYear: ReadonlyMap<number, number>;
  decisionsByYear: ReadonlyMap<number, number>;
  candidatesByYear: ReadonlyMap<number, number>;
  betsByYear: ReadonlyMap<number, number>;
  eventsByYear: ReadonlyMap<number, number>;
}): AnnualRow025[] {
  return input.years.map((year) => {
    const strict = input.strictByYear.get(year) ?? 0;
    const events = input.eventsByYear.get(year) ?? 0;
    const decisions = input.decisionsByYear.get(year) ?? 0;
    const candidates = input.candidatesByYear.get(year) ?? 0;
    const bets = input.betsByYear.get(year) ?? 0;
    const incomplete = year >= 2026;
    if (bets > 0) {
      throw new Error("TASK 025 must not settle capital while declared_edge=false");
    }
    return {
      year,
      events,
      strict,
      decisions,
      candidates,
      bets,
      start: 1000,
      end: null,
      pnl: null,
      roi: null,
      max_dd: null,
      sharpe: null,
      status: incomplete ? "INCOMPLETE" : "INSUFFICIENT_DATA",
    };
  });
}
