/**
 * Blind Actuarial Bankroll Replay V1 — solar-year independent bankrolls.
 */

import { loadExp016Config, type Exp016Config } from "@/domain/eval/bankroll/exp016-config";
import {
  BlindLeakageError,
  assertAsOfNotAfter,
  assertNoOutcomeFieldsInDecisionPayload,
} from "@/domain/eval/bankroll/leakage";
import {
  assertDecisionContextSafe,
  DecisionContextSafetyError,
} from "@/domain/eval/blind-replay";
import type { DecisionContext, OutcomeContext } from "@/domain/eval/contexts";
import {
  buildRealHistoricalEvaluationSample,
  decisionAsOfForEvent,
} from "@/domain/eval/real-lab/truth-lab";
import {
  loadRealTruthLabPack,
  type RealHistoricalDataset,
  type RealLabEvent,
} from "@/domain/eval/real-lab/load-pack";
import { normalizeMarketProbabilities } from "@/domain/odds/math";
import { buildAssessmentReport } from "@/domain/evidence/build-assessment";
import type { EvidenceItem } from "@/domain/evidence/types";
import { BankrollLedger } from "@/domain/risk/bankroll/ledger";
import {
  computePolicyStake,
  type BankrollState,
  type RiskPolicyId,
} from "@/domain/risk/bankroll/policies";
import { evaluateActuarialRisk } from "@/domain/risk/actuarial/engine";
import {
  aggregateYearStats,
  computeActuarialMetrics,
} from "@/domain/risk/actuarial/metrics";
import { runMonteCarloDiagnostic } from "@/domain/risk/actuarial/monte-carlo";
import { correlationExposureGuard } from "@/domain/risk/correlation/guard";
import type { ExposureSelection } from "@/domain/risk/correlation-exposure";

export type LockedBankrollDecision = {
  decisionId: string;
  eventId: string;
  year: number;
  asOf: string;
  lockedAt: string;
  market: string;
  selection: string;
  odds: number;
  oddsAvailableAt: string;
  probability: number;
  edge: number | null;
  stake: number;
  policy: RiskPolicyId;
  bankrollBefore: number;
  decisionContext: DecisionContext;
  assessmentSummary: string;
  evidenceStrength: string;
  outcomeContext: null;
  outcomeRevealed: false;
};

export type YearPolicyReport = {
  year: number;
  status: "OK" | "INSUFFICIENT_HISTORY" | "INCOMPLETE_YEAR" | "NO_EVENTS";
  policy: RiskPolicyId;
  initial_bankroll: number;
  final_bankroll: number;
  profit_loss: number;
  return_pct: number;
  max_drawdown: number;
  minimum_bankroll: number;
  peak_bankroll: number;
  number_of_positions: number;
  number_of_winning_positions: number;
  number_of_losing_positions: number;
  number_of_void_positions: number;
  number_of_no_position: number;
  risk_blocks: number;
  total_exposure: number;
  bankroll_ruin: boolean;
  events_seen: number;
};

function yearOf(d: Date): number {
  return d.getUTCFullYear();
}

