import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import { stage2Decision } from "@/domain/eval/turnaround-025/models";
import { computePolicyStake, type BankrollState, type RiskPolicyId } from "@/domain/risk/bankroll/policies";
import type { Exp028Config, AnnualRow028, Partition028 } from "@/domain/eval/validation-028/types";
import { argmax3 } from "@/domain/eval/validation-028/metrics";
import type { WalkRow028 } from "@/domain/eval/validation-028/walk";
import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";

export type Bet028 = {
  eventId: string;
  year: number;
  partition: Partition028;
  side: 0 | 1 | 2;
  odds: number;
  pModel: number;
  pMarket: number;
  edge: number;
  stake: number;
  pnl: number;
  won: boolean;
  league: string;
  bookmaker: string;
};

function emptyBankroll(): BankrollState {
  return {
    bankroll: 1000,
    peak: 1000,
    drawdown: 0,
    dayExposure: 0,
    matchExposure: 0,
    openClusterExposure: 0,
    masanielloWins: 0,
    masanielloBetsInCycle: 0,
    remainingEventsHint: 0,
  };
}

export function capitalFromWalk(input: {
  rows: readonly WalkRow028[];
  cfg: Exp028Config;
  modelId: string;
  threshold: number;
  partitions: readonly Partition028[];
}): { bets: Bet028[]; annual: AnnualRow028[]; primaryPnl: number[] } {
  const allowed = new Set(input.partitions);
  const byYear = new Map<number, BankrollState>();
  const yearAgg = new Map<
    number,
    { events: number; decisions: number; bets: number; bm: number; bl: number; mm: number; ml: number; nScore: number }
  >();
  const bets: Bet028[] = [];
  const primaryPnl: number[] = [];
  const lastDay = new Map<number, string>();
  const lastCluster = new Map<number, string>();
  let revealed = 0;

  for (const row of input.rows) {
    const y = row.year;
    if (!yearAgg.has(y)) {
      yearAgg.set(y, { events: 0, decisions: 0, bets: 0, bm: 0, bl: 0, mm: 0, ml: 0, nScore: 0 });
      byYear.set(y, emptyBankroll());
    }
    const agg = yearAgg.get(y)!;
    agg.events += 1;
    const p = row.probs[input.modelId] ?? null;
    if (p) {
      agg.bm += brier3(p, row.actual);
      agg.bl += logLoss3(p, row.actual);
      agg.mm += brier3(row.market, row.actual);
      agg.ml += logLoss3(row.market, row.actual);
      agg.nScore += 1;
    }
    const inPart = allowed.has(row.partition);
    if (inPart) agg.decisions += 1;
    if (inPart && p) {
      const stage = stage2Decision({
        capitalEligible: true,
        declaredEdge: true,
        probs: p,
        market: row.market,
        threshold: input.threshold,
        trainN: revealed,
        minTrain: input.cfg.min_train_events,
        calibrationOk: revealed >= input.cfg.min_train_events,
        liquidityOk: true,
        timestampStrict: true,
        evidenceGraph: true,
      });
      if (stage.decision === "BET") {
        const side = argmax3(p);
        const odds =
          side === 0 ? row.event.home_odds : side === 1 ? row.event.draw_odds : row.event.away_odds;
        const st = byYear.get(y)!;
        const day = row.event.kickoff.slice(0, 10);
        const cluster = row.event.kickoff.slice(0, 13);
        if (lastDay.get(y) !== day) {
          st.dayExposure = 0;
          lastDay.set(y, day);
        }
        if (lastCluster.get(y) !== cluster) {
          st.openClusterExposure = 0;
          lastCluster.set(y, cluster);
        }
        st.matchExposure = 0;
        const stakeRes = computePolicyStake({
          policy: input.cfg.primary_risk_policy as RiskPolicyId,
          probability: p[side]!,
          odds,
          edge: p[side]! - row.market[side]!,
          state: st,
          sizing: input.cfg.sizing,
          actuarialMultiplier: 1,
        });
        if (stakeRes.stake > 0) {
          if (st.bankroll - stakeRes.stake < 0) throw new BlindLeakageError("negative bankroll");
          const won = row.actual === side;
          const pnl = won ? stakeRes.stake * (odds - 1) : -stakeRes.stake;
          st.bankroll += pnl;
          if (st.bankroll < 0) throw new BlindLeakageError("negative bankroll");
          st.peak = Math.max(st.peak, st.bankroll);
          st.drawdown = Math.max(st.drawdown, (st.peak - st.bankroll) / Math.max(st.peak, 1e-9));
          st.dayExposure += stakeRes.stake;
          st.matchExposure += stakeRes.stake;
          st.openClusterExposure += stakeRes.stake;
          agg.bets += 1;
          bets.push({
            eventId: row.event.event_id,
            year: y,
            partition: row.partition,
            side,
            odds,
            pModel: p[side]!,
            pMarket: row.market[side]!,
            edge: p[side]! - row.market[side]!,
            stake: stakeRes.stake,
            pnl,
            won,
            league: row.event.competition,
            bookmaker: row.event.bookmaker,
          });
          primaryPnl.push(pnl);
        }
      }
    }
    revealed += 1;
  }

  const annual: AnnualRow028[] = input.cfg.solar_years.map((year) => {
    const agg = yearAgg.get(year);
    const st = byYear.get(year);
    const incomplete = year >= 2026;
    const events = agg?.events ?? 0;
    const betsN = agg?.bets ?? 0;
    const nScore = agg?.nScore ?? 0;
    if (betsN === 0) {
      return {
        year,
        events,
        decisions: agg?.decisions ?? 0,
        bets: 0,
        start: 1000,
        end: null,
        pnl: null,
        roi: null,
        max_dd: null,
        brier_market: nScore ? agg!.mm / nScore : null,
        brier_model: nScore ? agg!.bm / nScore : null,
        logloss_market: nScore ? agg!.ml / nScore : null,
        logloss_model: nScore ? agg!.bl / nScore : null,
        strategy: null,
        status: incomplete ? "INCOMPLETE" : events > 0 ? "NO_BET" : "INSUFFICIENT_DATA",
      };
    }
    return {
      year,
      events,
      decisions: agg!.decisions,
      bets: betsN,
      start: 1000,
      end: st!.bankroll,
      pnl: st!.bankroll - 1000,
      roi: (st!.bankroll - 1000) / 1000,
      max_dd: st!.drawdown,
      brier_market: nScore ? agg!.mm / nScore : null,
      brier_model: nScore ? agg!.bm / nScore : null,
      logloss_market: nScore ? agg!.ml / nScore : null,
      logloss_model: nScore ? agg!.bl / nScore : null,
      strategy: input.cfg.primary_risk_policy,
      status: "VALID",
    };
  });

  return { bets, annual, primaryPnl };
}
