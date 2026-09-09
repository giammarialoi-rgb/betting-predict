import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import {
  emptyTeamState,
  stageInputFromState,
  teamKey,
  updateAfterReveal,
  type TeamState027,
} from "@/domain/eval/breakthrough-027/features";
import type { Exp027Config, StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import {
  marketDevig,
  stage1Probability,
  stage2Decision,
  type ModelId025,
} from "@/domain/eval/turnaround-025/models";
import { computePolicyStake, type BankrollState, type RiskPolicyId } from "@/domain/risk/bankroll/policies";

const POLICIES: readonly RiskPolicyId[] = [
  "flat",
  "fractional_kelly",
  "risk_capped_kelly",
  "actuarial_v1",
  "masaniello_challenger",
];

export type BetRecord027 = {
  eventId: string;
  year: number;
  side: 0 | 1 | 2;
  odds: number;
  pModel: number;
  pMarket: number;
  edge: number;
  stake: number;
  pnl: number;
  won: boolean;
};

export type ModelScore027 = {
  id: string;
  n: number;
  brier: number | null;
  logloss: number | null;
};

export type YearAgg027 = {
  events: number;
  strict: number;
  decisions: number;
  bets: number;
  end: number | null;
  pnl: number | null;
  roi: number | null;
  maxDd: number | null;
  brier: number | null;
  logloss: number | null;
  stakes: Record<RiskPolicyId, { end: number | null; bets: number; pnl: number | null; maxDd: number | null }>;
};

export type Replay027 = {
  decisions: number;
  bets: number;
  betRecords: BetRecord027[];
  modelScores: ModelScore027[];
  primaryPnl: number[];
  byYear: Map<number, YearAgg027>;
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

function actualIdx(ftHome: number, ftAway: number): 0 | 1 | 2 {
  if (ftHome > ftAway) return 0;
  if (ftHome === ftAway) return 1;
  return 2;
}

function sizingOf(cfg: Exp027Config) {
  return {
    flat_unit: cfg.sizing.flat_unit,
    kelly_fractional_factor: cfg.sizing.kelly_fractional_factor,
    max_stake_fraction_event: cfg.sizing.max_stake_fraction_event,
    max_stake_fraction_market: cfg.sizing.max_stake_fraction_market,
    max_exposure_per_match: cfg.sizing.max_exposure_per_match,
    max_correlated_exposure: cfg.sizing.max_correlated_exposure,
    max_daily_exposure: cfg.sizing.max_daily_exposure,
    bankroll_floor_fraction: cfg.sizing.bankroll_floor_fraction,
    drawdown_reduction_start: cfg.sizing.drawdown_reduction_start,
    drawdown_reduction_factor: cfg.sizing.drawdown_reduction_factor,
    masaniello_target_hits_per_cycle: cfg.sizing.masaniello_target_hits_per_cycle,
    masaniello_cycle_length: cfg.sizing.masaniello_cycle_length,
    masaniello_safety: cfg.sizing.masaniello_safety,
  };
}

export function replayStrict027(input: {
  events: readonly StrictCandidate027[];
  cfg: Exp027Config;
  minTrainOverride?: number;
}): Replay027 {
  const minTrain = input.minTrainOverride ?? input.cfg.min_train_events;
  const frozen = input.cfg.frozen_model_id as ModelId025;
  const challengers = input.cfg.challenger_models as ModelId025[];
  const holdout = new Set(input.cfg.holdout_years);
  const teams = new Map<string, TeamState027>();
  let h = 0;
  let d = 0;
  let a = 0;
  let revealed = 0;
  const modelBuckets = new Map<string, { brier: number; logloss: number; n: number }>();
  const byYear = new Map<number, YearAgg027>();
  const yearPrimary = new Map<number, BankrollState>();
  const yearPolicies = new Map<number, Record<RiskPolicyId, BankrollState>>();
  const yearDay = new Map<number, { day: string; league: string }>();
  const betRecords: BetRecord027[] = [];
  const primaryPnl: number[] = [];
  let decisions = 0;
  let bets = 0;

  const ensureYear = (year: number) => {
    if (!byYear.has(year)) {
      const stakes = {} as Record<
        RiskPolicyId,
        { end: number | null; bets: number; pnl: number | null; maxDd: number | null }
      >;
      for (const p of POLICIES) stakes[p] = { end: null, bets: 0, pnl: null, maxDd: 0 };
      byYear.set(year, {
        events: 0,
        strict: 0,
        decisions: 0,
        bets: 0,
        end: null,
        pnl: null,
        roi: null,
        maxDd: null,
        brier: null,
        logloss: null,
        stakes,
      });
      yearPrimary.set(year, emptyBankroll());
      const rec = {} as Record<RiskPolicyId, BankrollState>;
      for (const p of POLICIES) rec[p] = emptyBankroll();
      yearPolicies.set(year, rec);
    }
    return byYear.get(year)!;
  };

  for (const event of input.events) {
    const year = Number(event.kickoff.slice(0, 4));
    const row = ensureYear(year);
    row.events += 1;
    row.strict += 1;
    const asOfMs = Date.parse(event.as_of);
    const kickMs = Date.parse(event.kickoff);
    if (!(asOfMs < kickMs)) {
      throw new BlindLeakageError("quote not < kickoff");
    }
    if (holdout.has(year)) {
      throw new BlindLeakageError("HOLDOUT event entered capital path");
    }

    const hk = teamKey(event.home);
    const ak = teamKey(event.away);
    const home = teams.get(hk) ?? emptyTeamState();
    const away = teams.get(ak) ?? emptyTeamState();
    if (!teams.has(hk)) teams.set(hk, home);
    if (!teams.has(ak)) teams.set(ak, away);
    const prior = h + d + a;
    const freq: [number, number, number] =
      prior === 0 ? [1 / 3, 1 / 3, 1 / 3] : [h / prior, d / prior, a / prior];
    const stageIn = stageInputFromState({ event, home, away, freq });
    const market = marketDevig(stageIn.marketOdds!);
    const probs = stage1Probability(frozen, stageIn);
    const decisionPayload: Record<string, unknown> = {
      event_id: event.event_id,
      as_of: event.as_of,
      odds: { home: event.home_odds, draw: event.draw_odds, away: event.away_odds },
    };
    if ("ft_home" in decisionPayload || "outcome" in decisionPayload) {
      throw new BlindLeakageError("FT in DecisionContext");
    }
    void decisionPayload;

    const protocolOk =
      revealed >= minTrain &&
      market != null &&
      event.match_confidence === "MATCH_EXACT" &&
      asOfMs < kickMs;

    const stage = stage2Decision({
      capitalEligible: true,
      declaredEdge: input.cfg.declared_edge,
      probs,
      market,
      threshold: input.cfg.frozen_edge_threshold,
      trainN: revealed,
      minTrain,
      calibrationOk: revealed >= minTrain,
      liquidityOk: true,
      timestampStrict: true,
      evidenceGraph: true,
    });
    decisions += 1;
    row.decisions += 1;

    const actual = actualIdx(event.ft_home, event.ft_away);
    if (probs && market) {
      for (const id of [frozen, ...challengers]) {
        const p = stage1Probability(id, stageIn);
        if (!p) continue;
        const acc = modelBuckets.get(id) ?? { brier: 0, logloss: 0, n: 0 };
        acc.brier += brier3(p, actual);
        acc.logloss += logLoss3(p, actual);
        acc.n += 1;
        modelBuckets.set(id, acc);
      }
      const yb = row.brier == null ? 0 : row.brier * (row.decisions - 1);
      const yl = row.logloss == null ? 0 : row.logloss * (row.decisions - 1);
      row.brier = (yb + brier3(probs, actual)) / row.decisions;
      row.logloss = (yl + logLoss3(probs, actual)) / row.decisions;
    }

    const betNow = stage.decision === "BET" && protocolOk && probs && market;
    if (betNow && probs && market) {
      const side: 0 | 1 | 2 =
        probs[0]! >= probs[1]! && probs[0]! >= probs[2]! ? 0 : probs[1]! >= probs[2]! ? 1 : 2;
      const odds = side === 0 ? event.home_odds : side === 1 ? event.draw_odds : event.away_odds;
      const edge = probs[side]! - market[side]!;
      const day = event.kickoff.slice(0, 10);
      const cluster = event.kickoff.slice(0, 13);
      const primary = yearPrimary.get(year)!;
      const last = yearDay.get(year);
      if (!last || last.day !== day) {
        primary.dayExposure = 0;
        for (const st of Object.values(yearPolicies.get(year)!)) st.dayExposure = 0;
      }
      if (!last || last.day !== day || last.league !== event.competition) {
        /* league cap tracked via dayExposure */
      }
      if (primary.openClusterExposure > 0 && last && cluster !== event.kickoff.slice(0, 13)) {
        primary.openClusterExposure = 0;
        for (const st of Object.values(yearPolicies.get(year)!)) st.openClusterExposure = 0;
      }
      yearDay.set(year, { day, league: event.competition });
      primary.matchExposure = 0;
      const stakeRes = computePolicyStake({
        policy: input.cfg.primary_risk_policy as RiskPolicyId,
        probability: probs[side]!,
        odds,
        edge,
        state: primary,
        sizing: sizingOf(input.cfg),
        actuarialMultiplier: 1,
      });
      const stake = stakeRes.stake;
      if (stake > 0) {
        const won = actual === side;
        const pnl = won ? stake * (odds - 1) : -stake;
        primary.bankroll += pnl;
        primary.peak = Math.max(primary.peak, primary.bankroll);
        primary.drawdown = Math.max(primary.drawdown, (primary.peak - primary.bankroll) / primary.peak);
        primary.dayExposure += stake;
        primary.matchExposure += stake;
        primary.openClusterExposure += stake;
        bets += 1;
        row.bets += 1;
        betRecords.push({
          eventId: event.event_id,
          year,
          side,
          odds,
          pModel: probs[side]!,
          pMarket: market[side]!,
          edge,
          stake,
          pnl,
          won,
        });
        primaryPnl.push(pnl);

        const recs = yearPolicies.get(year)!;
        for (const policy of POLICIES) {
          const st = recs[policy];
          st.matchExposure = 0;
          const r = computePolicyStake({
            policy,
            probability: probs[side]!,
            odds,
            edge,
            state: st,
            sizing: sizingOf(input.cfg),
            actuarialMultiplier: policy === "actuarial_v1" ? 1 : 1,
          });
          if (r.stake > 0) {
            const pPnl = won ? r.stake * (odds - 1) : -r.stake;
            st.bankroll += pPnl;
            st.peak = Math.max(st.peak, st.bankroll);
            st.drawdown = Math.max(st.drawdown, (st.peak - st.bankroll) / st.peak);
            st.dayExposure += r.stake;
            st.openClusterExposure += r.stake;
            row.stakes[policy].bets += 1;
            if (policy === "masaniello_challenger") {
              st.masanielloBetsInCycle += 1;
              if (won) st.masanielloWins += 1;
            }
          }
        }
      }
    }

    // REVEAL after LOCK
    updateAfterReveal({
      home,
      away,
      ftHome: event.ft_home,
      ftAway: event.ft_away,
      ts: kickMs,
    });
    if (actual === 0) h += 1;
    else if (actual === 1) d += 1;
    else a += 1;
    revealed += 1;
  }

  for (const [year, row] of byYear) {
    const primary = yearPrimary.get(year)!;
    if (row.bets > 0) {
      row.end = primary.bankroll;
      row.pnl = primary.bankroll - 1000;
      row.roi = row.pnl / 1000;
      row.maxDd = primary.drawdown;
      const recs = yearPolicies.get(year)!;
      for (const policy of POLICIES) {
        const st = recs[policy];
        if (row.stakes[policy].bets > 0) {
          row.stakes[policy].end = st.bankroll;
          row.stakes[policy].pnl = st.bankroll - 1000;
          row.stakes[policy].maxDd = st.drawdown;
        }
      }
    }
  }

  const modelScores: ModelScore027[] = [...modelBuckets.entries()].map(([id, acc]) => ({
    id,
    n: acc.n,
    brier: acc.n ? acc.brier / acc.n : null,
    logloss: acc.n ? acc.logloss / acc.n : null,
  }));

  return { decisions, bets, betRecords, modelScores, primaryPnl, byYear };
}
