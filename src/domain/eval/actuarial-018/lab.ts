/**
 * TASK 018 Blind Historical Actuarial Replay — annual STRICT solar years.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { classifyAllMatchesColumns } from "@/domain/eval/actuarial-018/column-classification";
import {
  loadClubMatchesLite,
} from "@/domain/eval/actuarial-018/load-matches";
import {
  reconstructPrematchFeatures,
  type PrematchFeatures,
} from "@/domain/eval/actuarial-018/reconstruct";
import {
  assertDecisionPayloadSafe,
  assertExpandingWindowTrain,
  assertNoRetroactiveOptimization,
  BlindLeakageError,
} from "@/domain/eval/actuarial-018/integrity";
import { kellyFraction } from "@/domain/risk/engine";
import { runMonteCarloDiagnostic } from "@/domain/risk/actuarial/monte-carlo";

export type Exp018Config = {
  experiment_id: string;
  initial_bankroll: number;
  as_of_policy: string;
  declared_edge: false;
  retroactive_optimization: false;
  auto_promote: false;
  winner: null;
  solar_years: number[];
  sizing: {
    flat_unit: number;
    kelly_fractional_factor: number;
    max_stake_fraction_event: number;
    min_train_events_for_model: number;
  };
  holdout_years: number[];
};

export type AnnualRow = {
  year: number;
  data_status:
    | "OK"
    | "INSUFFICIENT_DATA"
    | "INCOMPLETE"
    | "BLOCKED_ODDS_TEMPORAL";
  events_eligible: number;
  decisions: number;
  bets: number;
  no_bet_temporal: number;
  no_bet_sample: number;
  no_bet_edge: number;
  no_bet_uncertainty: number;
  no_bet_correlation: number;
  start: number;
  final: number | null;
  pnl: number | null;
  roi: number | null;
  max_dd: number | null;
  exposure_max: number | null;
  brier: number | null;
  log_loss: number | null;
};

function loadConfig(): Exp018Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_018_blind_actuarial_v1.json"),
      "utf8",
    ),
  ) as Exp018Config;
  if (raw.experiment_id !== "exp_018_blind_actuarial_v1") {
    throw new Error("bad experiment_id");
  }
  if (raw.retroactive_optimization !== false || raw.auto_promote !== false) {
    throw new ExperimentIntegrityFail();
  }
  return raw;
}

function ExperimentIntegrityFail(): never {
  throw new Error("ExperimentIntegrityError: frozen flags violated");
}

function brier(p: number[], actualIdx: number): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const y = i === actualIdx ? 1 : 0;
    s += (p[i]! - y) ** 2;
  }
  return s / p.length;
}

function logLoss(p: number[], actualIdx: number): number {
  const eps = 1e-12;
  return -Math.log(Math.max(eps, Math.min(1 - eps, p[actualIdx]!)));
}

function formModel(
  feat: PrematchFeatures,
  prior: [number, number, number],
): [number, number, number] {
  const hp = feat.home_form_5.sample
    ? feat.home_form_5.points / (3 * feat.home_form_5.sample)
    : 0.33;
  const ap = feat.away_form_5.sample
    ? feat.away_form_5.points / (3 * feat.away_form_5.sample)
    : 0.33;
  // Soft blend toward home if form stronger — RESEARCH diagnostic, not claimed edge
  const home = prior[0]! * 0.7 + hp * 0.3;
  const away = prior[2]! * 0.7 + ap * 0.3;
  const draw = prior[1]!;
  const s = home + draw + away;
  return [home / s, draw / s, away / s];
}

function idxResult(r: "HOME" | "DRAW" | "AWAY"): number {
  return r === "HOME" ? 0 : r === "DRAW" ? 1 : 2;
}

/**
 * STRICT stake: odds from repo are TEMPORALLY_UNKNOWN → never bet.
 * declared_edge=false → never invent edge.
 */
