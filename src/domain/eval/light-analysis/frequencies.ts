/**
 * Empirical frequency helpers for analisi light.
 * Only counts rows the caller already loaded. Never invents a match or a %.
 */
import {
  LIGHT_INSUFFICIENT_IT,
  LIGHT_MIN_N,
  LIGHT_MIN_N_SOFT,
  type HistoricalMatchRow,
  type LightEstimateStatus,
  type LightMarketEstimate,
} from "@/domain/eval/light-analysis/types";
import { lightNamesMatch } from "@/domain/eval/light-analysis/aliases";

export type RateEstimate = {
  probability: number | null;
  n: number;
  status: LightEstimateStatus;
};

export function rateFromFlags(flags: readonly boolean[], minN = LIGHT_MIN_N): RateEstimate {
  const n = flags.length;
  if (n < minN) {
    return { probability: null, n, status: "INSUFFICIENT" };
  }
  const hits = flags.reduce((acc, f) => acc + (f ? 1 : 0), 0);
  return { probability: hits / n, n, status: "OK" };
}

export function overRate(totals: readonly number[], line: number, minN = LIGHT_MIN_N): RateEstimate {
  return rateFromFlags(
    totals.filter((x) => Number.isFinite(x)).map((x) => x > line),
    minN,
  );
}

export function teamOverRate(goals: readonly number[], line: number, minN = LIGHT_MIN_N): RateEstimate {
  return overRate(goals, line, minN);
}

export function bttsRate(
  pairs: readonly { home: number; away: number }[],
  minN = LIGHT_MIN_N,
): RateEstimate {
  return rateFromFlags(
    pairs
      .filter((p) => Number.isFinite(p.home) && Number.isFinite(p.away))
      .map((p) => p.home > 0 && p.away > 0),
    minN,
  );
}

export type SideResult = "H" | "D" | "A";

export function resultFromGoals(homeGoals: number, awayGoals: number): SideResult {
  if (homeGoals > awayGoals) return "H";
  if (homeGoals < awayGoals) return "A";
  return "D";
}

/**
 * Blend home-team home W/D/L with away-team away W/D/L.
 * Both sides need minN. One side with minN is enough for a partial (that side only).
 */
export function empirical1x2(
  homeHomeResults: readonly SideResult[],
  awayAwayResults: readonly SideResult[],
  minN = LIGHT_MIN_N,
): { home: RateEstimate; draw: RateEstimate; away: RateEstimate } {
  const homeOk = homeHomeResults.length >= minN;
  const awayOk = awayAwayResults.length >= minN;
  if (!homeOk && !awayOk) {
    const n = homeHomeResults.length + awayAwayResults.length;
    const empty: RateEstimate = { probability: null, n, status: "INSUFFICIENT" };
    return { home: empty, draw: { ...empty }, away: { ...empty } };
  }

  const fromHome = (r: SideResult) => ({
    h: r === "H" ? 1 : 0,
    d: r === "D" ? 1 : 0,
    a: r === "A" ? 1 : 0,
  });
  const fromAway = (r: SideResult) => ({
    h: r === "A" ? 1 : 0,
    d: r === "D" ? 1 : 0,
    a: r === "H" ? 1 : 0,
  });

  let h = 0;
  let d = 0;
  let a = 0;
  let n = 0;
  if (homeOk) {
    for (const r of homeHomeResults) {
      const x = fromHome(r);
      h += x.h;
      d += x.d;
      a += x.a;
      n += 1;
    }
  }
  if (awayOk) {
    for (const r of awayAwayResults) {
      const x = fromAway(r);
      h += x.h;
      d += x.d;
      a += x.a;
      n += 1;
    }
  }
  const denom = Math.max(1, n);
  return {
    home: { probability: h / denom, n, status: "OK" },
    draw: { probability: d / denom, n, status: "OK" },
    away: { probability: a / denom, n, status: "OK" },
  };
}

export function cornersLean(
  rows: readonly { home: number; away: number }[],
  minN = LIGHT_MIN_N,
): {
  home_more: RateEstimate;
  away_more: RateEstimate;
  over_9_5: RateEstimate;
} {
  const valid = rows.filter((r) => Number.isFinite(r.home) && Number.isFinite(r.away));
  return {
    home_more: rateFromFlags(
      valid.map((r) => r.home > r.away),
      minN,
    ),
    away_more: rateFromFlags(
      valid.map((r) => r.away > r.home),
      minN,
    ),
    over_9_5: rateFromFlags(
      valid.map((r) => r.home + r.away > 9.5),
      minN,
    ),
  };
}

export function matchBeforeCutoff(rowDate: string, cutoffDay: string): boolean {
  return Boolean(rowDate && cutoffDay && rowDate < cutoffDay);
}

export function cutoffDayFromKickoff(kickoffIso: string | null | undefined): string {
  if (!kickoffIso) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  const m = String(kickoffIso).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1]!;
  const t = Date.parse(kickoffIso);
  if (!Number.isFinite(t)) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  return new Date(t).toISOString().slice(0, 10);
}

export function splitPriors(
  rows: readonly HistoricalMatchRow[],
  home: string,
  away: string,
  cutoffDay: string,
): {
  homeHome: HistoricalMatchRow[];
  awayAway: HistoricalMatchRow[];
  any: HistoricalMatchRow[];
} {
  const homeHome: HistoricalMatchRow[] = [];
  const awayAway: HistoricalMatchRow[] = [];
  const any: HistoricalMatchRow[] = [];
  for (const row of rows) {
    if (!matchBeforeCutoff(row.date, cutoffDay)) continue;
    const homeIsHome = lightNamesMatch(row.home, home);
    const awayIsAway = lightNamesMatch(row.away, away);
    const involvesHome = homeIsHome || lightNamesMatch(row.away, home);
    const involvesAway = awayIsAway || lightNamesMatch(row.home, away);
    if (involvesHome || involvesAway) any.push(row);
    if (homeIsHome) homeHome.push(row);
    if (awayIsAway) awayAway.push(row);
  }
  return { homeHome, awayAway, any };
}

