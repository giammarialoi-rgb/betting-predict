/**
 * Blind LOCK pipeline for TASK 023.
 * Outcome, settlement, closing, and in-play ticks are inaccessible until LOCK.
 */

import { assertDecisionPayloadSafe } from "@/domain/eval/actuarial-018/integrity";
import { loadExp016Config } from "@/domain/eval/bankroll/exp016-config";
import { allocateCapital, signalStrength } from "@/domain/eval/capital-020/risk";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { evaluateModelReadyGates } from "@/domain/markets/model-ready-gates";
import {
  asOfFromKickoff,
  canonicalSnapshotAt,
  windowCoverage,
  windowSnapshotsForSelection,
} from "@/domain/eval/temporal-023/asof";
import { computeClvAfterLock, lastPrematchClose } from "@/domain/eval/temporal-023/clv";
import { canonicalSelection } from "@/domain/eval/temporal-023/classify";
import { buildTemporal023Assessment } from "@/domain/eval/temporal-023/evidence";
import { firstAvailableStats } from "@/domain/eval/temporal-023/first-available";
import {
  assertFrozen023,
  leakCCloseBeforeLock,
  leakFTimestampAfterAsOf,
  leakHUnknownInStrict,
  leakL8BankrollCarriedAcrossYears,
} from "@/domain/eval/temporal-023/leakage";
import { actualIndex, marketOnlyProbs, modelCompareRows } from "@/domain/eval/temporal-023/models";
import {
  latestDefinition,
  matchOddsMarketId,
  settlementAfterLock,
  ticksForMarket,
} from "@/domain/eval/temporal-023/parse-mcm";
import type {
  AnnualRow023,
  CanonicalSnapshot023,
  Exp023Config,
  FirstAvailable023,
  InformationSlot023,
  ParsedStream023,
  WindowSnapshot023,
} from "@/domain/eval/temporal-023/types";

export const SOURCE_MIRROR = "betfair-historic-basic-mirror";

export type BlindReplay023 = {
  eventId: string;
  eventName: string;
  kickoff: string;
  marketId: string;
  asOf: string;
  decision: "BET" | "NO_BET";
  reason: string;
  stake: number;
  locked: boolean;
  revealed: boolean;
  entry: { HOME: CanonicalSnapshot023; DRAW: CanonicalSnapshot023; AWAY: CanonicalSnapshot023 };
  triple_complete: boolean;
  settlement_winner: "HOME" | "DRAW" | "AWAY" | "OTHER" | null;
  clv: {
    selection: string;
    entry_price: number | null;
    closing_price: number | null;
    implied_delta: number | null;
    computed_after_lock: true;
    used_in_decision: false;
  };
  assessment: string;
  information: InformationSlot023[];
  windows_home: WindowSnapshot023[];
  coverage: ReturnType<typeof windowCoverage>;
  first_available: FirstAvailable023;
  prematch_ticks: number;
  inplay_ticks: number;
  postmatch_ticks: number;
  unknown_ticks: number;
  models: ReturnType<typeof modelCompareRows>;
};

function runnersBySide(parsed: ParsedStream023, marketId: string): {
  HOME: number | null;
  DRAW: number | null;
  AWAY: number | null;
} {
  const def = parsed.definitions.find((d) => d.marketId === marketId && d.runners.length >= 3);
  const out = { HOME: null as number | null, DRAW: null as number | null, AWAY: null as number | null };
  if (!def) return out;
  for (const r of def.runners) {
    const side = canonicalSelection(r);
    if (side === "HOME" || side === "DRAW" || side === "AWAY") out[side] = r.selectionId;
  }
  return out;
}

function slot(
  key: string,
  available: boolean,
  extra: Partial<InformationSlot023> = {},
): InformationSlot023 {
  return {
    key,
    available,
    availableAt: extra.availableAt ?? null,
    sourceId: extra.sourceId ?? null,
    sourceUrl: extra.sourceUrl ?? null,
    temporalPrecision: extra.temporalPrecision ?? "unknown",
    note: extra.note ?? (available ? "present" : "not in BASIC stream"),
  };
}

