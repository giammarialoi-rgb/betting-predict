import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task022Report } from "@/domain/eval/recovery-022/lab";

function csv(v: string | number | boolean | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeTask022Artifacts(report: Task022Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-022-result.json"), JSON.stringify(report, null, 2));

  writeFileSync(
    join(artifacts, "task-022-annual-results.csv"),
    [
      [
        "year",
        "dataset",
        "events",
        "strict_events",
        "decisions",
        "qualified_bets",
        "no_bets",
        "start_bankroll",
        "end_bankroll",
        "pnl",
        "roi",
        "max_drawdown",
        "win_rate",
        "avg_odds",
        "total_exposure",
        "risk_policy",
        "temporal_blocks",
        "data_quality",
        "status",
      ].join(","),
      ...report.annual.map((a) =>
        [
          a.year,
          a.dataset,
          a.events,
          a.strict_events,
          a.decisions,
          a.qualified_bets,
          a.no_bets,
          a.start_bankroll,
          a.end_bankroll ?? "",
          a.pnl ?? "",
          a.roi ?? "",
          a.max_drawdown ?? "",
          a.win_rate ?? "",
          a.avg_odds ?? "",
          a.total_exposure ?? "",
          a.risk_policy,
          a.temporal_blocks,
          a.data_quality,
          a.status,
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n") + "\n",
  );

  writeFileSync(
    join(docs, "task-022-results.md"),
    [
      "# TASK 022 — Historical odds recovery & blind capital lab",
      "",
      `**Verdict: ${report.verdict}**`,
      "",
      "BeatTheBookie was inspected from the live GitHub repository (README + PHP generators) and from an acquired `closing_odds.csv` (TilenKopac GitHub copy of the Kaggle redistribution). Dropbox returned an HTML interstitial; Kaggle zip requires login. Bulk `odds_series` TXT files were **not** acquired. Kaggle and TilenKopac are the **same upstream cluster** — not independent sources.",
      "",
      report.cluster_note,
      "",
      "```",
      report.scientific.data_available,
      `STRICT quotes: ${report.scientific.strict_quotes}`,
      `Bets: ${report.counts.bets}`,
      "winner = null",
      "```",
      "",
      "| Periodo | Eventi | Quote | Mercati | Bookmaker | Timestamp | STRICT | MODEL_READY | Stato |",
      "|---|---:|---:|---|---|---|---:|---|---|",
      ...report.periods.map(
        (p) =>
          `| ${p.period} | ${p.events} | ${p.quotes} | ${p.markets} | ${p.bookmakers} | ${p.timestamp} | ${p.strict} | no | ${p.stato} |`,
      ),
      "",
      "## Diagnostic A–G (odds_series generator + fixture)",
      "",
      `- A) Time series exists in the **generator**: yes (hourly LOCF). Bulk files acquired: **no**.`,
      `- B) Granularity: ${report.diagnostic.granularity}`,
      `- C) Absolute timestamp: **${report.diagnostic.timestamp_absolute}**`,
      `- D) Relative-to-kickoff exact (seconds): **${report.diagnostic.relative_to_kickoff_exact}** (hourly bins = APPROX)`,
      `- E) Reconstruct asOf: **${report.diagnostic.can_reconstruct_asof}** (timezone undocumented)`,
      `- F) Reconstruct first price in a file: **${report.diagnostic.can_reconstruct_first_price}** (oldest non-nan bin; LOCF may predate the 71h window)`,
      `- G) Horizons:`,
      ...report.diagnostic.horizons.map(
        (h) =>
          `  - ${h.window}: bin_exists=${h.bin_exists} reconstructable=${h.reconstructable} measured_non_nan=${h.measured_non_nan}`,
      ),
      "",
      `PHP t_* bug: ${report.diagnostic.php_t_field_bug}`,
      "",
      "## Acquisition",
      "",
      ...report.probes.map(
        (p) =>
          `- ${p.channel}: acquired=${p.acquired} status=${p.http_status ?? "n/a"} ${p.note}`,
      ),
      "",
      `closing sha256: ${report.closing.sha256 ?? "(fixture run)"}`,
      "",
      report.closing.vs_readme_880k,
      "",
      report.closing.vs_kaggle_card,
      "",
      "## Matching (STRICT uses MATCH_EXACT only)",
      "",
      `- FD events in corpus: ${report.matching.fd_events}`,
      `- Club-Football index: ${report.matching.club_events}`,
      `- OpenLigaDB: not in local corpus this run (results API only; no odds)`,
      `- MATCH_EXACT: ${report.matching.match_exact}`,
      `- MATCH_PROBABLE: ${report.matching.match_probable}`,
      `- MATCH_AMBIGUOUS: ${report.matching.match_ambiguous}`,
      `- MATCH_FAILED: ${report.matching.match_failed}`,
      "",
      "## SCIENTIFIC VERDICT",
      "",
      `- DATA AVAILABLE: ${report.scientific.data_available}`,
      `- STRICT EVENTS: ${report.scientific.strict_events}`,
      `- STRICT QUOTES: ${report.scientific.strict_quotes}`,
      `- MODEL_READY MARKETS: none`,
      `- YEARS TESTABLE: none`,
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

  writeFileSync(
    join(docs, "task-022-annual-bankroll.md"),
    [
      "# TASK 022 — Annual bankroll (solar year, start 1000, no carry)",
      "",
      "STRICT_EVENTS = 0 for every year. END_BANKROLL is **—**, never silent 1000 → 1000.",
      "",
      "| Anno | Start | Bets | No Bet | Fine | P/L | DD | Policy | Stato |",
      "|---|---:|---:|---:|---:|---:|---:|---|---|",
      ...report.annual.map(
        (a) =>
          `| ${a.year} | ${a.start_bankroll} | ${a.qualified_bets} | ${a.no_bets} | ${a.end_bankroll ?? "—"} | ${a.pnl ?? "—"} | ${a.max_drawdown ?? "—"} | ${a.risk_policy} | ${a.status} |`,
      ),
      "",
      "Risk policies compared in blind replay (all unused / 0 bets): Flat, Fractional Kelly, Risk-Capped Kelly, Actuarial V1. Masaniello = CHALLENGER. **winner = null**.",
      "",
    ].join("\n"),
  );
}