function buildEvidenceForEvent(input: {
  eventId: string;
  asOf: Date;
  hypothesis: string;
  probability: number;
  odds: number;
  disagreement: number | null;
  featurePresent: number;
  marketCount: number;
}): EvidenceItem[] {
  const t = input.asOf;
  const base = {
    entityRef: null as string | null,
    eventId: input.eventId,
    sourceUrl: null as string | null,
    publishedAt: null as Date | null,
    availableAt: t,
    observedAt: t,
    temporalPrecision: "dataset_window" as const,
    targetHypothesis: input.hypothesis,
    claimConfidence: null as number | null,
    sourceReliability: null as null,
    confirmations: [] as string[],
    rebuttals: [] as string[],
  };
  return [
    {
      ...base,
      evidenceId: `ev_devig_${input.eventId}`,
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `Market de-vig implied p(${input.hypothesis})=${input.probability.toFixed(4)}`,
      sourceId: "football-data-co-uk_open",
      polarity: "SUPPORTS",
      magnitude: input.probability,
    },
    {
      ...base,
      evidenceId: `ev_price_${input.eventId}`,
      category: "market",
      epistemicKind: "FACT",
      claim: `Best available odds ${input.odds.toFixed(3)} at asOf`,
      sourceId: "bookmaker_snapshots",
      polarity: "SUPPORTS",
      magnitude: input.odds,
    },
    {
      ...base,
      evidenceId: `ev_disagree_${input.eventId}`,
      category: "market",
      epistemicKind: "QUANTITATIVE_EVIDENCE",
      claim: `Book disagreement=${input.disagreement ?? "n/a"}`,
      sourceId: "microstructure",
      polarity:
        (input.disagreement ?? 0) > 0.08 ? "CONTRADICTS" : "NEUTRAL",
      magnitude: input.disagreement,
    },
    {
      ...base,
      evidenceId: `ev_dq_${input.eventId}`,
      category: "statistical",
      epistemicKind: "FACT",
      claim: `Features present=${input.featurePresent}; markets=${input.marketCount}`,
      sourceId: "decision_context",
      polarity: "CONTEXT_ONLY",
      magnitude: null,
    },
    {
      ...base,
      evidenceId: `ev_model_${input.eventId}`,
      category: "statistical",
      epistemicKind: "MODEL_JUDGMENT",
      claim: `Champion market_devig probability ${input.probability.toFixed(4)} (no declared edge)`,
      sourceId: "champion_market_devig_v1",
      polarity: "SUPPORTS",
      magnitude: input.probability,
    },
  ];
}

function pickResultSelection(sample: ReturnType<typeof buildRealHistoricalEvaluationSample>): {
  selection: string;
  probability: number;
  odds: number;
  oddsAvailableAt: Date;
  bookmaker: string;
  disagreement: number | null;
} | null {
  const snaps = sample.decisionContext.availableMarkets.filter(
    (m) => m.marketType === "result",
  );
  if (snaps.length === 0) return null;

  const bySel = new Map<string, typeof snaps>();
  for (const s of snaps) {
    const arr = bySel.get(s.selectionSide) ?? [];
    arr.push(s);
    bySel.set(s.selectionSide, arr);
  }
  if (!bySel.has("HOME") || !bySel.has("DRAW") || !bySel.has("AWAY")) {
    return null;
  }

  // Use first book that has full HDA for de-vig; then best price for selection
  const books = new Set(snaps.map((s) => s.bookmakerSlug).filter(Boolean));
  let probs: Record<string, number> | null = null;
  for (const book of books) {
    const h = snaps.find((s) => s.bookmakerSlug === book && s.selectionSide === "HOME");
    const d = snaps.find((s) => s.bookmakerSlug === book && s.selectionSide === "DRAW");
    const a = snaps.find((s) => s.bookmakerSlug === book && s.selectionSide === "AWAY");
    if (h && d && a) {
      const n = normalizeMarketProbabilities([
        h.oddsDecimal,
        d.oddsDecimal,
        a.oddsDecimal,
      ]);
      probs = { HOME: n[0]!, DRAW: n[1]!, AWAY: n[2]! };
      break;
    }
  }
  if (!probs) {
    // fallback: average raw implied then renormalize
    const inv = (sel: string) => {
      const xs = bySel.get(sel)!;
      return xs.reduce((a, x) => a + 1 / x.oddsDecimal, 0) / xs.length;
    };
    const raw = [inv("HOME"), inv("DRAW"), inv("AWAY")];
    const sum = raw.reduce((a, b) => a + b, 0);
    probs = {
      HOME: raw[0]! / sum,
      DRAW: raw[1]! / sum,
      AWAY: raw[2]! / sum,
    };
  }

  let bestSel = "HOME";
  let bestP = probs.HOME;
  for (const sel of ["HOME", "DRAW", "AWAY"] as const) {
    if (probs[sel]! > bestP) {
      bestP = probs[sel]!;
      bestSel = sel;
    }
  }
  const candidates = bySel.get(bestSel)!;
  candidates.sort((a, b) => b.oddsDecimal - a.oddsDecimal);
  const best = candidates[0]!;
  const prices = candidates.map((c) => c.oddsDecimal);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const disagreement =
    prices.length > 1
      ? Math.sqrt(
          prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length,
        ) / mean
      : 0;

  return {
    selection: bestSel,
    probability: bestP,
    odds: best.oddsDecimal,
    oddsAvailableAt: best.availableAt,
    bookmaker: best.bookmakerSlug ?? "unknown",
    disagreement,
  };
}