export function runBlindLock023(input: {
  cfg: Exp023Config;
  parsed: ParsedStream023;
  decisionWindowSec?: number;
  source?: string;
}): BlindReplay023 {
  assertFrozen023(input.cfg);
  const source = input.source ?? SOURCE_MIRROR;
  const marketId = matchOddsMarketId(input.parsed);
  if (!marketId) {
    throw new Error("MATCH_ODDS market not found");
  }
  const def0 = input.parsed.definitions.find((d) => d.marketId === marketId);
  const kickoff = def0?.marketStartTime;
  const eventId = def0?.eventId;
  const eventName = def0?.eventName ?? "unknown";
  if (!kickoff || !eventId) {
    throw new Error("MATCH_ODDS missing eventId/marketTime");
  }
  const ticks = ticksForMarket(input.parsed, marketId);
  for (const t of ticks) {
    if (t.phase === "PREMATCH") {
      leakHUnknownInStrict({ precision: t.temporalPrecision, phase: t.phase });
    }
  }
  const ids = runnersBySide(input.parsed, marketId);
  const decisionSec = input.decisionWindowSec ?? 3600;
  const asOf = asOfFromKickoff(kickoff, decisionSec);
  const sides = ["HOME", "DRAW", "AWAY"] as const;
  const entry = Object.fromEntries(
    sides.map((side) => {
      const selectionId = ids[side];
      const snap = canonicalSnapshotAt({
        eventId,
        kickoff,
        asOf,
        market: "MATCH_ODDS",
        selection: side,
        ticks,
        selectionId: selectionId ?? undefined,
        source,
      });
      if (snap.timestamp) leakFTimestampAfterAsOf(snap.timestamp, asOf);
      return [side, snap];
    }),
  ) as BlindReplay023["entry"];
  const triple_complete = sides.every((s) => entry[s].status === "OK" && entry[s].price != null);
  leakCCloseBeforeLock({ locked: false, usedClose: false });

  const prematch = ticks.filter((t) => t.phase === "PREMATCH");
  const decision: Record<string, unknown> = {
    eventId,
    marketId,
    asOf: asOf.toISOString(),
    close_in_decision: false,
    uses_repo_form_column: false,
    match_grade: "SELF_CONTAINED",
    entry_home: entry.HOME.price,
    entry_draw: entry.DRAW.price,
    entry_away: entry.AWAY.price,
  };
  assertDecisionPayloadSafe(decision, asOf);

  const assessment = buildTemporal023Assessment({
    eventId,
    asOf,
    eventName,
    prematchTicks: prematch.length,
    tripleComplete: triple_complete,
    homeLtp: entry.HOME.price,
    drawLtp: entry.DRAW.price,
    awayLtp: entry.AWAY.price,
  });

  const sizing = loadExp016Config().sizing;
  const probs = triple_complete
    ? marketOnlyProbs({
        home: entry.HOME.price!,
        draw: entry.DRAW.price!,
        away: entry.AWAY.price!,
      })
    : null;
  const odds = entry.HOME.price ?? 0;
  const alloc = allocateCapital({
    policy: "actuarial_v1",
    bankroll: input.cfg.initial_bankroll,
    p: probs?.[0] ?? 1 / 3,
    odds: odds > 1 ? odds : 1.01,
    signal: signalStrength({
      p: probs?.[0] ?? 1 / 3,
      odds: odds > 1 ? odds : 1.01,
      trainN: 0,
      declaredEdge: input.cfg.declared_edge,
    }),
    sizing,
    openSameEventExposure: 0,
    forceNo: !triple_complete,
  });

  const locked = true;
  assertLockedBeforeReveal(locked);

  const closed = latestDefinition(input.parsed, marketId);
  const settled = settlementAfterLock(closed);
  const homeClose = ids.HOME != null ? lastPrematchClose(ticks, ids.HOME) : null;
  let clvImplied: number | null = null;
  if (entry.HOME.price != null && homeClose) {
    clvImplied = computeClvAfterLock({
      locked: true,
      entryPrice: entry.HOME.price,
      closingPrice: homeClose.price,
    }).impliedDelta;
  }

  const first_available = firstAvailableStats({
    eventId,
    marketId,
    ticks,
  });
  const coverage = windowCoverage({
    kickoff,
    ticks,
    selectionIds: [ids.HOME, ids.DRAW, ids.AWAY].filter((x): x is number => x != null),
  });
  const windows_home =
    ids.HOME != null
      ? windowSnapshotsForSelection({ kickoff, ticks, selectionId: ids.HOME })
      : [];

  const actual = actualIndex(settled.winner);
  const models = modelCompareRows({
    market: triple_complete
      ? {
          home: entry.HOME.price!,
          draw: entry.DRAW.price!,
          away: entry.AWAY.price!,
        }
      : null,
    actual,
    clv: clvImplied,
  });

  const information: InformationSlot023[] = [
    slot("market", triple_complete, {
      availableAt: asOf.toISOString(),
      sourceId: source,
      sourceUrl: "https://historicdata.betfair.com/",
      temporalPrecision: "exact",
      note: "MATCH_ODDS LTP ≤ asOf",
    }),
    slot("team_historical_form", false, { note: "not in BASIC file" }),
    slot("elo", false),
    slot("rest", false),
    slot("schedule", true, {
      availableAt: kickoff,
      sourceId: source,
      temporalPrecision: "exact",
      note: "marketTime kickoff only",
    }),
    slot("injury", false),
    slot("lineup", false),
    slot("weather", false),
    slot("news", false, { note: "CONTEXT_ONLY if present; none in stream" }),
    slot("market_movement_to_asof", prematch.some((t) => t.publishTimeMs <= asOf.getTime()), {
      availableAt: asOf.toISOString(),
      sourceId: source,
      temporalPrecision: "exact",
      note: "PREMATCH ticks ≤ asOf only",
    }),
  ];

  return {
    eventId,
    eventName,
    kickoff,
    marketId,
    asOf: asOf.toISOString(),
    decision: alloc.stake > 0 ? "BET" : "NO_BET",
    reason: alloc.reason,
    stake: alloc.stake,
    locked,
    revealed: true,
    entry,
    triple_complete,
    settlement_winner: settled.winner,
    clv: {
      selection: "HOME",
      entry_price: entry.HOME.price,
      closing_price: homeClose?.price ?? null,
      implied_delta: clvImplied,
      computed_after_lock: true,
      used_in_decision: false,
    },
    assessment: assessment.narrativeSummary,
    information,
    windows_home,
    coverage,
    first_available,
    prematch_ticks: prematch.length,
    inplay_ticks: ticks.filter((t) => t.phase === "INPLAY").length,
    postmatch_ticks: ticks.filter((t) => t.phase === "POSTMATCH").length,
    unknown_ticks: ticks.filter((t) => t.phase === "UNKNOWN").length,
    models,
  };
}