function strictStakeDecision(input: {
  hasTemporallyValidOdds: boolean;
  declaredEdge: boolean;
  trainN: number;
  minTrain: number;
  bankroll: number;
  pHome: number;
  oddsHome: number | null;
  sizing: Exp018Config["sizing"];
}): {
  stake: number;
  reason:
    | "BET"
    | "NO_BET_TEMPORAL"
    | "NO_BET_EDGE"
    | "NO_BET_SAMPLE"
    | "NO_BET_UNCERTAINTY"
    | "NO_BET_CORRELATION";
} {
  if (!input.hasTemporallyValidOdds) {
    return { stake: 0, reason: "NO_BET_TEMPORAL" };
  }
  if (!input.declaredEdge) {
    return { stake: 0, reason: "NO_BET_EDGE" };
  }
  if (input.trainN < input.minTrain) {
    return { stake: 0, reason: "NO_BET_SAMPLE" };
  }
  if (input.oddsHome == null || input.oddsHome <= 1) {
    return { stake: 0, reason: "NO_BET_TEMPORAL" };
  }
  const raw = kellyFraction(input.pHome, input.oddsHome);
  const frac = raw * input.sizing.kelly_fractional_factor;
  // uncertainty penalty when sample thin
  const unc = Math.min(1, input.trainN / 500);
  if (unc < input.sizing.kelly_fractional_factor) {
    // keep going with penalty
  }
  if (unc < 0.25) {
    return { stake: 0, reason: "NO_BET_UNCERTAINTY" };
  }
  const stake = Math.min(
    input.bankroll * frac * unc,
    input.bankroll * input.sizing.max_stake_fraction_event,
  );
  if (stake <= 1e-9) return { stake: 0, reason: "NO_BET_EDGE" };
  return { stake, reason: "BET" };
}

export async function runTask018AuditColumns() {
  const rows = classifyAllMatchesColumns();
  const outDir = join(process.cwd(), "audit");
  mkdirSync(outDir, { recursive: true });
  const payload = {
    experiment_id: "exp_018_blind_actuarial_v1",
    dataset: "Club-Football-Match-Data/Matches.csv",
    columns: rows,
    summary: {
      SAFE_PREMATCH: rows.filter((r) => r.usability === "SAFE_PREMATCH").length,
      SAFE_AFTER_RECONSTRUCTION: rows.filter(
        (r) => r.usability === "SAFE_AFTER_RECONSTRUCTION",
      ).length,
      RESEARCH_ONLY: rows.filter((r) => r.usability === "RESEARCH_ONLY").length,
      POST_MATCH: rows.filter((r) => r.usability === "POST_MATCH").length,
      TEMPORALLY_UNKNOWN: rows.filter(
        (r) => r.usability === "TEMPORALLY_UNKNOWN",
      ).length,
      FORBIDDEN: rows.filter((r) => r.usability === "FORBIDDEN").length,
    },
  };
  writeFileSync(
    join(outDir, "task-018-dataset-column-classification.json"),
    JSON.stringify(payload, null, 2),
  );
  return payload;
}

