import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task019Report } from "@/domain/eval/acquisition-019/lab";

function csvEscape(v: string | number | boolean | null): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function writeTask019Artifacts(report: Task019Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-019-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(artifacts, "task-019-market-observation-matrix.json"),
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        rows: report.matrix,
      },
      null,
      2,
    ),
  );

  const annualCsv = [
    [
      "year",
      "events",
      "events_with_book_odds",
      "valid_quotes_strict",
      "valid_quotes_date",
      "markets",
      "decisions",
      "no_bet_temporal",
      "no_bet_data",
      "no_bet_model",
      "no_bet_risk",
      "bets",
      "start",
      "final",
      "pnl",
      "max_dd",
      "status",
    ].join(","),
    ...report.annual.map((a) =>
      [
        a.year,
        a.events,
        a.events_with_book_odds,
        a.valid_quotes_strict,
        a.valid_quotes_date,
        a.markets,
        a.decisions,
        a.no_bet_temporal,
        a.no_bet_data,
        a.no_bet_model,
        a.no_bet_risk,
        a.bets,
        a.start,
        a.final ?? "",
        a.pnl ?? "",
        a.max_dd ?? "",
        a.data_status,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
  writeFileSync(join(artifacts, "task-019-annual-bankroll.csv"), `${annualCsv}\n`);

  const marketCsv = [
    [
      "market",
      "events",
      "valid_observations_date",
      "valid_observations_strict",
      "books",
      "years",
      "lifecycle",
      "model_ready",
    ].join(","),
    ...report.markets.map((m) =>
      [
        m.market,
        m.events,
        m.valid_observations_date,
        m.valid_observations_strict,
        m.books,
        m.years,
        m.lifecycle,
        m.model_ready,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
  writeFileSync(join(artifacts, "task-019-market-coverage.csv"), `${marketCsv}\n`);

  const sourceCsv = [
    [
      "source",
      "role",
      "http_status",
      "acquired",
      "events",
      "observations",
      "books",
      "markets",
      "precision",
      "blocker",
    ].join(","),
    ...report.sources.map((s) =>
      [
        s.sourceId,
        s.role,
        s.http_status ?? "",
        s.acquired,
        s.events,
        s.observations,
        s.books,
        s.markets.join("|"),
        s.precision,
        s.blocker ?? "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
  writeFileSync(join(artifacts, "task-019-source-coverage.csv"), `${sourceCsv}\n`);

  const yearLines = report.annual
    .map(
      (a) =>
        `${a.year}: events=${a.events} book_events=${a.events_with_book_odds} date_quotes=${a.valid_quotes_date} strict=${a.valid_quotes_strict} decisions=${a.decisions} bets=${a.bets} status=${a.data_status}`,
    )
    .join("\n");

  const md = [
    "# TASK 019 — Historical Market Data Acquisition & Blind Actuarial Replay V1",
    "",
    "## TASK 019 VERDICT",
    "",
    `**${report.verdict}**`,
    "",
    "This task unlocks observations. It does not relax STRICT_AS_OF.",
    "",
    "```",
    `RAW EVENTS (rows+index): ${report.counts.n_raw}`,
    `NORMALIZED: ${report.counts.n_normalized}`,
    `TEMPORALLY VALID (STRICT/exact): ${report.counts.n_temporally_valid_strict}`,
    `TEMPORALLY VALID (date OPEN): ${report.counts.n_temporally_valid_date}`,
    `MODEL READY: ${report.counts.n_model_ready}`,
    `DECISIONS: ${report.counts.n_decisions}`,
    `MATCHED vs Club-Football: ${report.counts.n_matched_club}`,
    "",
    `NEW SOURCES: ${report.new_sources.join(", ") || "(none beyond offline pack)"}`,
    `NEW MARKETS: ${report.new_markets.join(", ") || "(none)"}`,
    `NEW BOOKMAKERS: ${report.new_bookmakers.join(", ") || "(none)"}`,
    "",
    yearLines,
    "",
    `TOTAL VALID BET OPPORTUNITIES (STRICT): ${report.counts.n_bets}`,
    `TOTAL NO BET: ${report.counts.n_no_bet}`,
    "",
    "BANKROLL RESULTS: not computed — INSUFFICIENT_DATA (0 STRICT quotes). Not 1000→1000.",
    "BEST PERFORMING POLICY: winner = null",
    "```",
    "",
    "## Frozen constraints",
    "",
    "- STRICT_AS_OF unchanged",
    "- No invented `available_at`",
    "- Kickoff / `Time` column is not availability",
    "- CLOSE is not pre-match",
    "- Max/Avg ≠ bookmaker",
    "- Club-Football Odd* remain RESEARCH_ONLY",
    "- HOLDOUT sacred; `winner = null`; `real_money = false`",
    "",
    "## WHAT WE ACTUALLY KNOW",
    "",
    ...report.what_we_know.map((x) => `- ${x}`),
    "",
    "## WHAT WE DO NOT KNOW",
    "",
    ...report.what_we_do_not_know.map((x) => `- ${x}`),
    "",
    "## WHAT DATA BLOCKS US",
    "",
    ...report.what_blocks_us.map((x) => `- ${x}`),
    "",
    "## WHAT WE SHOULD ACQUIRE NEXT",
    "",
    ...report.what_to_acquire_next.map((x) => `- ${x}`),
    "",
    "## Failure budget",
    "",
    "```",
    JSON.stringify(report.failure_budget, null, 2),
    "```",
    "",
    "## Researched sources (not a success metric)",
    "",
    "| Source | Languages | Result | STRICT |",
    "|--------|-----------|--------|--------|",
    ...report.researched_sources.map(
      (s) => `| ${s.sourceId} | ${s.languages.join(",")} | ${s.result} | no |`,
    ),
    "",
    "## Sample evidence (TASK 015)",
    "",
    report.sample_assessment
      ? ["```", report.sample_assessment, "```"].join("\n")
      : "_No sample assessment (no 2019 book event in this run)._",
    "",
    "## Annual table",
    "",
    "| Year | Eventi | Quote valide (STRICT) | Quote date | Mercati | Decisioni | No Bet | Start | End | P/L | Max DD | Stato |",
    "|------|-------:|----------------------:|-----------:|--------:|----------:|-------:|------:|----:|----:|-------:|-------|",
    ...report.annual.map((a) => {
      const noBet = a.no_bet_temporal + a.no_bet_data + a.no_bet_model + a.no_bet_risk;
      return `| ${a.year} | ${a.events} | ${a.valid_quotes_strict} | ${a.valid_quotes_date} | ${a.markets} | ${a.decisions} | ${noBet} | ${a.start} | — | — | — | ${a.data_status} |`;
    }),
    "",
    "## Why we did not bet",
    "",
    "| Year | Eventi | NO_BET_TEMPORAL | NO_BET_DATA | NO_BET_MODEL | NO_BET_RISK | Decisioni |",
    "|------|-------:|----------------:|------------:|-------------:|------------:|----------:|",
    ...report.annual.map(
      (a) =>
        `| ${a.year} | ${a.events} | ${a.no_bet_temporal} | ${a.no_bet_data} | ${a.no_bet_model} | ${a.no_bet_risk} | ${a.decisions} |`,
    ),
    "",
    "## Markets",
    "",
    "| Market | Events | Valid date | Valid STRICT | Books | Years | MODEL_READY |",
    "|--------|-------:|-----------:|-------------:|------:|-------|-------------|",
    ...report.markets.map(
      (m) =>
        `| ${m.market} | ${m.events} | ${m.valid_observations_date} | ${m.valid_observations_strict} | ${m.books} | ${m.years || "—"} | ${m.model_ready} |`,
    ),
    "",
  ].join("\n");

  writeFileSync(join(docs, "task-019-historical-market-acquisition-report.md"), md);
}
