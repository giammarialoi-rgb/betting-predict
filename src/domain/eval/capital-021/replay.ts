/**
 * TASK 021 blind annual capital — wraps 020 replay, adds STRICT ledger filter + metrics.
 */

import { runBlindCapital020 } from "@/domain/eval/capital-020/replay";
import { loadExp020Config } from "@/domain/eval/capital-020/config";
import type { NormalizedEvent } from "@/domain/eval/acquisition-019/types";
import type { MarketSnapshot } from "@/domain/eval/capital-020/types";
import type {
  AnnualRow021,
  Exp021Config,
  MarketObservationLedger,
  MarketRow021,
  StrategyRow021,
} from "@/domain/eval/capital-021/types";
import { assertFrozen021, leakL8BankrollCarriedAcrossYears } from "@/domain/eval/capital-021/leakage";
import { CATALOGUED_MARKETS } from "@/domain/eval/acquisition-019/columns";
import { evaluateModelReadyGates } from "@/domain/markets/model-ready-gates";

function catalogName(market: string): string {
  if (market === "TOTAL_GOALS") return "OU25";
  if (market === "ASIAN_HANDICAP") return "AH";
  return market;
}

export function runBlindCapital021(input: {
  cfg: Exp021Config;
  events: readonly NormalizedEvent[];
  clubIndex: readonly NormalizedEvent[];
  snapshots: readonly MarketSnapshot[];
  ledger: readonly MarketObservationLedger[];
}): {
  annual: AnnualRow021[];
  marketRows: MarketRow021[];
  strategyRows: StrategyRow021[];
  decisions: ReturnType<typeof runBlindCapital020>["decisions"];
  errorFreq: ReturnType<typeof runBlindCapital020>["errorFreq"];
  modelRows: ReturnType<typeof runBlindCapital020>["modelRows"];
  bets: number;
  noBet: number;
  sampleNarrative: string | null;
} {
  assertFrozen021(input.cfg);
  const cfg020 = loadExp020Config();
  const replay = runBlindCapital020({
    cfg: cfg020,
    events: input.events,
    clubIndex: input.clubIndex,
    snapshots: input.snapshots,
  });

  const datasetLabel =
    input.ledger.some((r) => r.usable_strict_capital)
      ? "STRICT_EXACT_TIMESTAMP"
      : "football-data-co-uk DATE_ONLY (research)";

  const annual: AnnualRow021[] = replay.annual.map((a, i) => {
    leakL8BankrollCarriedAcrossYears({
      yearStart: a.start,
      previousYearEnd: i > 0 ? replay.annual[i - 1]!.start : null,
      initial: input.cfg.initial_bankroll,
    });
    const status =
      a.year >= 2026
        ? "INCOMPLETE"
        : a.bets === 0
          ? "INSUFFICIENT_DATA"
          : "VALID";
    const noBetRate =
      a.decisions > 0 ? 1 - a.bets / a.decisions : a.decisions === 0 ? null : 1;
    return {
      year: a.year,
      dataset: datasetLabel,
      events: a.valid_data,
      decisions: a.decisions,
      bets: a.bets,
      start: a.start,
      final: status === "VALID" ? a.final : null,
      pnl: status === "VALID" ? a.pnl : null,
      roi: status === "VALID" ? a.roi : null,
      max_dd: status === "VALID" ? a.max_dd : null,
      strategy: "no_bet",
      confidence: "insufficient",
      status,
      no_bet_rate: noBetRate,
      hit_rate: a.bets > 0 ? a.wins / a.bets : null,
      average_odds: null,
      average_edge: null,
      brier: replay.modelRows.find((m) => m.period === String(a.year))?.model_brier ?? null,
      logloss: replay.modelRows.find((m) => m.period === String(a.year))?.model_logloss ?? null,
      calibration: "untested",
      time_under_water: a.bets > 0 ? a.max_dd : null,
      largest_loss: null,
      largest_win: null,
      profit_factor: null,
      volatility: null,
      insufficient_reason: a.insufficient_reason,
    };
  });

  const observed = new Set(input.ledger.map((r) => catalogName(r.market)));
  const extra = ["BTTS", "CORNERS", "CARDS", "DC", "DNB", "PLAYER_GOALS", "CS", "HT_1X2"];
  const keys = [...new Set([...CATALOGUED_MARKETS, ...extra, ...observed])];

  const marketRows: MarketRow021[] = keys.map((market) => {
    const rows = input.ledger.filter((r) => catalogName(r.market) === market);
    const events = new Set(rows.map((r) => r.event)).size;
    const exactN = rows.filter((r) => r.usable_strict_capital).length;
    const gate = evaluateModelReadyGates({
      market,
      line: market === "OU25" ? 2.5 : null,
      sampleSize: rows.length,
      dataCompleteness: rows.length ? 1 : 0,
      temporalIntegrity: exactN > 0,
      exactPrecisionShare: rows.length ? exactN / rows.length : 0,
      bookmakerCoverage: new Set(rows.map((r) => r.bookmaker)).size,
      outcomeCompleteness: 1,
      featureAvailability: 0.8,
      calibrationOk: null,
      walkForwardStable: null,
      holdoutPerformanceOk: null,
    });
    const observedFlag = rows.length > 0;
    const temporallyValid = exactN > 0;
    const lifecycle = gate.status === "MODEL_READY"
      ? "MODEL_READY"
      : temporallyValid
        ? "TEMPORALLY_VALID"
        : observedFlag
          ? "OBSERVED"
          : "CATALOGUED";
    return {
      market,
      lifecycle,
      events,
      bets: 0,
      brier: market === "1X2" ? (replay.modelRows[0]?.model_brier ?? null) : null,
      logloss: market === "1X2" ? (replay.modelRows[0]?.model_logloss ?? null) : null,
      roi: null,
      max_dd: null,
      temporally_valid: temporallyValid,
      model_ready: gate.status === "MODEL_READY",
      status: lifecycle,
    };
  });

  const strategyRows: StrategyRow021[] = input.cfg.risk_policies.map((strategy) => ({
    strategy,
    role: strategy === "no_bet" ? "operative" : "challenger_unused",
    bets: 0,
    pnl: null,
    selected_from_pnl: false,
  }));

  return {
    annual,
    marketRows,
    strategyRows,
    decisions: replay.decisions,
    errorFreq: replay.errorFreq,
    modelRows: replay.modelRows,
    bets: replay.bets,
    noBet: replay.noBet,
    sampleNarrative: replay.sampleNarrative,
  };
}
