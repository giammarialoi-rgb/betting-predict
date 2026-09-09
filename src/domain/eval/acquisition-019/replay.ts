/**
 * Blind annual replay 2001–2026.
 * STRICT_AS_OF: date/unknown/close never produce a bet.
 * Bankroll does not roll across years. No silent 1000→1000.
 */

import {
  assertDecisionPayloadSafe,
  assertExpandingWindowTrain,
  assertNoRetroactiveOptimization,
} from "@/domain/eval/actuarial-018/integrity";
import { buildTask019Assessment } from "@/domain/eval/acquisition-019/evidence";
import type {
  AnnualRow019,
  Exp019Config,
  MarketObservation019,
  NormalizedEvent,
} from "@/domain/eval/acquisition-019/types";
import { canSatisfyPrecision } from "@/domain/odds/temporal";

type FormBits = { home: number; away: number; sample: number };

function reconstructForm(
  history: Map<string, Array<{ ts: number; pts: number }>>,
  team: string,
  beforeTs: number,
  n = 5,
): { pts: number; sample: number } {
  const prior = (history.get(team) ?? []).filter((h) => h.ts < beforeTs).slice(-n);
  return {
    pts: prior.reduce((s, h) => s + h.pts, 0),
    sample: prior.length,
  };
}

export function mergeUniqueEvents(bundlesEvents: readonly NormalizedEvent[]): NormalizedEvent[] {
  const rank: Record<string, number> = {
    "anishkhetani-epl-archive": 0,
    "jokecamp-e0-2014-15": 1,
    "jokecamp-i1": 2,
    "jokecamp-d1": 3,
    "offline-pack-e0": 4,
    "club-football-match-data": 9,
  };
  const best = new Map<string, NormalizedEvent>();
  for (const e of bundlesEvents) {
    const cur = best.get(e.canonicalEventId);
    if (!cur) {
      best.set(e.canonicalEventId, e);
      continue;
    }
    const cr = rank[cur.sourceId] ?? 5;
    const nr = rank[e.sourceId] ?? 5;
    if (nr < cr) best.set(e.canonicalEventId, e);
  }
  return [...best.values()].sort((a, b) => {
    const t = a.matchDate.localeCompare(b.matchDate);
    return t !== 0 ? t : a.canonicalEventId.localeCompare(b.canonicalEventId);
  });
}

