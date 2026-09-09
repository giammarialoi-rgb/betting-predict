/**
 * Betfair Historic MCM NDJSON parser (BASIC and richer plans).
 * BASIC empirically: lastPriceTraded only; batb/atb/atl absent.
 */

import {
  canonicalSelection,
  classifyPhase,
  secondsToKickoff,
  temporalPrecisionForPt,
} from "@/domain/eval/temporal-023/classify";
import type {
  MarketDefinition023,
  ParsedStream023,
  PriceTick023,
  RunnerState023,
} from "@/domain/eval/temporal-023/types";

type RawRunner = {
  id?: number;
  name?: string;
  status?: string;
  sortPriority?: number;
};

type RawMd = {
  eventId?: string;
  eventName?: string;
  marketType?: string;
  marketTime?: string;
  openDate?: string;
  timezone?: string;
  countryCode?: string;
  status?: string;
  inPlay?: boolean;
  settledTime?: string;
  runners?: RawRunner[];
};

type RawRc = {
  id?: number;
  ltp?: number;
  tv?: number;
  batb?: unknown;
  atb?: unknown;
  atl?: unknown;
};

type RawMc = {
  id?: string;
  marketDefinition?: RawMd;
  rc?: RawRc[];
};

type RawLine = {
  op?: string;
  pt?: number;
  mc?: RawMc[];
};

type MarketState = {
  eventId: string | null;
  eventName: string | null;
  marketType: string | null;
  marketStartTime: string | null;
  openDate: string | null;
  timezone: string | null;
  countryCode: string | null;
  status: string | null;
  inPlay: boolean | null;
  settledTime: string | null;
  runners: Map<number, RunnerState023>;
};

function asRunners(raw: RawRunner[] | undefined): RunnerState023[] {
  if (!raw) return [];
  return raw
    .filter((r) => r.id != null)
    .map((r) => ({
      selectionId: r.id!,
      selectionName: r.name ?? String(r.id),
      status: r.status ?? "UNKNOWN",
      sortPriority: r.sortPriority ?? null,
    }));
}

function ladderLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

export function parseMcmNdjson(text: string): ParsedStream023 {
  return parseMcmLines(text.split(/\r?\n/));
}

export function parseMcmLines(lines: readonly string[]): ParsedStream023 {
  const state = new Map<string, MarketState>();
  const definitions: MarketDefinition023[] = [];
  const ticks: PriceTick023[] = [];
  const marketIds = new Set<string>();
  const eventIds = new Set<string>();
  const marketTypes = new Set<string>();
  let parseFail = 0;
  let lineCount = 0;
  let batbCount = 0;
  let atbCount = 0;
  let atlCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    lineCount += 1;
    let row: RawLine;
    try {
      row = JSON.parse(line) as RawLine;
    } catch {
      parseFail += 1;
      continue;
    }
    const pt = row.pt;
    if (!Number.isFinite(pt) || pt == null || pt <= 0) {
      parseFail += 1;
      continue;
    }
    for (const mc of row.mc ?? []) {
      if (!mc.id) continue;
      marketIds.add(mc.id);
      const prev = state.get(mc.id) ?? {
        eventId: null,
        eventName: null,
        marketType: null,
        marketStartTime: null,
        openDate: null,
        timezone: null,
        countryCode: null,
        status: null,
        inPlay: null,
        settledTime: null,
        runners: new Map<number, RunnerState023>(),
      };
      if (mc.marketDefinition) {
        const md = mc.marketDefinition;
        const runners = asRunners(md.runners);
        prev.eventId = md.eventId ?? prev.eventId;
        prev.eventName = md.eventName ?? prev.eventName;
        prev.marketType = md.marketType ?? prev.marketType;
        prev.marketStartTime = md.marketTime ?? prev.marketStartTime;
        prev.openDate = md.openDate ?? prev.openDate;
        prev.timezone = md.timezone ?? prev.timezone;
        prev.countryCode = md.countryCode ?? prev.countryCode;
        prev.status = md.status ?? prev.status;
        prev.inPlay = md.inPlay ?? prev.inPlay;
        prev.settledTime = md.settledTime ?? prev.settledTime;
        for (const r of runners) prev.runners.set(r.selectionId, r);
        state.set(mc.id, prev);
        if (prev.eventId) eventIds.add(prev.eventId);
        if (prev.marketType) marketTypes.add(prev.marketType);
        definitions.push({
          marketId: mc.id,
          eventId: prev.eventId,
          eventName: prev.eventName,
          marketType: prev.marketType,
          marketStartTime: prev.marketStartTime,
          openDate: prev.openDate,
          timezone: prev.timezone,
          countryCode: prev.countryCode,
          status: prev.status,
          inPlay: prev.inPlay,
          settledTime: prev.settledTime,
          runners,
          publishTimeMs: pt,
        });
      } else {
        state.set(mc.id, prev);
      }
      if (!Array.isArray(mc.rc)) continue;
      for (const rc of mc.rc) {
        batbCount += ladderLen(rc.batb);
        atbCount += ladderLen(rc.atb);
        atlCount += ladderLen(rc.atl);
        if (rc.id == null || rc.ltp == null || !(rc.ltp > 1)) continue;
        const runner = prev.runners.get(rc.id);
        const selectionName = runner?.selectionName ?? String(rc.id);
        const phase = classifyPhase({
          publishTimeMs: pt,
          marketStartTimeIso: prev.marketStartTime,
          status: prev.status,
        });
        ticks.push({
          marketId: mc.id,
          eventId: prev.eventId,
          eventName: prev.eventName,
          marketType: prev.marketType,
          marketStartTime: prev.marketStartTime,
          publishTimeMs: pt,
          publishTimeIso: new Date(pt).toISOString(),
          selectionId: rc.id,
          selectionName,
          lastPriceTraded: rc.ltp,
          availableToBack: null,
          availableToLay: null,
          tradedVolume: typeof rc.tv === "number" ? rc.tv : null,
          ladderDepth: ladderLen(rc.batb) || ladderLen(rc.atb) || null,
          status: prev.status,
          inPlay: prev.inPlay,
          phase,
          secondsToKickoff: secondsToKickoff(prev.marketStartTime, pt),
          temporalPrecision: temporalPrecisionForPt(pt),
        });
      }
    }
  }

  return {
    lines: lineCount,
    parseFail,
    definitions,
    ticks,
    marketIds: [...marketIds],
    eventIds: [...eventIds],
    marketTypes: [...marketTypes],
    batbCount,
    atbCount,
    atlCount,
  };
}

export function matchOddsMarketId(parsed: ParsedStream023): string | null {
  const md = parsed.definitions.find((d) => d.marketType === "MATCH_ODDS");
  return md?.marketId ?? null;
}

export function ticksForMarket(
  parsed: ParsedStream023,
  marketId: string,
): PriceTick023[] {
  return parsed.ticks.filter((t) => t.marketId === marketId);
}

export function latestDefinition(
  parsed: ParsedStream023,
  marketId: string,
): MarketDefinition023 | null {
  const rows = parsed.definitions.filter((d) => d.marketId === marketId);
  return rows.at(-1) ?? null;
}

export function settlementAfterLock(def: MarketDefinition023 | null): {
  winner: "HOME" | "DRAW" | "AWAY" | "OTHER" | null;
  runners: RunnerState023[];
} {
  if (!def || def.status !== "CLOSED") {
    return { winner: null, runners: def?.runners ?? [] };
  }
  const win = def.runners.find((r) => r.status === "WINNER");
  if (!win) return { winner: null, runners: def.runners };
  return {
    winner: canonicalSelection(win),
    runners: def.runners,
  };
}