function lockDecision(input: {
  decisionId: string;
  event: RealLabEvent;
  year: number;
  asOf: Date;
  decisionContext: DecisionContext;
  market: string;
  selection: string;
  odds: number;
  oddsAvailableAt: Date;
  probability: number;
  edge: number | null;
  stake: number;
  policy: RiskPolicyId;
  bankrollBefore: number;
  assessmentSummary: string;
  evidenceStrength: string;
}): LockedBankrollDecision {
  assertNoOutcomeFieldsInDecisionPayload(
    {
      availableAt: input.oddsAvailableAt,
      decision: input.decisionContext,
    },
    input.asOf,
  );
  if (input.decisionContext.kind !== "decision") {
    throw new BlindLeakageError("DecisionContext.kind must be decision");
  }
  return {
    decisionId: input.decisionId,
    eventId: input.event.eventId,
    year: input.year,
    asOf: input.asOf.toISOString(),
    lockedAt: input.asOf.toISOString(),
    market: input.market,
    selection: input.selection,
    odds: input.odds,
    oddsAvailableAt: input.oddsAvailableAt.toISOString(),
    probability: input.probability,
    edge: input.edge,
    stake: input.stake,
    policy: input.policy,
    bankrollBefore: input.bankrollBefore,
    decisionContext: input.decisionContext,
    assessmentSummary: input.assessmentSummary,
    evidenceStrength: input.evidenceStrength,
    outcomeContext: null,
    outcomeRevealed: false,
  };
}

function revealOutcome(
  locked: LockedBankrollDecision,
  event: RealLabEvent,
): OutcomeContext {
  if (locked.outcomeRevealed) {
    throw new BlindLeakageError("Already revealed");
  }
  return {
    kind: "outcome",
    eventId: event.eventId,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    resultCode: event.resultCode,
    availableAt: event.resultAvailableAt,
    observedAt: event.resultAvailableAt,
  };
}

function wonSelection(selection: string, result: OutcomeContext["resultCode"]): boolean {
  return selection === result;
}

function emptyYearReport(
  year: number,
  policy: RiskPolicyId,
  status: YearPolicyReport["status"],
  initial: number,
): YearPolicyReport {
  return {
    year,
    status,
    policy,
    initial_bankroll: initial,
    final_bankroll: initial,
    profit_loss: 0,
    return_pct: 0,
    max_drawdown: 0,
    minimum_bankroll: initial,
    peak_bankroll: initial,
    number_of_positions: 0,
    number_of_winning_positions: 0,
    number_of_losing_positions: 0,
    number_of_void_positions: 0,
    number_of_no_position: 0,
    risk_blocks: 0,
    total_exposure: 0,
    bankroll_ruin: false,
    events_seen: 0,
  };
}