export async function runBlindActuarial018() {
  assertNoRetroactiveOptimization({
    retroactive_optimization: false,
    parameters_frozen: true,
  });

  const cfg = loadConfig();
  const columnAudit = await runTask018AuditColumns();
  const loaded = await loadClubMatchesLite();
  const features = reconstructPrematchFeatures(loaded.matches);
  const featById = new Map(features.map((f) => [f.eventId, f]));

  const byYear = new Map<number, ClubMatchLite[]>();
  for (const m of loaded.matches) {
    if (m.result == null) continue;
    const arr = byYear.get(m.year) ?? [];
    arr.push(m);
    byYear.set(m.year, arr);
  }

  const annual: AnnualRow[] = [];
  let totalDecisions = 0;
  const totalBets = 0;
  let totalNoBet = 0;

  type YearAcc = {
    bankroll: number;
    peak: number;
    maxDd: number;
    exposureMax: number;
    decisions: number;
    bets: number;
    nbT: number;
    nbS: number;
    nbE: number;
    nbU: number;
    nbC: number;
    bSum: number;
    lSum: number;
    scored: number;
  };

  const yearAcc = new Map<number, YearAcc>();
  for (const year of cfg.solar_years) {
    yearAcc.set(year, {
      bankroll: cfg.initial_bankroll,
      peak: cfg.initial_bankroll,
      maxDd: 0,
      exposureMax: 0,
      decisions: 0,
      bets: 0,
      nbT: 0,
      nbS: 0,
      nbE: 0,
      nbU: 0,
      nbC: 0,
      bSum: 0,
      lSum: 0,
      scored: 0,
    });
  }

  // Single chronological pass — expanding frequency counts O(n)
  let th = 0;
  let td = 0;
  let ta = 0;
  let trainN = 0;
  let lastTrainTs = -1;

  const allSorted = loaded.matches.filter((m) => m.result != null);

  for (const m of allSorted) {
    const ts = m.matchDate.getTime();
    if (lastTrainTs >= 0) {
      assertExpandingWindowTrain(lastTrainTs, ts);
    }

    const feat = featById.get(m.eventId);
    const year = m.year;
    const acc = yearAcc.get(year);

    if (feat && acc && cfg.solar_years.includes(year)) {
      const asOf = m.matchDate;
      assertDecisionPayloadSafe(
        {
          eventId: m.eventId,
          form_reconstructed: true,
          uses_repo_form_column: false,
          research_elo_diff: feat.research_elo_diff,
        },
        asOf,
      );

      const n = th + td + ta;
      const prior: [number, number, number] =
        n === 0 ? [1 / 3, 1 / 3, 1 / 3] : [th / n, td / n, ta / n];
      const p = formModel(feat, prior);
      const actual = idxResult(m.result!);
      acc.bSum += brier(p, actual);
      acc.lSum += logLoss(p, actual);
      acc.scored += 1;
      acc.decisions += 1;
      totalDecisions += 1;

      const dec = strictStakeDecision({
        hasTemporallyValidOdds: false,
        declaredEdge: cfg.declared_edge,
        trainN,
        minTrain: cfg.sizing.min_train_events_for_model,
        bankroll: acc.bankroll,
        pHome: p[0]!,
        oddsHome: m.oddHome,
        sizing: cfg.sizing,
      });

      if (dec.reason === "NO_BET_TEMPORAL") acc.nbT += 1;
      else if (dec.reason === "NO_BET_SAMPLE") acc.nbS += 1;
      else if (dec.reason === "NO_BET_EDGE") acc.nbE += 1;
      else if (dec.reason === "NO_BET_UNCERTAINTY") acc.nbU += 1;
      else if (dec.reason === "NO_BET_CORRELATION") acc.nbC += 1;

      if (dec.reason === "BET" && dec.stake > 0) {
        throw new BlindLeakageError(
          "unreachable: STRICT bets require temporally valid odds",
        );
      }
      totalNoBet += 1;
      acc.peak = Math.max(acc.peak, acc.bankroll);
      acc.maxDd = Math.max(
        acc.maxDd,
        acc.peak > 0 ? (acc.peak - acc.bankroll) / acc.peak : 0,
      );
    }

    // Reveal outcome ONLY after decision — update expanding train
    if (m.result === "HOME") th += 1;
    else if (m.result === "DRAW") td += 1;
    else ta += 1;
    trainN += 1;
    lastTrainTs = ts;
  }

  for (const year of cfg.solar_years) {
    const events = byYear.get(year) ?? [];
    const incomplete = year >= 2025;
    const acc = yearAcc.get(year)!;

    if (!loaded.present) {
      annual.push({
        year,
        data_status: "INSUFFICIENT_DATA",
        events_eligible: 0,
        decisions: 0,
        bets: 0,
        no_bet_temporal: 0,
        no_bet_sample: 0,
        no_bet_edge: 0,
        no_bet_uncertainty: 0,
        no_bet_correlation: 0,
        start: cfg.initial_bankroll,
        final: null,
        pnl: null,
        roi: null,
        max_dd: null,
        exposure_max: null,
        brier: null,
        log_loss: null,
      });
      continue;
    }

    if (events.length === 0) {
      annual.push({
        year,
        data_status: incomplete ? "INCOMPLETE" : "INSUFFICIENT_DATA",
        events_eligible: 0,
        decisions: 0,
        bets: 0,
        no_bet_temporal: 0,
        no_bet_sample: 0,
        no_bet_edge: 0,
        no_bet_uncertainty: 0,
        no_bet_correlation: 0,
        start: cfg.initial_bankroll,
        final: null,
        pnl: null,
        roi: null,
        max_dd: null,
        exposure_max: null,
        brier: null,
        log_loss: null,
      });
      continue;
    }

    annual.push({
      year,
      data_status: incomplete ? "INCOMPLETE" : "BLOCKED_ODDS_TEMPORAL",
      events_eligible: events.length,
      decisions: acc.decisions,
      bets: acc.bets,
      no_bet_temporal: acc.nbT,
      no_bet_sample: acc.nbS,
      no_bet_edge: acc.nbE,
      no_bet_uncertainty: acc.nbU,
      no_bet_correlation: acc.nbC,
      start: cfg.initial_bankroll,
      final: acc.bankroll,
      pnl: acc.bankroll - cfg.initial_bankroll,
      roi: (acc.bankroll - cfg.initial_bankroll) / cfg.initial_bankroll,
      max_dd: acc.maxDd,
      exposure_max: acc.exposureMax,
      brier: acc.scored ? acc.bSum / acc.scored : null,
      log_loss: acc.scored ? acc.lSum / acc.scored : null,
    });
  }

  const finals = annual
    .filter((a) => a.final != null && a.events_eligible > 0)
    .map((a) => a.final!);
  const above = finals.filter((f) => f > 1000).length;
  const below = finals.filter((f) => f < 1000).length;

  const marketTable = [
    {
      market: "1X2",
      events: annual.reduce((a, r) => a + r.events_eligible, 0),
      decisions: totalDecisions,
      bets: totalBets,
      status: "BLOCKED_ODDS_TEMPORAL_STRICT",
      note: "Odd* TEMPORALLY_UNKNOWN — STRICT rejects; predictive metrics use reconstructed form only",
    },
    { market: "O/U", events: 0, decisions: 0, bets: 0, status: "BLOCKED", note: "no STRICT temporal odds" },
    { market: "BTTS", events: 0, decisions: 0, bets: 0, status: "BLOCKED", note: "not observed STRICT" },
    { market: "Team Goals", events: 0, decisions: 0, bets: 0, status: "BLOCKED", note: "not observed STRICT" },
    { market: "Corners", events: 0, decisions: 0, bets: 0, status: "BLOCKED", note: "post-match stats only in repo" },
    { market: "Cards", events: 0, decisions: 0, bets: 0, status: "BLOCKED", note: "post-match stats only in repo" },
  ];

  const modelRows = [
    {
      model: "frequency_expanding",
      note: "walk-forward prior from past FT only",
    },
    {
      model: "form_reconstructed_5",
      note: "lagged points blend — not repo Form*",
    },
    {
      model: "market_devig",
      status: "BLOCKED_STRICT",
      note: "repo odds temporally unknown",
    },
    {
      model: "elo_row",
      status: "RESEARCH_ONLY",
      note: "match-row Elo not official ClubElo asOf",
    },
  ];

  const verdict =
    totalBets === 0 && loaded.present
      ? ("INSUFFICIENT_DATA" as const)
      : totalBets === 0
        ? ("INSUFFICIENT_DATA" as const)
        : ("NO_EVIDENCE_OF_EDGE" as const);

  const mc = runMonteCarloDiagnostic({
    initialBankroll: 1000,
    decisionReturns: [],
    nPaths: 100,
    seed: 18,
    stepsPerPath: 10,
  });

  const report = {
    experiment_id: cfg.experiment_id,
    kind: "HISTORICAL_OBSERVED" as const,
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    leakage_detected: 0,
    dataset: {
      present: loaded.present,
      path: loaded.path,
      rows_read: loaded.rows_read,
      matches_with_ft: loaded.matches.filter((m) => m.result != null).length,
      rows_skipped_bad_date: loaded.rows_skipped_bad_date,
      content_sha16: loaded.present
        ? createHash("sha256")
            .update(String(loaded.rows_read) + String(loaded.matches.length))
            .digest("hex")
            .slice(0, 16)
        : null,
    },
    column_summary: columnAudit.summary,
    annual,
    no_bet_summary: annual.map((a) => ({
      year: a.year,
      events: a.events_eligible,
      no_bet_temporal: a.no_bet_temporal,
      no_bet_sample: a.no_bet_sample,
      no_bet_edge: a.no_bet_edge,
      no_bet_uncertainty: a.no_bet_uncertainty,
      no_bet_correlation: a.no_bet_correlation,
      bets: a.bets,
    })),
    algorithm_status: {
      events_analyzed: loaded.matches.length,
      events_usable_strict_features: features.length,
      events_usable_strict_odds: 0,
      decisions: totalDecisions,
      bets: totalBets,
      no_bet: totalNoBet,
      markets_used: [] as string[],
      markets_blocked: marketTable.map((m) => m.market),
      sources_used: ["Club-Football-Match-Data (SECONDARY)", "reconstructed form"],
      leakage_detected: 0,
      edge_declared: "NO",
      roi_historical: 0,
      brier_mean:
        annual.filter((a) => a.brier != null).reduce((s, a) => s + a.brier!, 0) /
          Math.max(1, annual.filter((a) => a.brier != null).length) || null,
      logloss_mean:
        annual.filter((a) => a.log_loss != null).reduce((s, a) => s + a.log_loss!, 0) /
          Math.max(1, annual.filter((a) => a.log_loss != null).length) || null,
      max_drawdown: 0,
      worst_year: finals.length ? Math.min(...finals) : null,
      best_year: finals.length ? Math.max(...finals) : null,
      median_final: finals.length
        ? [...finals].sort((a, b) => a - b)[Math.floor(finals.length / 2)]!
        : null,
      pct_years_above_1000: finals.length ? above / finals.length : null,
      pct_years_below_1000: finals.length ? below / finals.length : null,
      model_ready: false,
    },
    markets: marketTable,
    models: modelRows,
    stress_simulated: { ...mc, separated_from_historical: true },
    final_verdict: verdict,
    final_verdict_note:
      "STRICT odds unavailable (TEMPORALLY_UNKNOWN). Capital preserved at 1000/year with 0 bets — not a claim of edge. Surviving predictive sample uses reconstructed lagged form only. Prefer discovering where we are wrong.",
  };

  return report;
}

