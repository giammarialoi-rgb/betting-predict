/**
 * Blind capital runner: filter asOf → decide → LOCK → reveal → settle.
 */

import {
  assertDecisionPayloadSafe,
  assertExpandingWindowTrain,
  assertNoRetroactiveOptimization,
} from "@/domain/eval/actuarial-018/integrity";
import { loadExp016Config } from "@/domain/eval/bankroll/exp016-config";
import { mergeUniqueEvents } from "@/domain/eval/acquisition-019/replay";
import type { NormalizedEvent } from "@/domain/eval/acquisition-019/types";
import { assertHoldoutUntouched } from "@/domain/eval/capital-020/config";
import { buildCapital020Assessment } from "@/domain/eval/capital-020/evidence";
import { bookmakerConsensus } from "@/domain/eval/capital-020/consensus";
import { marketPath } from "@/domain/eval/capital-020/movement";
import { brier3, logLoss3, runModel020 } from "@/domain/eval/capital-020/models";
import { allocateCapital, signalStrength } from "@/domain/eval/capital-020/risk";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { snapshotEligibleForStrictCapital } from "@/domain/eval/capital-020/temporal-gate";
import type {
  AnnualCapitalRow,
  DecisionRecord020,
  ErrorClass020,
  Exp020Config,
  MarketSnapshot,
  ModelCompareRow,
} from "@/domain/eval/capital-020/types";

function reconstructForm(
  history: Map<string, Array<{ ts: number; pts: number }>>,
  team: string,
  beforeTs: number,
): { pts: number; sample: number } {
  const prior = (history.get(team) ?? []).filter((h) => h.ts < beforeTs).slice(-n5);
  return {
    pts: prior.reduce((s, h) => s + h.pts, 0),
    sample: prior.length,
  };
}
const n5 = 5;