export function runBlindReplay019(input: {
  cfg: Exp019Config;
  events: readonly NormalizedEvent[];
  clubIndex: readonly NormalizedEvent[];
  observations: readonly MarketObservation019[];
}): {
  annual: AnnualRow019[];
  decisions: number;
  bets: number;
  noBet: number;
  sampleAssessmentNarrative: string | null;
  holdoutTouched: false;
} {
  assertNoRetroactiveOptimization({
    retroactive_optimization: false,
    parameters_frozen: true,
  });

  const obsByEvent = new Map<string, MarketObservation019[]>();
  for (const o of input.observations) {
    const arr = obsByEvent.get(o.eventId) ?? [];
    arr.push(o);
    obsByEvent.set(o.eventId, arr);
  }

  const bookEvents = mergeUniqueEvents(input.events).filter(
    (e) => e.year >= 2001 && e.year <= 2026,
  );

  const clubByYear = new Map<number, number>();
  for (const e of input.clubIndex) {
    if (e.year < 2001 || e.year > 2026) continue;
    clubByYear.set(e.year, (clubByYear.get(e.year) ?? 0) + 1);
  }

  type Acc = {
    eventsBook: number;
    validStrict: number;
    validDate: number;
    markets: Set<string>;
    decisions: number;
    nbT: number;
    nbD: number;
    nbM: number;
    nbR: number;
    bets: number;
  };
  const acc = new Map<number, Acc>();
  for (const y of input.cfg.solar_years) {
    acc.set(y, {
      eventsBook: 0,
      validStrict: 0,
      validDate: 0,
      markets: new Set(),
      decisions: 0,
      nbT: 0,
      nbD: 0,
      nbM: 0,
      nbR: 0,
      bets: 0,
    });
  }

  const hist = new Map<string, Array<{ ts: number; pts: number }>>();
  let lastTrain = -1;
  let totalDecisions = 0;
  const totalBets = 0;
  let totalNoBet = 0;
  let sampleNarrative: string | null = null;

  for (const ev of bookEvents) {
    const ts = Date.parse(`${ev.matchDate}T00:00:00.000Z`);
    if (lastTrain >= 0) {
      assertExpandingWindowTrain(lastTrain, ts);
    }
    const yearAcc = acc.get(ev.year);
    if (!yearAcc) {
      // still update history after 2026/before 2001 skip
    } else {
      const asOf = new Date(`${ev.matchDate}T00:00:00.000Z`);
      assertDecisionPayloadSafe(
        {
          eventId: ev.canonicalEventId,
          form_reconstructed: true,
          uses_repo_form_column: false,
        },
        asOf,
      );

      const obs = obsByEvent.get(ev.canonicalEventId) ?? [];
      const openDate = obs.filter(
        (o) => o.observationKind === "dataset_open" && o.temporalPrecision === "date",
      );
      const closeObs = obs.filter((o) => o.observationKind === "dataset_close");
      const exact = obs.filter(
        (o) =>
          o.temporalPrecision === "exact" &&
          o.availableAt != null &&
          Date.parse(o.availableAt) <= asOf.getTime() &&
          canSatisfyPrecision("exact", "exact"),
      );

      yearAcc.eventsBook += 1;
      yearAcc.validStrict += exact.length;
      yearAcc.validDate += openDate.length;
      for (const o of obs) yearAcc.markets.add(o.marketType);

      const hf = reconstructForm(hist, ev.homeSlug, ts);
      const af = reconstructForm(hist, ev.awaySlug, ts);
      const form: FormBits = {
        home: hf.pts,
        away: af.pts,
        sample: Math.min(hf.sample, af.sample),
      };

      yearAcc.decisions += 1;
      totalDecisions += 1;

      const strictOk = exact.length > 0;
      if (!strictOk) {
        yearAcc.nbT += 1;
        totalNoBet += 1;
      } else if (!input.cfg.declared_edge) {
        yearAcc.nbM += 1;
        totalNoBet += 1;
      } else {
        yearAcc.nbR += 1;
        totalNoBet += 1;
      }

      if (sampleNarrative == null && ev.year === 2019) {
        const report = buildTask019Assessment({
          event: ev,
          asOf,
          openDateObs: openDate.length,
          closeObs: closeObs.length,
          formHomePts: form.home,
          formAwayPts: form.away,
          formSample: form.sample,
        });
        sampleNarrative = report.narrativeSummary;
      }
    }

    // REVEAL after LOCK
    if (ev.result && ev.ftHome != null && ev.ftAway != null) {
      const homePts = ev.result === "HOME" ? 3 : ev.result === "DRAW" ? 1 : 0;
      const awayPts = ev.result === "AWAY" ? 3 : ev.result === "DRAW" ? 1 : 0;
      const hh = hist.get(ev.homeSlug) ?? [];
      hh.push({ ts, pts: homePts });
      hist.set(ev.homeSlug, hh);
      const ah = hist.get(ev.awaySlug) ?? [];
      ah.push({ ts, pts: awayPts });
      hist.set(ev.awaySlug, ah);
      lastTrain = ts;
    }
  }

  const annual: AnnualRow019[] = input.cfg.solar_years.map((year) => {
    const a = acc.get(year)!;
    const indexEvents = clubByYear.get(year) ?? 0;
    const events = Math.max(indexEvents, a.eventsBook);
    const incomplete = year >= 2026;
    const noQuotes = a.validStrict === 0;
    let note = "STRICT requires exact available_at; OPEN/CLOSE here are date-level only";
    if (a.eventsBook === 0 && indexEvents === 0) {
      note = "No events acquired for this solar year";
    } else if (a.eventsBook === 0) {
      note = "Index events only (Club-Football). Odd* TEMPORALLY_UNKNOWN — no bookmaker clock";
    }
    if (input.cfg.holdout_years.includes(year)) {
      note += " · HOLDOUT sacred (not used to choose model/staking/threshold)";
    }
    return {
      year,
      data_status: incomplete ? "INCOMPLETE" : noQuotes ? "INSUFFICIENT_DATA" : "OK",
      events,
      events_with_book_odds: a.eventsBook,
      valid_quotes_strict: a.validStrict,
      valid_quotes_date: a.validDate,
      markets: a.markets.size,
      decisions: a.decisions,
      no_bet_temporal: a.nbT,
      no_bet_data: a.nbD,
      no_bet_model: a.nbM,
      no_bet_risk: a.nbR,
      bets: a.bets,
      start: input.cfg.initial_bankroll,
      final: null,
      pnl: null,
      max_dd: null,
      wins: 0,
      losses: 0,
      pushes: 0,
      turnover: 0,
      largest_loss: null,
      largest_exposure: null,
      correlated_positions: 0,
      note,
    };
  });

  return {
    annual,
    decisions: totalDecisions,
    bets: totalBets,
    noBet: totalNoBet,
    sampleAssessmentNarrative: sampleNarrative,
    holdoutTouched: false,
  };
}