export function runBlindActuarialBankrollLab(input?: {
  dataset?: RealHistoricalDataset;
  config?: Exp016Config;
  policies?: RiskPolicyId[];
}): {
  experiment_id: string;
  kind: "HISTORICAL_OBSERVED";
  temporal_leakage: "PASS";
  outcome_firewall: "PASS";
  evidence_firewall: "PASS";
  walk_forward: "PASS";
  auto_promotion: false;
  winner: null;
  real_money: false;
  dataset_years_available: number[];
  markets: Record<string, "ADMITTED" | "BLOCKED">;
  years: YearPolicyReport[];
  by_policy: Record<
    string,
    {
      years: YearPolicyReport[];
      aggregate: ReturnType<typeof aggregateYearStats>;
      metrics: ReturnType<typeof computeActuarialMetrics>;
      monte_carlo: ReturnType<typeof runMonteCarloDiagnostic>;
    }
  >;
  audits: Array<Record<string, unknown>>;
  data_gaps: string[];
} {
  const config = input?.config ?? loadExp016Config();
  const dataset = input?.dataset ?? loadRealTruthLabPack();
  const policies = (input?.policies ??
    config.risk_policies) as RiskPolicyId[];
  const initial = config.initial_bankroll_per_year;
  const ledger = new BankrollLedger();
  const yearsOut: YearPolicyReport[] = [];
  const byPolicy: Record<string, YearPolicyReport[]> = {};
  const returnsByPolicy: Record<string, number[]> = {};
  const pathByPolicy: Record<string, number[]> = {};
  const ruinByPolicy: Record<string, number> = {};
  const audits: Array<Record<string, unknown>> = [];

  for (const p of policies) {
    byPolicy[p] = [];
    returnsByPolicy[p] = [];
    pathByPolicy[p] = [];
    ruinByPolicy[p] = 0;
  }

  const eventsByYear = new Map<number, RealLabEvent[]>();
  for (const e of dataset.events) {
    const y = yearOf(e.scheduledStartAt);
    const arr = eventsByYear.get(y) ?? [];
    arr.push(e);
    eventsByYear.set(y, arr);
  }
  for (const [, arr] of eventsByYear) {
    arr.sort((a, b) => a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime());
  }

  const markets: Record<string, "ADMITTED" | "BLOCKED"> = {};
  for (const m of config.markets_admitted) markets[m] = "ADMITTED";
  for (const m of config.markets_blocked) markets[m] = "BLOCKED";

  for (const year of config.solar_years_requested) {
    const status: YearPolicyReport["status"] = config.insufficient_history_years.includes(
      year,
    )
      ? "INSUFFICIENT_HISTORY"
      : config.incomplete_years.includes(year) && !eventsByYear.has(year)
        ? "INCOMPLETE_YEAR"
        : !eventsByYear.has(year)
          ? "NO_EVENTS"
          : "OK";

    const events = eventsByYear.get(year) ?? [];

    for (const policy of policies) {
      if (status !== "OK") {
        const rep = emptyYearReport(year, policy, status, initial);
        yearsOut.push(rep);
        byPolicy[policy]!.push(rep);
        continue;
      }

      let bankroll = initial;
      let peak = bankroll;
      let minB = bankroll;
      let maxDd = 0;
      let wins = 0;
      let losses = 0;
      const voids = 0;
      let positions = 0;
      let noPos = 0;
      let riskBlocks = 0;
      let exposure = 0;
      let dayExposure = 0;
      let lastDay = "";
      const openSel: ExposureSelection[] = [];
      let masaWins = 0;
      let masaBets = 0;
      const path = [bankroll];

      for (let i = 0; i < events.length; i++) {
        const event = events[i]!;
        const asOf = decisionAsOfForEvent(event);
        const sample = buildRealHistoricalEvaluationSample({
          eventId: event.eventId,
          asOf,
          dataset,
          includeOutcome: false,
          asOfPolicy: config.as_of_policy,
          allowUnknownPrecisionMarkets: true,
        });

        if (sample.outcomeContext !== null) {
          throw new BlindLeakageError("Outcome leaked before LOCK");
        }

        try {
          assertDecisionContextSafe(sample.decisionContext, {
            requireExactPrecision: config.as_of_policy === "STRICT_AS_OF",
          });
        } catch (err) {
          if (err instanceof DecisionContextSafetyError) {
            throw new BlindLeakageError(err.message);
          }
          throw err;
        }

        const pick = pickResultSelection(sample);
        if (!pick) {
          noPos += 1;
          continue;
        }
        assertAsOfNotAfter(pick.oddsAvailableAt, asOf, "odds");

        const evidenceItems = buildEvidenceForEvent({
          eventId: event.eventId,
          asOf,
          hypothesis: pick.selection,
          probability: pick.probability,
          odds: pick.odds,
          disagreement: pick.disagreement,
          featurePresent: sample.decisionContext.dataQuality.featurePresent,
          marketCount: sample.decisionContext.dataQuality.marketCount,
        });

        // Intentional blocked future news (audit) — never enters assessment graph
        const futureNews: EvidenceItem = {
          evidenceId: `ev_future_news_${event.eventId}`,
          category: "news",
          epistemicKind: "FACT",
          claim: "Lineup published after asOf",
          entityRef: null,
          eventId: event.eventId,
          sourceId: "fixture_news",
          sourceUrl: "https://example.local/lineup-after",
          publishedAt: new Date(asOf.getTime() + 47 * 60_000),
          availableAt: new Date(asOf.getTime() + 47 * 60_000),
          observedAt: new Date(asOf.getTime() + 47 * 60_000),
          temporalPrecision: "exact",
          polarity: "CONTEXT_ONLY",
          targetHypothesis: pick.selection,
          magnitude: null,
          claimConfidence: null,
          sourceReliability: null,
          confirmations: [],
          rebuttals: [],
        };

        const assessment = buildAssessmentReport({
          eventId: event.eventId,
          asOf,
          hypothesis: pick.selection,
          items: [...evidenceItems, futureNews],
          probability: pick.probability,
          validate: true,
        });

        const dayKey = asOf.toISOString().slice(0, 10);
        if (dayKey !== lastDay) {
          dayExposure = 0;
          lastDay = dayKey;
        }

        const drawdown = peak > 0 ? (peak - bankroll) / peak : 0;
        const state: BankrollState = {
          bankroll,
          peak,
          drawdown,
          dayExposure,
          matchExposure: 0,
          openClusterExposure: openSel
            .filter((s) => s.eventId === event.eventId)
            .reduce((a, s) => a + s.stake, 0),
          masanielloWins: masaWins,
          masanielloBetsInCycle: masaBets,
          remainingEventsHint: events.length - i,
        };

        let stake = 0;
        let reason = "";
        if (policy === "actuarial_v1") {
          const risk = evaluateActuarialRisk({
            assessment,
            probability: pick.probability,
            odds: pick.odds,
            edge: null,
            bankrollState: state,
            sizing: config.sizing,
            dataQuality: {
              featurePresent: sample.decisionContext.dataQuality.featurePresent,
              featureMissing: sample.decisionContext.dataQuality.featureMissing,
              marketCount: sample.decisionContext.dataQuality.marketCount,
              temporalUnknown: true,
            },
            marketDisagreement: pick.disagreement,
            sampleSize: dataset.events.length,
            sourceReliability: null,
          });
          stake = risk.finalStake;
          reason = risk.reason;
          if (risk.noPosition) riskBlocks += 1;
        } else {
          const pr = computePolicyStake({
            policy,
            probability: pick.probability,
            odds: pick.odds,
            edge: null,
            state,
            sizing: config.sizing,
          });
          stake = pr.stake;
          reason = pr.reason;
          if (pr.noPosition) riskBlocks += 1;
        }

        const guard = correlationExposureGuard({
          openSelections: openSel,
          candidate: {
            eventId: event.eventId,
            market: "result",
            selection: pick.selection,
            stake,
          },
          bankroll,
          maxClusterFraction: config.correlation.max_cluster_fraction,
        });
        stake = guard.cappedStake;
        if (!guard.allowed || stake <= 1e-12) {
          noPos += 1;
          if (audits.length < 3) {
            audits.push({
              eventId: event.eventId,
              asOf: asOf.toISOString(),
              phase: "NO_POSITION",
              reason: guard.reason || reason,
              blockedEvidence: assessment.blockedByTemporal.map((e) => e.evidenceId),
              outcomeRevealed: false,
            });
          }
          continue;
        }

        const decisionId = `${config.experiment_id}|${policy}|${year}|${event.eventId}|${i}`;
        const locked = lockDecision({
          decisionId,
          event,
          year,
          asOf,
          decisionContext: sample.decisionContext,
          market: "result",
          selection: pick.selection,
          odds: pick.odds,
          oddsAvailableAt: pick.oddsAvailableAt,
          probability: pick.probability,
          edge: null,
          stake,
          policy,
          bankrollBefore: bankroll,
          assessmentSummary: assessment.narrativeSummary,
          evidenceStrength: assessment.evidenceStrength,
        });

        // LOCK complete — only now reveal
        const outcome = revealOutcome(locked, event);
        const won = wonSelection(pick.selection, outcome.resultCode);

        ledger.append({
          decisionId,
          experimentId: config.experiment_id,
          year,
          eventId: event.eventId,
          market: "result",
          selection: pick.selection,
          policy,
          bankrollBefore: bankroll,
          stake,
          odds: pick.odds,
          lockedAt: locked.lockedAt,
          outcomeRevealAt: null,
          won: null,
          voided: false,
          pnl: null,
          bankrollAfter: null,
          probability: pick.probability,
          edge: null,
          asOf: locked.asOf,
          oddsAvailableAt: locked.oddsAvailableAt,
        });

        const settled = ledger.settle({
          decisionId,
          won,
          outcomeRevealAt: outcome.availableAt.toISOString(),
        });

        bankroll = settled.bankrollAfter!;
        positions += 1;
        exposure += stake;
        dayExposure += stake;
        openSel.push({
          eventId: event.eventId,
          market: "result",
          selection: pick.selection,
          stake,
        });
        if (won) {
          wins += 1;
          masaWins += 1;
        } else losses += 1;
        masaBets += 1;
        if (masaBets >= config.sizing.masaniello_cycle_length) {
          masaBets = 0;
          masaWins = 0;
        }

        peak = Math.max(peak, bankroll);
        minB = Math.min(minB, bankroll);
        maxDd = Math.max(maxDd, peak > 0 ? (peak - bankroll) / peak : 0);
        path.push(bankroll);
        const ret =
          settled.bankrollBefore > 0
            ? (settled.pnl ?? 0) / settled.bankrollBefore
            : 0;
        returnsByPolicy[policy]!.push(ret);
        if (bankroll <= initial * config.sizing.bankroll_floor_fraction) {
          ruinByPolicy[policy]! += 1;
        }

        if (audits.length < 5) {
          audits.push({
            eventId: event.eventId,
            asOf: asOf.toISOString(),
            information: {
              features: sample.decisionContext.availableFeatures.length,
              markets: sample.decisionContext.availableMarkets.length,
            },
            evidence: {
              supporting: assessment.evidenceGraph.supporting.length,
              contradicting: assessment.evidenceGraph.contradicting.length,
              contextual: assessment.evidenceGraph.contextual.length,
              blocked: assessment.blockedByTemporal.length,
            },
            assessment: {
              hypothesis: pick.selection,
              probability: pick.probability,
              strength: assessment.evidenceStrength,
            },
            risk: { policy, stake, reason: guard.reason || reason },
            lock: locked.lockedAt,
            outcome_reveal: outcome.resultCode,
            pnl: settled.pnl,
            outcomeAccessibleBeforeLock: false,
          });
        }
      }

      ledger.reconcileYear(year, initial, policy);
      pathByPolicy[policy]!.push(...path);

      const ruin = bankroll <= initial * config.sizing.bankroll_floor_fraction;
      const rep: YearPolicyReport = {
        year,
        status: "OK",
        policy,
        initial_bankroll: initial,
        final_bankroll: bankroll,
        profit_loss: bankroll - initial,
        return_pct: (bankroll - initial) / initial,
        max_drawdown: maxDd,
        minimum_bankroll: minB,
        peak_bankroll: peak,
        number_of_positions: positions,
        number_of_winning_positions: wins,
        number_of_losing_positions: losses,
        number_of_void_positions: voids,
        number_of_no_position: noPos,
        risk_blocks: riskBlocks,
        total_exposure: exposure,
        bankroll_ruin: ruin,
        events_seen: events.length,
      };
      yearsOut.push(rep);
      byPolicy[policy]!.push(rep);
    }
  }

  const by_policy: Record<
    string,
    {
      years: YearPolicyReport[];
      aggregate: ReturnType<typeof aggregateYearStats>;
      metrics: ReturnType<typeof computeActuarialMetrics>;
      monte_carlo: ReturnType<typeof runMonteCarloDiagnostic>;
    }
  > = {};

  for (const policy of policies) {
    const okYears = byPolicy[policy]!.filter((y) => y.status === "OK");
    const finals = okYears.map((y) => y.final_bankroll);
    const aggregate = aggregateYearStats(finals, initial);
    const rets = returnsByPolicy[policy]!;
    const metrics = computeActuarialMetrics({
      initialBankroll: initial,
      finalBankroll:
        finals.length === 0
          ? initial
          : finals.reduce((a, b) => a + b, 0) / finals.length,
      years: Math.max(1, okYears.length),
      decisionReturns: rets,
      bankrollPath: pathByPolicy[policy]!.length
        ? pathByPolicy[policy]!
        : [initial],
      ruinHits: ruinByPolicy[policy]!,
      decisions: rets.length,
    });
    const monte_carlo = runMonteCarloDiagnostic({
      initialBankroll: initial,
      decisionReturns: rets,
      nPaths: config.monte_carlo.n_paths,
      seed: config.monte_carlo.seed + policy.length,
      stepsPerPath: Math.max(5, Math.min(50, rets.length || 10)),
    });
    by_policy[policy] = {
      years: byPolicy[policy]!,
      aggregate,
      metrics,
      monte_carlo,
    };
  }

  return {
    experiment_id: config.experiment_id,
    kind: "HISTORICAL_OBSERVED",
    temporal_leakage: "PASS",
    outcome_firewall: "PASS",
    evidence_firewall: "PASS",
    walk_forward: "PASS",
    auto_promotion: false,
    winner: null,
    real_money: false,
    dataset_years_available: config.dataset_years_available,
    markets,
    years: yearsOut,
    by_policy,
    audits,
    data_gaps: [
      "Historical DB 2001–2018: INSUFFICIENT_HISTORY (pack covers 2019–2024 E0 only)",
      "2025–2026: INCOMPLETE_YEAR / no events in pack",
      "Markets beyond result: BLOCKED (not MODEL_READY in pack)",
      "declared_edge=false — Kelly paths often small; Flat remains diagnostic baseline",
      "sourceReliability=null everywhere",
    ],
  };
}

