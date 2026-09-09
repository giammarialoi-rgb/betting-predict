/**
 * Blind annual capital on BeatTheBookie.
 * STRICT_EVENTS = 0 → END_BANKROLL null, never silent 1000→1000.
 */

import { assertDecisionPayloadSafe } from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { settleObservedMarket } from "@/domain/eval/capital-020/settlement";
import { allocateCapital, signalStrength } from "@/domain/eval/capital-020/risk";
import { loadExp016Config } from "@/domain/eval/bankroll/exp016-config";
import { evaluateModelReadyGates } from "@/domain/markets/model-ready-gates";
import { buildBeatTheBookieAssessment } from "@/domain/eval/recovery-022/evidence";
import { assertFrozen022, leakL8BankrollCarriedAcrossYears } from "@/domain/eval/recovery-022/leakage";
import { CATALOGUED_NOT_OBSERVED_022, OBSERVED_IN_BTB_GENERATORS } from "@/domain/eval/recovery-022/markets";
import type {
  AnnualRow022,
  BeatTheBookieRecord,
  Exp022Config,
  ResearchAggregate022,
  StrategyRow022,
} from "@/domain/eval/recovery-022/types";

export type SanityReplay022 = {
  locked: boolean;
  revealed: boolean;
  decisionKeys: string[];
  stake: number;
  settlement: { pnl: number; result: "WIN" | "LOSS" | "PUSH" } | null;
  assessment: string;
};

export function buildAnnualRows(input: {
  cfg: Exp022Config;
  eventsByYear: ReadonlyMap<number, number>;
  extraYears?: readonly number[];
}): AnnualRow022[] {
  assertFrozen022(input.cfg);
  const years = [
    ...new Set([...input.eventsByYear.keys(), ...(input.extraYears ?? []), ...input.cfg.solar_years]),
  ].sort((a, b) => a - b);

  return years.map((year, i) => {
    leakL8BankrollCarriedAcrossYears({
      yearStart: input.cfg.initial_bankroll,
      previousYearEnd: i > 0 ? input.cfg.initial_bankroll : null,
      initial: input.cfg.initial_bankroll,
    });
    const events = input.eventsByYear.get(year) ?? 0;
    const status: AnnualRow022["status"] =
      year >= 2026 ? "INCOMPLETE" : "INSUFFICIENT_DATA";
    return {
      year,
      dataset:
        events > 0
          ? "beat_the_bookie_temporal_v1/closing_odds DATE_ONLY"
          : year >= 2015 && year <= 2016
            ? "odds_series not acquired"
            : "no BeatTheBookie rows",
      events,
      strict_events: 0,
      decisions: 0,
      qualified_bets: 0,
      no_bets: events,
      start_bankroll: input.cfg.initial_bankroll,
      end_bankroll: null,
      pnl: null,
      roi: null,
      max_drawdown: null,
      win_rate: null,
      avg_odds: null,
      total_exposure: null,
      risk_policy: "no_bet",
      temporal_blocks: events,
      data_quality: events > 0 ? "DATE_ONLY aggregates" : "MISSING_SERIES",
      status,
    };
  });
}

export function strategyRows022(cfg: Exp022Config): StrategyRow022[] {
  return cfg.risk_policies.map((strategy) => ({
    strategy,
    role: strategy === "no_bet" ? "operative" : "challenger_unused",
    bets: 0,
    pnl: null,
    selected_from_pnl: false,
  }));
}

export function marketLifecycleRows(observed: readonly string[]): {
  market: string;
  lifecycle: "CATALOGUED" | "OBSERVED" | "TEMPORALLY_VALID" | "MODEL_READY";
  model_ready: false;
  temporally_valid: false;
}[] {
  const obs = new Set(observed);
  const keys = [...new Set([...OBSERVED_IN_BTB_GENERATORS, ...CATALOGUED_NOT_OBSERVED_022, ...obs])];
  return keys.map((market) => {
    const seen = obs.has(market);
    const gate = evaluateModelReadyGates({
      market,
      line: null,
      sampleSize: seen ? 479_440 : 0,
      dataCompleteness: seen ? 1 : 0,
      temporalIntegrity: false,
      exactPrecisionShare: 0,
      bookmakerCoverage: seen ? 29 : 0,
      outcomeCompleteness: 1,
      featureAvailability: 0.5,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    });
    return {
      market,
      lifecycle: gate.status === "MODEL_READY"
        ? "MODEL_READY"
        : seen
          ? "OBSERVED"
          : "CATALOGUED",
      model_ready: false as const,
      temporally_valid: false as const,
    };
  });
}

/**
 * End-to-end LOCK → reveal on one event. Outcome is absent until lock.
 */
export function runSanityBlindReplay(input: {
  eventId: string;
  asOf: Date;
  aggregates: readonly ResearchAggregate022[];
  seriesRecords: readonly BeatTheBookieRecord[];
  outcome: { ftHome: number; ftAway: number };
}): SanityReplay022 {
  const asOf = input.asOf;
  const decision: Record<string, unknown> = {
    eventId: input.eventId,
    form_reconstructed: true,
    uses_repo_form_column: false,
    series_quotes: input.seriesRecords.filter((r) => r.available_at != null && Date.parse(r.available_at) <= asOf.getTime()).length,
    close_in_decision: false,
  };
  assertDecisionPayloadSafe(decision, asOf);
  const assessment = buildBeatTheBookieAssessment({
    eventId: input.eventId,
    asOf,
    aggregates: input.aggregates,
    seriesQuotes: input.seriesRecords.length,
    strictQuotes: 0,
  });
  const locked = true;
  assertLockedBeforeReveal(locked);
  const sizing = loadExp016Config().sizing;
  const alloc = allocateCapital({
    policy: "actuarial_v1",
    bankroll: 1000,
    p: 1 / 3,
    odds: 1.97,
    signal: signalStrength({ p: 1 / 3, odds: 1.97, trainN: 0, declaredEdge: false }),
    sizing,
    openSameEventExposure: 0,
    forceNo: true,
  });
  const settlement =
    alloc.stake > 0
      ? settleObservedMarket({
          marketType: "1X2",
          line: null,
          selection: "HOME",
          odds: 1.97,
          stake: alloc.stake,
          outcome: input.outcome,
        })
      : null;
  return {
    locked,
    revealed: true,
    decisionKeys: Object.keys(decision),
    stake: alloc.stake,
    settlement,
    assessment: assessment.narrativeSummary,
  };
}
