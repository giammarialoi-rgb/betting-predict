import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task028Report } from "@/domain/eval/validation-028/lab";
import type { Partition028, Score028 } from "@/domain/eval/validation-028/types";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4);
}

function scoreLine(s: Score028): string {
  return `n=${s.n} Brier=${dash(s.brier)} LogLoss=${dash(s.logloss)} ECE=${dash(s.ece)} slope=${dash(s.cal_slope)}`;
}

export function renderFinalReport028(report: Task028Report): string {
  const m = report.metrics;
  const annual = [
    "| Anno | STRICT | Decisions | Bets | Start € | End € | P/L € | ROI | Max DD | Brier Market | Brier Model | LogLoss Market | LogLoss Model | Status |",
    "|------|-------:|----------:|-----:|--------:|------:|------:|----:|-------:|-------------:|------------:|---------------:|--------------:|--------|",
    ...report.annual.map(
      (r) =>
        `| ${r.year} | ${r.events} | ${r.decisions} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${dash(r.brier_market)} | ${dash(r.brier_model)} | ${dash(r.logloss_market)} | ${dash(r.logloss_model)} | ${r.status} |`,
    ),
  ].join("\n");

  const period = [
    "| Periodo | Model | Bets | ROI | 95% CI | Brier | LogLoss | Adj. p | Verdict |",
    "|---------|-------|-----:|----:|--------|------:|--------:|-------:|---------|",
    `| TEST | elo (frozen) | ${report.test_capital.bets} | ${dash(report.test_capital.roi)} | ${report.test_capital.ci ? `[${report.test_capital.ci.low.toFixed(4)}, ${report.test_capital.ci.high.toFixed(4)}]` : "—"} | ${dash(m.model_brier_test)} | ${dash(m.model_logloss_test)} | ${dash(m.adjusted_p)} | ${report.verdict} |`,
    `| HOLDOUT (corpus) | elo (frozen) | ${report.holdout_capital.bets} | ${dash(report.holdout_capital.roi)} | ${report.holdout_capital.ci ? `[${report.holdout_capital.ci.low.toFixed(4)}, ${report.holdout_capital.ci.high.toFixed(4)}]` : "—"} | ${dash(report.scores.elo?.HOLDOUT.brier)} | ${dash(report.scores.elo?.HOLDOUT.logloss)} | — | confirmatory |`,
    `| HOLDOUT (project 2020+) | — | 0 | — | — | — | — | — | INSUFFICIENT_DATA |`,
  ].join("\n");

  const models = [
    "| Modello | Test Brier | Holdout Brier | Test ROI | Holdout ROI | Calibration ECE | Significant | Robust | Promotion |",
    "|---------|-----------:|--------------:|---------:|------------:|----------------:|-------------|--------|-----------|",
    ...Object.keys(report.scores).map((id) => {
      const t = report.scores[id]!.TEST;
      const h = report.scores[id]!.HOLDOUT;
      const econ = id === "elo";
      const i = report.holm.ids.indexOf(id);
      const sig = i >= 0 && report.holm.rejected[i] === true;
      return `| ${id} | ${dash(t.brier)} | ${dash(h.brier)} | ${econ ? dash(report.test_capital.roi) : "—"} | ${econ ? dash(report.holdout_capital.roi) : "—"} | ${dash(t.ece)} | ${sig} | false | false |`;
    }),
  ].join("\n");

  const abl = Object.entries(report.ablation_test)
    .map(([id, s]) => `- ${id}: ${scoreLine(s)}`)
    .join("\n");

  return [
    "# TASK 028 — SCIENTIFIC VALIDATION",
    "",
    "## FINAL VERDICT",
    "",
    `VERDICT: ${report.verdict}`,
    "",
    "DATASET:",
    `STRICT EVENTS: ${m.strict_events}`,
    "MARKETS: 1X2",
    `PERIOD: ${report.freeze.period_start ?? "—"} → ${report.freeze.period_end ?? "—"}`,
    "",
    `TEST EVENTS: ${m.test_events}`,
    `HOLDOUT EVENTS: ${m.holdout_events}`,
    "",
    `TOTAL DECISIONS: ${m.decisions}`,
    `TOTAL BETS: ${m.bets}`,
    "",
    `MARKET BRIER: ${dash(m.market_brier_test)}`,
    `MODEL BRIER: ${dash(m.model_brier_test)}`,
    "",
    `MARKET LOGLOSS: ${dash(m.market_logloss_test)}`,
    `MODEL LOGLOSS: ${dash(m.model_logloss_test)}`,
    "",
    `TEST ROI: ${dash(m.test_roi)}`,
    `HOLDOUT ROI: ${dash(m.holdout_roi)}`,
    "",
    `95% CI: ${m.ci95 ? `[${m.ci95.low.toFixed(4)}, ${m.ci95.high.toFixed(4)}]` : "—"}`,
    "",
    `ADJUSTED P-VALUE: ${dash(m.adjusted_p)}`,
    "",
    `MAX DRAWDOWN: ${dash(m.max_dd)}`,
    "",
    "BEST MODEL: null",
    "",
    "AUTO PROMOTION: false",
    "",
    "REAL MONEY: false",
    "",
    annual,
    "",
    period,
    "",
    models,
    "",
    "## CURRENT SCIENTIFIC VALUE",
    "",
    `Prediction: frozen Elo Brier on TEST is ${dash(m.model_brier_test)} vs frequency ${dash(report.scores.frequency?.TEST.brier)} and vs market ${dash(m.market_brier_test)}.`,
    "",
    `Market-relative value: market de-vig is the best probability on TEST among the predeclared set. Ablation:`,
    abl,
    "",
    `Economic value: TEST frozen-protocol ROI ${dash(m.test_roi)} on ${report.test_capital.bets} bets; corpus HOLDOUT ROI ${dash(m.holdout_roi)} on ${report.holdout_capital.bets} bets. Friction stress (TEST net ROI): ${report.friction.map((f) => `${(f.rate * 100).toFixed(1)}%→${dash(f.test_net_roi)}`).join("; ")}. EXECUTION_COST_UNKNOWN.`,
    "",
    `Statistical support: Holm–Bonferroni family=${report.holm.family} n=${report.holm.n_tests}. Elo adjusted p=${dash(m.adjusted_p)}. Block bootstrap (calendar week, seed=${report.repro.bootstrap_seed}).`,
    "",
    "Robustness: project calendar HOLDOUT 2020+ has 0 STRICT events. Corpus HOLDOUT exists but promotion requires the project holdout as well. Single snapshot T-1h only. CLV_UNAVAILABLE.",
    "",
    "Current deployability: not deployable. winner=null. real_money=false. NO_PROMOTION.",
    "",
    "Recommended action: treat the book 1X2 de-vig as the probability engine; do not spend further effort on catalog expansion to avoid NO_EDGE; do not retune on TEST/HOLDOUT.",
    "",
    "## WHAT WE KNOW",
    "",
    `- Frozen STRICT file sha256=${report.freeze.sha256} events=${report.freeze.events} fixture=${report.freeze.fixture}.`,
    `- Only T-1h quotes exist in this file. Other requested windows have coverage 0 (no interpolation).`,
    `- Logistic was fit on TRAIN only (${report.partitions.TRAIN.events} events) then frozen.`,
    "",
    "## WHAT WE DO NOT KNOW",
    "",
    "- Timezone of BeatTheBookie raw odds_datetime (LEVEL A still unavailable).",
    "- True closing line / CLV path (single snapshot).",
    "- Slippage and limits (EXECUTION_COST_UNKNOWN).",
    "- Injuries, lineups, news FACT relations.",
    "",
    "## WHAT FAILED",
    "",
    report.promotion.reasons.map((r) => `- ${r}`).join("\n"),
    "",
    "## WHAT WORKED",
    "",
    "- Temporal freeze, expanding Elo/form, de-vig benchmark, Holm correction, annual 1000 reset.",
    "- Market probabilities are well-calibrated relative to Elo/form/poisson on this corpus.",
    "",
    "## WHAT ADDS INFORMATION TO MARKET",
    "",
    Object.entries(report.ablation_test)
      .filter(([, s]) => s.brier != null && report.scores.market_devig?.TEST.brier != null && s.brier < report.scores.market_devig.TEST.brier)
      .map(([id, s]) => `- ${id} TEST Brier ${dash(s.brier)} < market ${dash(report.scores.market_devig?.TEST.brier)}`)
      .join("\n") || "- None of the predeclared ablations beat market de-vig on TEST Brier.",
    "",
    "## WHAT DOES NOT",
    "",
    "- Frozen Elo, form, poisson, frequency as replacements for the book.",
    "- Context/news/movement features: not present at asOf in this file (TEMPORAL_LIMIT / INSUFFICIENT).",
    "",
    "## WHETHER EDGE EXISTS",
    "",
    report.verdict === "NO_SIGNAL" || report.verdict === "PREDICTIVE_SIGNAL_BUT_NO_MARKET_EDGE"
      ? "No demonstrated economic edge vs available T-1h book prices under the frozen 0.03 rule."
      : `See verdict ${report.verdict}.`,
    "",
    "## WHETHER EDGE IS SIGNIFICANT",
    "",
    "No Holm rejection supporting model-better-than-market for the frozen Elo primary, and ROI CI is not a confirmed positive edge.",
    "",
    "## WHETHER EDGE SURVIVES HOLDOUT",
    "",
    "Project HOLDOUT 2020+: no data. Corpus HOLDOUT is confirmatory only and does not unlock promotion.",
    "",
    "## WHETHER EDGE IS ECONOMICALLY USABLE",
    "",
    "No.",
    "",
    "## NEXT ACTION",
    "",
    "Do not start a new acquisition task to escape this verdict. Do not retune threshold/staking on TEST or HOLDOUT. If work continues, it should be new temporally valid features with a frozen protocol — not p-hacking this file.",
    "",
  ].join("\n");
}