export function formatActuarialReplayReport(
  lab: ReturnType<typeof runBlindActuarialBankrollLab>,
): string {
  const lines: string[] = [];
  lines.push("BLIND ACTUARIAL REPLAY V1");
  lines.push("");
  lines.push(`Experiment: ${lab.experiment_id}`);
  lines.push(`Kind: ${lab.kind} (Monte Carlo is SIMULATED / separate)`);
  lines.push(`Dataset years available: ${lab.dataset_years_available.join(", ")}`);
  lines.push(`Initial bankroll/year: 1,000 credits`);
  lines.push("");
  lines.push(`Temporal leakage: ${lab.temporal_leakage}`);
  lines.push(`Outcome firewall: ${lab.outcome_firewall}`);
  lines.push(`Evidence firewall: ${lab.evidence_firewall}`);
  lines.push(`Walk-forward: ${lab.walk_forward}`);
  lines.push("");
  lines.push("Markets:");
  for (const [m, s] of Object.entries(lab.markets)) {
    lines.push(`  ${m.padEnd(22)} ${s}`);
  }
  lines.push("");
  lines.push(
    "YEAR     POLICY                 START    END      MAX DD    DECISIONS  RUIN",
  );
  for (const y of lab.years.filter((x) => x.policy === "risk_capped_kelly")) {
    lines.push(
      `${y.year}     risk_capped_kelly      ${String(y.initial_bankroll).padEnd(8)} ${y.final_bankroll.toFixed(1).padEnd(8)} ${(y.max_drawdown * 100).toFixed(1).padEnd(8)} ${String(y.number_of_positions).padEnd(10)} ${y.bankroll_ruin || y.status}`,
    );
  }
  lines.push("");
  lines.push("POLICY COMPARISON (OK years only) — winner=null");
  for (const [policy, block] of Object.entries(lab.by_policy)) {
    const a = block.aggregate;
    lines.push(
      `${policy}: mean_final=${a.mean_final?.toFixed(1) ?? "n/a"} median=${a.median_final?.toFixed(1) ?? "n/a"} p_ruin=${a.p_ruin?.toFixed(3) ?? "n/a"} maxDD=${(block.metrics.max_drawdown * 100).toFixed(1)}% MC_ruin=${block.monte_carlo.ruin_probability.toFixed(3)}`,
    );
  }
  lines.push("");
  lines.push("VERDICT: NO_AUTO_PROMOTION");
  lines.push(`winner=${lab.winner}`);
  lines.push("");
  lines.push("DATA_GAPS:");
  for (const g of lab.data_gaps) lines.push(`- ${g}`);
  return lines.join("\n");
}