export function runBlindCapital020(input: {
  cfg: Exp020Config;
  events: readonly NormalizedEvent[];
  clubIndex: readonly NormalizedEvent[];
  snapshots: readonly MarketSnapshot[];
}): {
  annual: AnnualCapitalRow[];
  decisions: DecisionRecord020[];
  modelRows: ModelCompareRow[];
  errorFreq: Record<ErrorClass020, number>;
  bets: number;
  noBet: number;
  sampleNarrative: string | null;
  holdoutTouched: false;
} {
  assertNoRetroactiveOptimization({
    retroactive_optimization: false,
    parameters_frozen: true,
  });
  assertHoldoutUntouched({
    holdoutYears: input.cfg.holdout_years,
    usedHoldoutForSelection: false,
  });

  const sizing = loadExp016Config().sizing;
  const snapsByEvent = new Map<string, MarketSnapshot[]>();
  for (const s of input.snapshots) {
    const arr = snapsByEvent.get(s.eventId) ?? [];
    arr.push(s);
    snapsByEvent.set(s.eventId, arr);
  }

  const bookEvents = mergeUniqueEvents(input.events).filter(
    (e) => e.year >= 2001 && e.year <= 2026,
  );
  const clubByYear = new Map<number, number>();
  for (const e of input.clubIndex) {
    if (e.year >= 2001 && e.year <= 2026) {
      clubByYear.set(e.year, (clubByYear.get(e.year) ?? 0) + 1);
    }
  }

  type Acc = {
    valid: number;
    decisions: number;
    bets: number;
    wins: number;
    losses: number;
    pushes: number;
    bankroll: number;
    peak: number;
    lowest: number;
    maxDd: number;
    maxDdAbs: number;
    turnover: number;
    expSum: number;
    expMax: number;
    brierM: number;
    brierF: number;
    llM: number;
    llF: number;
    scored: number;
  };
  const acc = new Map<number, Acc>();
  for (const y of input.cfg.solar_years) {
    acc.set(y, {
      valid: 0,
      decisions: 0,
      bets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      bankroll: input.cfg.initial_bankroll,
      peak: input.cfg.initial_bankroll,
      lowest: input.cfg.initial_bankroll,
      maxDd: 0,
      maxDdAbs: 0,
      turnover: 0,
      expSum: 0,
      expMax: 0,
      brierM: 0,
      brierF: 0,
      llM: 0,
      llF: 0,
      scored: 0,
    });
  }

  const hist = new Map<string, Array<{ ts: number; pts: number }>>();
  let lastTrain = -1;
  let th = 0;
  let td = 0;
  let ta = 0;
  let trainN = 0;
  const decisionSample: DecisionRecord020[] = [];
  let sampleNarrative: string | null = null;
  const totalBets = 0;
  let totalNoBet = 0;
  const errorFreq: Record<ErrorClass020, number> = {
    MODEL_ERROR: 0,
    DATA_ERROR: 0,
    TEMPORAL_ERROR: 0,
    MARKET_ERROR: 0,
    CALIBRATION_ERROR: 0,
    CORRELATION_ERROR: 0,
    SOURCE_CONFLICT: 0,
    INSUFFICIENT_INFORMATION: 0,
  };

  for (const ev of bookEvents) {
    const ts = Date.parse(`${ev.matchDate}T00:00:00.000Z`);
    if (lastTrain >= 0) assertExpandingWindowTrain(lastTrain, ts);
    const yearAcc = acc.get(ev.year);
    if (yearAcc) {
      const asOf = new Date(`${ev.matchDate}T00:00:00.000Z`);
      assertDecisionPayloadSafe(
        {
          eventId: ev.canonicalEventId,
          form_reconstructed: true,
          uses_repo_form_column: false,
        },
        asOf,
      );
      const snaps = snapsByEvent.get(ev.canonicalEventId) ?? [];
      const strict = snaps.filter((s) => snapshotEligibleForStrictCapital(s, asOf));
      const dateOpen = snaps.filter(
        (s) => s.temporalClass === "DATE_ONLY" && s.observationKind === "open",
      );
      if (dateOpen.length > 0 || strict.length > 0) yearAcc.valid += 1;
      const hf = reconstructForm(hist, ev.homeSlug, ts);
      const af = reconstructForm(hist, ev.awaySlug, ts);
      const n = th + td + ta;
      const freq: [number, number, number] =
        n === 0 ? [1 / 3, 1 / 3, 1 / 3] : [th / n, td / n, ta / n];
      const p = runModel020("frequency", {
        freq,
        formHome: hf.pts,
        formAway: af.pts,
        formSample: Math.min(hf.sample, af.sample),
        marketHome: null,
        eloDiff: null,
      })!;

      bookmakerConsensus(snaps, asOf, "STRICT");
      marketPath(snaps, asOf, false);

      yearAcc.decisions += 1;
      const forceNo = strict.length === 0 || !input.cfg.declared_edge;
      const odds = strict[0]?.odds ?? null;
      const sig = signalStrength({
        p: p[0]!,
        odds: odds ?? 2,
        trainN,
        declaredEdge: input.cfg.declared_edge,
      });
      const alloc = allocateCapital({
        policy: "actuarial_v1",
        bankroll: yearAcc.bankroll,
        p: p[0]!,
        odds: odds ?? 2,
        signal: sig,
        sizing,
        openSameEventExposure: 0,
        forceNo,
      });

      if (alloc.stake > 0 && odds != null && ev.result && ev.ftHome != null && ev.ftAway != null) {
        throw new Error("unreachable: STRICT capital bets require exact quotes + declared edge");
      } else {
        totalNoBet += 1;
        errorFreq.TEMPORAL_ERROR += strict.length === 0 ? 1 : 0;
        errorFreq.INSUFFICIENT_INFORMATION += 1;
        if (decisionSample.length < 80) {
          const evd = buildCapital020Assessment({
            eventId: ev.canonicalEventId,
            asOf,
            formHome: hf.pts,
            formAway: af.pts,
            formSample: Math.min(hf.sample, af.sample),
            dateOpenBooks: new Set(dateOpen.map((s) => s.bookmaker)).size,
            strictQuotes: strict.length,
          });
          decisionSample.push({
            eventId: ev.canonicalEventId,
            year: ev.year,
            market: "1X2",
            decision: "NO_BET",
            reason: strict.length === 0 ? "NO_BET_TEMPORAL" : "NO_BET_MODEL",
            probability: null,
            odds,
            edge: null,
            supporting: evd.evidenceGraph.supporting.length,
            contradicting: evd.evidenceGraph.contradicting.length,
            contextual: evd.evidenceGraph.contextual.length,
            sourceId: ev.sourceId,
            locked: true,
            outcome_in_decision: false,
            evidence: evd.attributions.map((a) => ({
              source: a.sourceId,
              title: a.claim.slice(0, 80),
              url: a.sourceUrl,
              published_at: a.publishedAt,
              available_at: a.availableAt,
              claim: a.claim,
              polarity: a.polarity,
            })),
          });
          if (sampleNarrative == null && ev.year === 2019) {
            sampleNarrative = evd.narrativeSummary;
          }
        }
      }

      if (ev.result && ev.ftHome != null && ev.ftAway != null) {
        assertLockedBeforeReveal(true);
        const idx = ev.result === "HOME" ? 0 : ev.result === "DRAW" ? 1 : 2;
        const homeOdds = dateOpen.find((s) => s.selection === "HOME")?.odds;
        if (homeOdds && homeOdds > 1) {
          const mp = 1 / homeOdds;
          const rest = (1 - Math.min(0.99, mp)) / 2;
          const marketP: [number, number, number] = [mp, rest, rest];
          yearAcc.brierM += brier3(marketP, idx);
          yearAcc.llM += logLoss3(marketP, idx);
        }
        yearAcc.brierF += brier3(p, idx);
        yearAcc.llF += logLoss3(p, idx);
        yearAcc.scored += 1;
      }
    }

    if (ev.result && ev.ftHome != null && ev.ftAway != null) {
      const homePts = ev.result === "HOME" ? 3 : ev.result === "DRAW" ? 1 : 0;
      const awayPts = ev.result === "AWAY" ? 3 : ev.result === "DRAW" ? 1 : 0;
      const hh = hist.get(ev.homeSlug) ?? [];
      hh.push({ ts, pts: homePts });
      hist.set(ev.homeSlug, hh);
      const ah = hist.get(ev.awaySlug) ?? [];
      ah.push({ ts, pts: awayPts });
      hist.set(ev.awaySlug, ah);
      if (ev.result === "HOME") th += 1;
      else if (ev.result === "DRAW") td += 1;
      else ta += 1;
      trainN += 1;
      lastTrain = ts;
    }
  }

  const annual: AnnualCapitalRow[] = input.cfg.solar_years.map((year) => {
    const a = acc.get(year)!;
    const index = clubByYear.get(year) ?? 0;
    const incomplete = year >= 2026;
    const noStrict = a.bets === 0;
    return {
      year,
      data_status: incomplete ? "INCOMPLETE" : noStrict ? "INSUFFICIENT_DATA" : "OK",
      insufficient_reason: noStrict
        ? `No STRICT exact available_at quotes; DATE_ONLY OPEN is research-only; club_index_events=${index}`
        : null,
      valid_data: a.valid || a.decisions,
      decisions: a.decisions,
      bets: a.bets,
      wins: a.wins,
      losses: a.losses,
      pushes: a.pushes,
      start: input.cfg.initial_bankroll,
      final: noStrict ? null : a.bankroll,
      pnl: noStrict ? null : a.bankroll - input.cfg.initial_bankroll,
      roi: noStrict || a.turnover === 0 ? null : (a.bankroll - input.cfg.initial_bankroll) / a.turnover,
      max_dd: noStrict ? null : a.maxDd,
      max_dd_absolute: noStrict ? null : a.maxDdAbs,
      peak: noStrict ? null : a.peak,
      lowest: noStrict ? null : a.lowest,
      turnover: a.turnover,
      average_exposure: a.decisions ? a.expSum / a.decisions : null,
      maximum_exposure: a.expMax || null,
      model: input.cfg.frozen_model_id,
    };
  });

  const scoredYears = [...acc.entries()].filter(([, a]) => a.scored >= 30);
  const modelRows: ModelCompareRow[] = scoredYears.map(([year, a]) => ({
    period: String(year),
    market: "1X2",
    n: a.scored,
    market_brier: a.brierM / a.scored,
    model_brier: a.brierF / a.scored,
    market_logloss: a.llM / a.scored,
    model_logloss: a.llF / a.scored,
    calibration: "untested",
    significant: false,
    used_for_capital: false,
    note: "RESEARCH date-precision market implied vs frozen frequency — not STRICT capital",
  }));

  return {
    annual,
    decisions: decisionSample,
    modelRows,
    errorFreq,
    bets: totalBets,
    noBet: totalNoBet,
    sampleNarrative,
    holdoutTouched: false,
  };
}