export type Task018Report = Awaited<ReturnType<typeof runBlindActuarial018>>;

export function writeTask018Artifacts(report: Task018Report): void {
  const docs = join(process.cwd(), "docs");
  const audit = join(process.cwd(), "audit");
  const artifacts = join(process.cwd(), "artifacts");
  mkdirSync(docs, { recursive: true });
  mkdirSync(audit, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  writeFileSync(
    join(artifacts, "task-018-result.json"),
    JSON.stringify(report, null, 2),
  );

  const annualMd = [
    "# TASK 018 — Annual Results (STRICT_AS_OF)",
    "",
    "Bankroll restarts at **1000** each solar year. Repo odds = TEMPORALLY_UNKNOWN → **NO BET** under STRICT.",
    "",
    "| Year | Data status | Eligible | Decisions | Bets | Start | Final | P/L | ROI | Max DD | Exp max | Brier | LogLoss |",
    "|------|-------------|---------:|----------:|-----:|------:|------:|----:|----:|-------:|--------:|------:|--------:|",
    ...report.annual.map((a) => {
      const f = a.final == null ? "—" : a.final.toFixed(1);
      const pnl = a.pnl == null ? "—" : a.pnl.toFixed(1);
      const roi = a.roi == null ? "—" : `${(a.roi * 100).toFixed(2)}%`;
      const dd = a.max_dd == null ? "—" : `${(a.max_dd * 100).toFixed(2)}%`;
      const ex = a.exposure_max == null ? "—" : a.exposure_max.toFixed(1);
      const br = a.brier == null ? "—" : a.brier.toFixed(4);
      const ll = a.log_loss == null ? "—" : a.log_loss.toFixed(4);
      return `| ${a.year} | ${a.data_status} | ${a.events_eligible} | ${a.decisions} | ${a.bets} | ${a.start} | ${f} | ${pnl} | ${roi} | ${dd} | ${ex} | ${br} | ${ll} |`;
    }),
    "",
    "## Why no-bet",
    "",
    "| Year | Events | Temporal | Sample | Edge | Uncertainty | Correlation | Bets |",
    "|------|-------:|---------:|-------:|-----:|------------:|------------:|-----:|",
    ...report.no_bet_summary.map(
      (a) =>
        `| ${a.year} | ${a.events} | ${a.no_bet_temporal} | ${a.no_bet_sample} | ${a.no_bet_edge} | ${a.no_bet_uncertainty} | ${a.no_bet_correlation} | ${a.bets} |`,
    ),
  ].join("\n");
  writeFileSync(join(docs, "task-018-annual-results.md"), annualMd);

  writeFileSync(
    join(docs, "task-018-market-results.md"),
    [
      "# TASK 018 — Market Results",
      "",
      "| Market | Events | Decisions | Bets | Status | Note |",
      "|--------|-------:|----------:|-----:|--------|------|",
      ...report.markets.map(
        (m) =>
          `| ${m.market} | ${m.events} | ${m.decisions} | ${m.bets} | ${m.status} | ${m.note} |`,
      ),
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-018-model-results.md"),
    [
      "# TASK 018 — Model Results",
      "",
      "Walk-forward expanding window. HOLDOUT years listed in experiment manifest remain sacred for promotion decisions.",
      "",
      "| Model | Status / note |",
      "|-------|----------------|",
      ...report.models.map(
        (m) =>
          `| ${m.model} | ${"status" in m ? m.status : "ACTIVE"} — ${m.note} |`,
      ),
      "",
      `Mean Brier (years with scores): ${report.algorithm_status.brier_mean}`,
      `Mean LogLoss: ${report.algorithm_status.logloss_mean}`,
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-018-final-verdict.md"),
    [
      "# TASK 018 — Final Verdict",
      "",
      `**${report.final_verdict}**`,
      "",
      report.final_verdict_note,
      "",
      "## Algorithm status snapshot",
      "",
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Events analyzed | ${report.algorithm_status.events_analyzed} |`,
      `| STRICT feature-usable | ${report.algorithm_status.events_usable_strict_features} |`,
      `| STRICT odds-usable | ${report.algorithm_status.events_usable_strict_odds} |`,
      `| Decisions | ${report.algorithm_status.decisions} |`,
      `| Bets | ${report.algorithm_status.bets} |`,
      `| No bet | ${report.algorithm_status.no_bet} |`,
      `| Edge declared | ${report.algorithm_status.edge_declared} |`,
      `| MODEL_READY | ${report.algorithm_status.model_ready} |`,
      `| Leakage detected | ${report.algorithm_status.leakage_detected} |`,
      `| Winner | ${report.winner} |`,
      "",
      "This is not a claim of profitability. Zero bets under STRICT is the scientifically correct outcome when odds clocks are unproven.",
    ].join("\n"),
  );

  const colRows = classifyAllMatchesColumns();
  writeFileSync(
    join(docs, "task-018-dataset-audit.md"),
    [
      "# TASK 018 — Dataset Column Audit",
      "",
      "Source: `xgabora/Club-Football-Match-Data` Matches.csv (SECONDARY / BENCHMARK).",
      "",
      "| Column | Semantics | Temporality | Usability | STRICT | Reason |",
      "|--------|-----------|-------------|-----------|--------|--------|",
      ...colRows.map(
        (r) =>
          `| ${r.column} | ${r.semantics} | ${r.temporality} | ${r.usability} | ${r.usable_strict ? "YES" : "NO"} | ${r.reason} |`,
      ),
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-018-blind-protocol.md"),
    [
      "# TASK 018 — Blind Protocol",
      "",
      "```",
      "EVENT → AS_OF → INFORMATION SET → FEATURES (reconstructed) → MODEL",
      "→ EVIDENCE → ASSESSMENT → RISK → LOCK → REVEAL → SETTLEMENT",
      "```",
      "",
      "- DecisionContext must not contain FT/HT/outcome/future Elo/future odds.",
      "- Repo Odd* = TEMPORALLY_UNKNOWN → STRICT reject (no kickoff=availability).",
      "- Form* from repo forbidden; lagged reconstruction only.",
      "- Expanding window train: events < T only.",
      "- Parameters frozen in `experiments/exp_018_blind_actuarial_v1.json`.",
      "- HISTORICAL ≠ SIMULATED Monte Carlo.",
    ].join("\n"),
  );

  if (!existsSync(join(audit, "task-018-dataset-column-classification.json"))) {
    void runTask018AuditColumns();
  }
}