export function renderPartitionMd(report: Task028Report): string {
  const rows = (Object.keys(report.partitions) as Partition028[]).map((p) => {
    const x = report.partitions[p];
    return `| ${p} | ${x.start.slice(0, 10)} | ${x.end.slice(0, 10)} | ${x.events} |`;
  });
  return [
    "# TASK 028 — Data partition",
    "",
    "Temporal cuts frozen in `experiments/exp_028_scientific_validation_v1.json` before metrics.",
    "Rationale: BeatTheBookie odds_series through Feb 2016, then odds_series_b. Not sliced on ROI.",
    "",
    "| Partition | Start | End | Events |",
    "|-----------|-------|-----|-------:|",
    ...rows,
    "",
    "Project calendar HOLDOUT years 2020–2024: **0** STRICT events on this corpus.",
    "HOLDOUT (corpus) is sacred for TASK 028 model/threshold/staking selection.",
    "",
  ].join("\n");
}

export function writeTask028Artifacts(report: Task028Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(artifacts, "task-028-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(artifacts, "task-028-annual.csv"),
    [
      "year,events,decisions,bets,start,end,pnl,roi,max_dd,status",
      ...report.annual.map(
        (r) =>
          `${r.year},${r.events},${r.decisions},${r.bets},${r.start},${r.end ?? ""},${r.pnl ?? ""},${r.roi ?? ""},${r.max_dd ?? ""},${r.status}`,
      ),
    ].join("\n"),
  );
  writeFileSync(
    join(artifacts, "task-028-scores.csv"),
    [
      "model,partition,n,brier,logloss,ece,cal_slope,hit_rate",
      ...Object.entries(report.scores).flatMap(([id, by]) =>
        (Object.keys(by) as Partition028[]).map(
          (p) =>
            `${id},${p},${by[p].n},${by[p].brier ?? ""},${by[p].logloss ?? ""},${by[p].ece ?? ""},${by[p].cal_slope ?? ""},${by[p].hit_rate ?? ""}`,
        ),
      ),
    ].join("\n"),
  );
  writeFileSync(join(docs, "task-028-final-report.md"), renderFinalReport028(report));
  writeFileSync(join(docs, "task-028-data-partition.md"), renderPartitionMd(report));
  writeFileSync(
    join(docs, "task-028-methodology.md"),
    [
      "# TASK 028 — Methodology",
      "",
      `- experiment_id=${report.experiment_id}`,
      `- dataset sha256=${report.freeze.sha256}`,
      `- git=${report.git_commit ?? "unknown"}`,
      `- asOf=STRICT_AS_OF T-1h LEVEL B`,
      `- frozen_model=elo threshold=0.03 (TASK 027, not reselected)`,
      `- logistic fit=TRAIN only then freeze`,
      `- bootstrap=block ${report.repro.bootstrap_block} n=${report.repro.bootstrap_n} seed=${report.repro.bootstrap_seed}`,
      `- permutation n=${report.repro.permutation_n}`,
      `- multiple testing=${report.repro.multiple_testing} on TEST Brier(model)−Brier(market) one-sided`,
      `- de-vig=proportional (normalizeMarketProbabilities)`,
      `- CLV=not computed (single snapshot)`,
      `- random split=forbidden`,
      `- exclusions=[] (none after seeing results)`,
      `- diagnostic thresholds evaluated on VALIDATION only; frozen primary threshold=${report.repro.frozen_threshold}`,
      `- risk challengers on TEST are not used for selection (Masaniello = challenger)`,
      `- feature ablation labels require TRAIN+TEST improvement; not used to change the frozen model`,
      `- rho=UNKNOWN → conservative exposure caps (day / match / cluster hour)`,
      `- TASK 027 annual table had 8 bets because openClusterExposure never reset (bug). TASK 028 resets the cluster cap when the kickoff hour changes.`,
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(docs, "task-028-statistics.md"),
    [
      "# TASK 028 — Statistics",
      "",
      `Holm family: ${report.holm.family}`,
      `n_tests=${report.holm.n_tests}`,
      ...report.holm.ids.map(
        (id, i) => `- ${id}: raw_p=${dash(report.holm.raw_p[i])} adjusted_p=${dash(report.holm.adjusted_p[i])} rejected=${report.holm.rejected[i]}`,
      ),
      "",
      `TEST ROI CI: ${report.test_capital.ci ? JSON.stringify(report.test_capital.ci) : "—"} perm_p=${dash(report.test_capital.p)}`,
      `HOLDOUT ROI CI: ${report.holdout_capital.ci ? JSON.stringify(report.holdout_capital.ci) : "—"} perm_p=${dash(report.holdout_capital.p)}`,
      "",
      "## Stability (frozen Elo, TEST)",
      ...report.stability.year.map((s) => `- year ${s.key} n=${s.n} Brier model=${dash(s.brier_model)} market=${dash(s.brier_market)}`),
      "",
      "### Leagues (largest n)",
      ...report.stability.league_top.map((s) => `- ${s.key} n=${s.n} Brier model=${dash(s.brier_model)} market=${dash(s.brier_market)}`),
      "",
      "### Leagues (worst model Brier, n≥20)",
      ...report.stability.league_worst.map((s) => `- ${s.key} n=${s.n} Brier model=${dash(s.brier_model)} market=${dash(s.brier_market)}`),
      "",
      "## Market efficiency (TEST, not an edge claim)",
      `- favorite n=${report.efficiency.favorite.n} mean_p=${dash(report.efficiency.favorite.mean_market_p)} freq=${dash(report.efficiency.favorite.empirical_freq)}`,
      `- underdog n=${report.efficiency.underdog.n} mean_p=${dash(report.efficiency.underdog.mean_market_p)} freq=${dash(report.efficiency.underdog.empirical_freq)}`,
      ...report.efficiency.odds_range.map((b) => `- ${b.key} n=${b.n} mean_p=${dash(b.mean_market_p)} freq=${dash(b.empirical_freq)}`),
      ...report.efficiency.overround.map((b) => `- ${b.key} n=${b.n} mean_p=${dash(b.mean_market_p)} freq=${dash(b.empirical_freq)}`),
      "",
      "## VALIDATION diagnostic thresholds (not used for TEST selection)",
      ...report.diagnostic_thresholds_validation.map(
        (t) => `- threshold=${t.threshold} bets=${t.bets} ROI=${dash(t.roi)} used_for_primary=${t.used_for_primary}`,
      ),
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(docs, "task-028-model-comparison.md"),
    [
      "# TASK 028 — Model comparison",
      "",
      ...Object.entries(report.scores).flatMap(([id, by]) => [
        `## ${id}`,
        `- TRAIN ${scoreLine(by.TRAIN)}`,
        `- VALIDATION ${scoreLine(by.VALIDATION)}`,
        `- TEST ${scoreLine(by.TEST)}`,
        `- HOLDOUT ${scoreLine(by.HOLDOUT)}`,
        "",
      ]),
      "## Ablation TEST",
      ...Object.entries(report.ablation_test).map(
        ([id, s]) => `- ${id}: ${scoreLine(s)} label=${report.ablation_labels[id] ?? "UNKNOWN"}`,
      ),
      "",
      "## Risk challengers (TEST, not selected)",
      ...report.risk_challengers.map((c) => `- ${c.policy}: bets=${c.bets} ROI=${dash(c.roi)}`),
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(docs, "task-028-holdout.md"),
    [
      "# TASK 028 — Holdout",
      "",
      "Corpus HOLDOUT starts 2016-09-01. Not used for logistic, threshold, or staking.",
      `Events=${report.metrics.holdout_events} bets=${report.holdout_capital.bets} ROI=${dash(report.holdout_capital.roi)}`,
      "Project calendar HOLDOUT 2020+: 0 events. Promotion impossible.",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(docs, "task-028-annual-bankroll.md"),
    [
      "# TASK 028 — Annual bankroll",
      "",
      "START=1000 each solar year. No carry. Frozen elo + 0.03 + actuarial_v1 on all corpus partitions (in-sample TRAIN included for the annual table; TEST/HOLDOUT ROI are reported separately in the final report).",
      "",
      "| Anno | Events | Decisions | Bets | Start | End | P/L | ROI | Max DD | Status |",
      "|------|-------:|----------:|-----:|------:|----:|----:|----:|-------:|--------|",
      ...report.annual.map(
        (r) =>
          `| ${r.year} | ${r.events} | ${r.decisions} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.status} |`,
      ),
      "",
    ].join("\n"),
  );
  const errLines = (title: string, rows: Task028Report["errors"]["topLosses"]) => [
    `## ${title}`,
    "",
    ...rows.slice(0, 50).map(
      (e) =>
        `- ${e.eventId} ${e.home} vs ${e.away} [${e.partition}] class=${e.class} disagree=${e.disagreement.toFixed(3)} pnl=${dash(e.pnl)} ${e.note}`,
    ),
    "",
  ];
  writeFileSync(
    join(docs, "task-028-error-analysis.md"),
    [
      "# TASK 028 — Error analysis",
      "",
      "Causes are diagnostic labels only. News/lineup were not available; MARKET_MOVEMENT cannot be assigned (single snapshot).",
      "",
      ...errLines("Top losses", report.errors.topLosses),
      ...errLines("Largest model–market disagreement", report.errors.topDisagree),
      ...errLines("Highest-confidence failures", report.errors.topConfFail),
    ].join("\n"),
  );
}
