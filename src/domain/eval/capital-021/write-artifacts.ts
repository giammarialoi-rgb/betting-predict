import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task021Report } from "@/domain/eval/capital-021/lab";

function csv(v: string | number | boolean | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeTask021Artifacts(report: Task021Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-021-result.json"), JSON.stringify(report, null, 2));

  writeFileSync(
    join(artifacts, "task-021-annual-results.csv"),
    [
      [
        "year",
        "dataset",
        "events",
        "decisions",
        "bets",
        "start",
        "final",
        "pnl",
        "roi",
        "max_dd",
        "strategy",
        "confidence",
        "status",
        "no_bet_rate",
      ].join(","),
      ...report.annual.map((a) =>
        [
          a.year,
          a.dataset,
          a.events,
          a.decisions,
          a.bets,
          a.start,
          a.final ?? "",
          a.pnl ?? "",
          a.roi ?? "",
          a.max_dd ?? "",
          a.strategy,
          a.confidence,
          a.status,
          a.no_bet_rate ?? "",
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n") + "\n",
  );

  writeFileSync(
    join(artifacts, "task-021-market-results.csv"),
    [
      "market,lifecycle,events,bets,brier,logloss,roi,max_dd,temporally_valid,model_ready,status",
      ...report.market_rows.map((m) =>
        [
          m.market,
          m.lifecycle,
          m.events,
          m.bets,
          m.brier ?? "",
          m.logloss ?? "",
          m.roi ?? "",
          m.max_dd ?? "",
          m.temporally_valid,
          m.model_ready,
          m.status,
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n") + "\n",
  );

  writeFileSync(
    join(artifacts, "task-021-strategy-results.csv"),
    [
      "strategy,role,bets,pnl,selected_from_pnl",
      ...report.strategy_rows.map((s) =>
        [s.strategy, s.role, s.bets, s.pnl ?? "", s.selected_from_pnl].map(csv).join(","),
      ),
    ].join("\n") + "\n",
  );

  writeFileSync(
    join(artifacts, "task-021-evidence.json"),
    JSON.stringify(
      {
        sample_assessment: report.sample_assessment,
        decisions: report.decisions,
        error_freq: report.error_freq,
      },
      null,
      2,
    ),
  );

  const y = (n: number) => (n === 2026 ? "2026 YTD" : String(n));
  writeFileSync(
    join(docs, "task-021-results.md"),
    [
      "# TASK 021 — Results",
      "",
      `**Verdict: ${report.verdict}**`,
      "",
      "Timestamped sources verified (format only): The Odds API `last_update`, Betfair `pt`.",
      "Neither archive is licensed for STRICT capital in this run.",
      "",
      "```",
      report.scientific.data_available,
      `STRICT quotes: ${report.scientific.strict_quotes}`,
      `Bets: ${report.counts.bets}`,
      `winner = null`,
      "```",
      "",
      "| Anno | Dataset | Eventi | Decisioni | Bets | Inizio | Fine | P/L | ROI | Max DD | Strategia | Confidence | Stato |",
      "|------|---------|-------:|----------:|-----:|-------:|-----:|----:|----:|-------:|-----------|------------|--------|",
      ...report.annual.map(
        (a) =>
          `| ${y(a.year)} | ${a.dataset} | ${a.events} | ${a.decisions} | ${a.bets} | ${a.start} | ${a.final ?? "—"} | ${a.pnl ?? "—"} | ${a.roi ?? "—"} | ${a.max_dd ?? "—"} | ${a.strategy} | ${a.confidence} | ${a.status} |`,
      ),
      "",
      "## SCIENTIFIC VERDICT",
      "",
      `- DATA AVAILABLE: ${report.scientific.data_available}`,
      `- STRICT EVENTS: ${report.scientific.strict_events}`,
      `- STRICT QUOTES: ${report.scientific.strict_quotes}`,
      `- MODEL_READY MARKETS: ${report.scientific.model_ready_markets.join(", ") || "none"}`,
      `- YEARS TESTABLE: ${report.scientific.years_testable.join(", ") || "none"}`,
      `- YEARS INSUFFICIENT: ${report.scientific.years_insufficient.join(", ")}`,
      `- TOTAL BLIND DECISIONS: ${report.scientific.total_blind_decisions}`,
      `- TOTAL BETS: ${report.scientific.total_bets}`,
      `- PROFITABLE YEARS: none`,
      `- LOSING YEARS: none`,
      `- NO-BET YEARS: ${report.scientific.no_bet_years.join(", ")}`,
      `- BEST MODEL: null`,
      `- BEST RISK POLICY: null`,
      `- STATISTICAL SIGNIFICANCE: none`,
      `- HOLDOUT STATUS: SACRED`,
      `- AUTO-PROMOTION: FALSE`,
      `- REAL MONEY: FALSE`,
      `- NO_DEMONSTRATED_EDGE`,
      "",
    ].join("\n"),
  );
}
