import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { parseMcmNdjson } from "@/domain/eval/temporal-023/parse-mcm";
import { splitCsvLine } from "@/domain/eval/turnaround-025/kaggle-betfair";
import {
  BASIC_FIXTURE_REL,
  BASIC_SAMPLE_REL,
  OU_FIXTURE_REL,
  WEEKLY_CSV_REL,
  WEEKLY_FIXTURE_REL,
} from "@/domain/eval/market-033/config";
import { classifyMarketFamily, coverageFromSeconds } from "@/domain/eval/market-033/markets";
import type { BasicMarket033, MarketRow033, WindowId033 } from "@/domain/eval/market-033/types";
import { MARKET_ROWS_033 } from "@/domain/eval/market-033/types";

export type WeeklyFamilyCount033 = {
  family: MarketRow033;
  rows: number;
  events: number;
  pre_off_naive: number;
  in_play: number;
};

function loadNdjson(rel: string): string | null {
  const p = join(process.cwd(), rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function discoverBasicMarkets033(skipHeavy: boolean): BasicMarket033[] {
  const texts: string[] = [];
  if (!skipHeavy) {
    const full = loadNdjson(BASIC_SAMPLE_REL);
    if (full) texts.push(full);
  }
  const fixture = loadNdjson(skipHeavy ? BASIC_FIXTURE_REL : BASIC_FIXTURE_REL);
  const ou = loadNdjson(OU_FIXTURE_REL);
  if (skipHeavy) {
    if (fixture) texts.push(fixture);
    if (ou) texts.push(ou);
  } else if (texts.length === 0) {
    if (fixture) texts.push(fixture);
    if (ou) texts.push(ou);
  }
  const byMarket = new Map<string, BasicMarket033>();
  for (const text of texts) {
    const parsed = parseMcmNdjson(text);
    for (const md of parsed.definitions) {
      if (!md.marketId) continue;
      const fam =
        classifyMarketFamily(md.marketType) ??
        classifyMarketFamily(md.eventName);
      const ticks = parsed.ticks.filter((t) => t.marketId === md.marketId && t.phase === "PREMATCH");
      const secs = ticks
        .map((t) => t.secondsToKickoff)
        .filter((s): s is number => s != null && s > 0);
      const last = ticks.at(-1);
      const existing = byMarket.get(md.marketId);
      const row: BasicMarket033 = {
        market_id: md.marketId,
        market_type: md.marketType ?? "UNKNOWN",
        family: (fam ?? classifyMarketFamily(md.marketType) ?? "Exchange") as MarketRow033,
        event_id: md.eventId ?? "unknown",
        event_name: md.eventName,
        kickoff: md.marketStartTime,
        timezone: md.timezone,
        prematch_ticks: ticks.length,
        last_prematch_pt: last?.publishTimeIso ?? null,
        last_prematch_ltp: last?.lastPriceTraded ?? null,
        windows: coverageFromSeconds(secs),
        capital_eligible: false,
      };
      if (!existing || row.prematch_ticks > existing.prematch_ticks) byMarket.set(md.marketId, row);
    }
  }
  return [...byMarket.values()].sort((a, b) => a.market_id.localeCompare(b.market_id));
}

export function emptyWeeklyCounts(): WeeklyFamilyCount033[] {
  return MARKET_ROWS_033.map((family) => ({
    family,
    rows: 0,
    events: 0,
    pre_off_naive: 0,
    in_play: 0,
  }));
}

function parseNaive(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const dm = /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (dm) {
    return Date.UTC(
      Number(dm[3]),
      Number(dm[2]) - 1,
      Number(dm[1]),
      Number(dm[4]),
      Number(dm[5]),
      Number(dm[6] ?? 0),
    );
  }
  const y = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (y) {
    return Date.UTC(
      Number(y[1]),
      Number(y[2]) - 1,
      Number(y[3]),
      Number(y[4]),
      Number(y[5]),
      Number(y[6] ?? 0),
    );
  }
  return null;
}

export async function scanWeeklyBetfair033(skipHeavy: boolean): Promise<{
  path: string | null;
  rows: number;
  football_rows: number;
  families: WeeklyFamilyCount033[];
  timezone_in_file: false;
  temporal_class: "UNKNOWN";
}> {
  const rel = skipHeavy ? WEEKLY_FIXTURE_REL : existsSync(join(process.cwd(), WEEKLY_CSV_REL)) ? WEEKLY_CSV_REL : WEEKLY_FIXTURE_REL;
  const abs = join(process.cwd(), rel);
  if (!existsSync(abs)) {
    return {
      path: null,
      rows: 0,
      football_rows: 0,
      families: emptyWeeklyCounts(),
      timezone_in_file: false,
      temporal_class: "UNKNOWN",
    };
  }
  const agg = new Map<MarketRow033, { rows: number; events: Set<string>; pre: number; ip: number }>();
  for (const f of MARKET_ROWS_033) agg.set(f, { rows: 0, events: new Set(), pre: 0, ip: 0 });
  let rows = 0;
  let football = 0;
  let header: string[] | null = null;
  const rl = createInterface({ input: createReadStream(abs, { encoding: "utf8" }) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = splitCsvLine(line);
      continue;
    }
    rows += 1;
    const p = splitCsvLine(line);
    const idx = (n: string) => header!.indexOf(n);
    const sports = p[idx("SPORTS_ID")] ?? "";
    const eventId = p[idx("EVENT_ID")] ?? "";
    const event = p[idx("EVENT")] ?? "";
    const inPlay = (p[idx("IN_PLAY")] ?? "").toUpperCase();
    const first = p[idx("FIRST_TAKEN")] ?? "";
    const sched = p[idx("SCHEDULED_OFF")] ?? "";
    if (sports !== "1") continue;
    football += 1;
    const family = classifyMarketFamily(event);
    if (!family) continue;
    const a = agg.get(family)!;
    a.rows += 1;
    a.events.add(eventId);
    if (inPlay === "IP") a.ip += 1;
    const ft = parseNaive(first);
    const so = parseNaive(sched);
    if (ft != null && so != null && ft < so) a.pre += 1;
  }
  return {
    path: rel.replaceAll("\\", "/"),
    rows,
    football_rows: football,
    families: MARKET_ROWS_033.map((family) => {
      const a = agg.get(family)!;
      return {
        family,
        rows: a.rows,
        events: a.events.size,
        pre_off_naive: a.pre,
        in_play: a.ip,
      };
    }),
    timezone_in_file: false,
    temporal_class: "UNKNOWN",
  };
}

export function unionWindowCoverage(rows: readonly BasicMarket033[]): Record<WindowId033, boolean> {
  const out = {} as Record<WindowId033, boolean>;
  for (const id of ["72h", "48h", "24h", "12h", "6h", "3h", "1h", "30m", "15m", "5m", "1m"] as WindowId033[]) {
    out[id] = rows.some((r) => r.windows[id]);
  }
  return out;
}