export function buildAnnualRows023(input: {
  cfg: Exp023Config;
  eventsByYear: ReadonlyMap<number, { events: number; strict: number }>;
}): AnnualRow023[] {
  assertFrozen023(input.cfg);
  const years = [...new Set([...input.cfg.solar_years, ...input.eventsByYear.keys()])].sort(
    (a, b) => a - b,
  );
  return years.map((year, i) => {
    leakL8BankrollCarriedAcrossYears({
      yearStart: input.cfg.initial_bankroll,
      previousYearEnd: i > 0 ? input.cfg.initial_bankroll : null,
      initial: input.cfg.initial_bankroll,
    });
    const row = input.eventsByYear.get(year) ?? { events: 0, strict: 0 };
    const insufficient = row.strict < 100;
    return {
      year,
      events: row.events,
      strict_events: row.strict,
      decisions: row.strict > 0 ? row.strict : 0,
      bets: 0,
      no_bet: row.strict,
      start: input.cfg.initial_bankroll,
      end: insufficient ? null : input.cfg.initial_bankroll,
      pnl: insufficient ? null : 0,
      roi: null,
      max_dd: null,
      total_exposure: insufficient ? null : 0,
      clv: null,
      brier: null,
      logloss: null,
      policy: "no_bet",
      status: insufficient ? (row.events === 0 ? "NOT_ACQUIRED" : "INSUFFICIENT_DATA") : "VALID",
    };
  });
}

export function matchOddsLifecycle(input: {
  observed: boolean;
  temporallyValid: boolean;
  sampleSize: number;
}): {
  market: string;
  lifecycle: "CATALOGUED" | "OBSERVED" | "TEMPORALLY_VALID" | "MODEL_READY";
  model_ready: false;
} {
  const gate = evaluateModelReadyGates({
    market: "MATCH_ODDS",
    line: null,
    sampleSize: input.sampleSize,
    dataCompleteness: input.observed ? 1 : 0,
    temporalIntegrity: input.temporallyValid,
    exactPrecisionShare: input.temporallyValid ? 1 : 0,
    bookmakerCoverage: 1,
    outcomeCompleteness: input.observed ? 1 : 0,
    featureAvailability: 0.2,
    calibrationOk: null,
    walkForwardStable: null,
    holdoutPerformanceOk: null,
  });
  const lifecycle =
    gate.status === "MODEL_READY"
      ? "MODEL_READY"
      : input.temporallyValid
        ? "TEMPORALLY_VALID"
        : input.observed
          ? "OBSERVED"
          : "CATALOGUED";
  return { market: "MATCH_ODDS", lifecycle, model_ready: false };
}