function estimate(
  market: string,
  line: number | null,
  selection: string,
  label_it: string,
  rate: RateEstimate,
  source_ids: string[],
): LightMarketEstimate {
  const ok = rate.status === "OK" && rate.probability != null;
  return {
    market,
    line,
    selection,
    label_it,
    probability: ok ? rate.probability : null,
    n: rate.n,
    status: ok ? "OK" : "INSUFFICIENT",
    insufficient_it: ok ? null : LIGHT_INSUFFICIENT_IT,
    source_ids: [...new Set(source_ids)],
    method: "empirical_frequency",
    enters_strong_model: false,
  };
}

export function buildLightMarkets(input: {
  homeHome: readonly HistoricalMatchRow[];
  awayAway: readonly HistoricalMatchRow[];
  source_ids: string[];
  minN?: number;
}): LightMarketEstimate[] {
  const minN = input.minN ?? LIGHT_MIN_N;
  const src = input.source_ids;
  const out: LightMarketEstimate[] = [];

  const homeResults: SideResult[] = [];
  const awayResults: SideResult[] = [];
  const homeTotals: number[] = [];
  const awayTotals: number[] = [];
  const homePairs: { home: number; away: number }[] = [];
  const awayPairs: { home: number; away: number }[] = [];
  const homeGoals: number[] = [];
  const awayGoals: number[] = [];
  const cornerRows: { home: number; away: number }[] = [];

  for (const row of input.homeHome) {
    if (row.home_goals == null || row.away_goals == null) continue;
    if (!Number.isFinite(row.home_goals) || !Number.isFinite(row.away_goals)) continue;
    homeResults.push(resultFromGoals(row.home_goals, row.away_goals));
    homeTotals.push(row.home_goals + row.away_goals);
    homePairs.push({ home: row.home_goals, away: row.away_goals });
    homeGoals.push(row.home_goals);
    if (row.home_corners != null && row.away_corners != null) {
      cornerRows.push({ home: row.home_corners, away: row.away_corners });
    }
  }
  for (const row of input.awayAway) {
    if (row.home_goals == null || row.away_goals == null) continue;
    if (!Number.isFinite(row.home_goals) || !Number.isFinite(row.away_goals)) continue;
    awayResults.push(resultFromGoals(row.home_goals, row.away_goals));
    awayTotals.push(row.home_goals + row.away_goals);
    awayPairs.push({ home: row.home_goals, away: row.away_goals });
    awayGoals.push(row.away_goals);
    if (row.home_corners != null && row.away_corners != null) {
      cornerRows.push({ home: row.home_corners, away: row.away_corners });
    }
  }

  const oneXTwo = empirical1x2(homeResults, awayResults, minN);
  out.push(estimate("1x2", null, "HOME", "1 (casa)", oneXTwo.home, src));
  out.push(estimate("1x2", null, "DRAW", "X (pareggio)", oneXTwo.draw, src));
  out.push(estimate("1x2", null, "AWAY", "2 (trasferta)", oneXTwo.away, src));

  const totals = [...homeTotals, ...awayTotals];
  const pairMin = totals.length >= minN ? LIGHT_MIN_N_SOFT : minN;
  for (const line of [1.5, 2.5, 3.5] as const) {
    const rate = overRate(totals, line, pairMin);
    out.push(estimate("over_under", line, "OVER", `Over ${line}`, rate, src));
    const under: RateEstimate =
      rate.status === "OK" && rate.probability != null
        ? { probability: 1 - rate.probability, n: rate.n, status: "OK" }
        : { probability: null, n: rate.n, status: "INSUFFICIENT" };
    out.push(estimate("over_under", line, "UNDER", `Under ${line}`, under, src));
  }

  const pairs = [...homePairs, ...awayPairs];
  const btts = bttsRate(pairs, pairMin);
  out.push(estimate("btts", null, "YES", "BTTS sì", btts, src));
  const bttsNo: RateEstimate =
    btts.status === "OK" && btts.probability != null
      ? { probability: 1 - btts.probability, n: btts.n, status: "OK" }
      : { probability: null, n: btts.n, status: "INSUFFICIENT" };
  out.push(estimate("btts", null, "NO", "BTTS no", bttsNo, src));

  out.push(
    estimate("team_goals", 1.5, "HOME_OVER", "Casa over 1.5 gol", teamOverRate(homeGoals, 1.5, minN), src),
  );
  out.push(
    estimate("team_goals", 1.5, "AWAY_OVER", "Ospiti over 1.5 gol", teamOverRate(awayGoals, 1.5, minN), src),
  );

  const corners = cornersLean(cornerRows, LIGHT_MIN_N_SOFT);
  out.push(
    estimate("corners", null, "HOME_MORE", "Casa più calci d’angolo", corners.home_more, src),
  );
  out.push(
    estimate("corners", null, "AWAY_MORE", "Ospiti più calci d’angolo", corners.away_more, src),
  );
  out.push(estimate("corners", 9.5, "OVER", "Over 9.5 calci d’angolo", corners.over_9_5, src));

  return out;
}
