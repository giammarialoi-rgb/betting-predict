import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task020Report } from "@/domain/eval/capital-020/report-types";
import type { Acquired020 } from "@/domain/eval/capital-020/lab";
import { isStrictCapitalClass } from "@/domain/eval/capital-020/temporal-gate";
import { GITHUB_REPO_AUDITS } from "@/domain/eval/capital-020/lineage";
import { SPORT_ADAPTER_STATUS } from "@/domain/eval/capital-020/snapshot";

function csv(v: string | number | boolean | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeAcquisitionArtifacts(pack: Acquired020): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const observed = [...new Set(pack.snapshots.map((s) => s.marketType))].sort();
  const exactN = pack.snapshots.filter((s) => isStrictCapitalClass(s.temporalClass)).length;
  writeFileSync(
    join(artifacts, "task-020-sources.json"),
    JSON.stringify(
      {
        lineage: pack.lineages,
        github_audits: GITHUB_REPO_AUDITS,
        live_fd: pack.acquired.liveFdStatus,
        events: pack.events.length,
        quotes: pack.snapshots.length,
        exact_timestamp: exactN,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(artifacts, "task-020-markets.csv"),
    [
      "market,observed,strict_usable",
      ...observed.map((m) =>
        [
          csv(m),
          "true",
          String(pack.snapshots.some((s) => s.marketType === m && isStrictCapitalClass(s.temporalClass))),
        ].join(","),
      ),
    ].join("\n") + "\n",
  );
  writeAcquisitionDoc(
    {
      lineage: { rows: pack.lineages, upstream_clusters: [...new Set(pack.lineages.map((r) => r.upstreamCluster))].sort() },
      github_audits: GITHUB_REPO_AUDITS,
      sport_adapters: SPORT_ADAPTER_STATUS,
      better_than_date_only: {
        found_format: true,
        format: "Betfair historic stream publishTime (pt)",
        ingested_for_capital: false,
        reason:
          "official archive is paid / ToS-restricted; public GitHub sample not licensed for STRICT capital",
      },
    },
    docs,
  );
}

export function writeTask020Artifacts(report: Task020Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-020-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(artifacts, "task-020-sources.json"),
    JSON.stringify(
      {
        lineage: report.lineage,
        github_audits: report.github_audits,
        live_fd: report.live_football_data_co_uk,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(artifacts, "task-020-decisions.json"),
    JSON.stringify(report.decisions, null, 2),
  );

  const markets = [
    ["market", "model_ready", "observed"].join(","),
    ...Object.entries(report.model_ready).map(([m, ready]) =>
      [
        m,
        ready,
        report.dataset.observed_markets.includes(m) ||
          (m === "OU25" && report.dataset.observed_markets.includes("TOTAL_GOALS")) ||
          (m === "AH" && report.dataset.observed_markets.includes("ASIAN_HANDICAP")),
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n");
  writeFileSync(join(artifacts, "task-020-markets.csv"), `${markets}\n`);

  const annual = [
    [
      "year",
      "status",
      "valid_data",
      "decisions",
      "bets",
      "start",
      "final",
      "pnl",
      "roi",
      "max_dd",
      "model",
      "reason",
    ].join(","),
    ...report.annual.map((a) =>
      [
        a.year,
        a.data_status,
        a.valid_data,
        a.decisions,
        a.bets,
        a.start,
        a.final ?? "",
        a.pnl ?? "",
        a.roi ?? "",
        a.max_dd ?? "",
        a.model,
        a.insufficient_reason ?? "",
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n");
  writeFileSync(join(artifacts, "task-020-annual-results.csv"), `${annual}\n`);

  const models = [
    [
      "period",
      "market",
      "n",
      "market_brier",
      "model_brier",
      "market_logloss",
      "model_logloss",
      "significant",
      "used_for_capital",
    ].join(","),
    ...report.model_rows.map((r) =>
      [
        r.period,
        r.market,
        r.n,
        r.market_brier ?? "",
        r.model_brier ?? "",
        r.market_logloss ?? "",
        r.model_logloss ?? "",
        r.significant,
        r.used_for_capital,
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n");
  writeFileSync(join(artifacts, "task-020-model-results.csv"), `${models}\n`);

  writeAcquisitionDoc(report, docs);
  writeProtocolDoc(docs);
  writeResultsDoc(report, docs);
  writeQualityDoc(report, docs);
}

function writeAcquisitionDoc(
  report: Pick<
    Task020Report,
    "lineage" | "github_audits" | "sport_adapters" | "better_than_date_only"
  >,
  docs: string,
): void {
  writeFileSync(
    join(docs, "task-020-historical-market-acquisition.md"),
    [
      "# TASK 020 — Historical market acquisition",
      "",
      "## Lineage (not four independent sources)",
      "",
      `Upstream clusters: ${report.lineage.upstream_clusters.join(", ")}`,
      "",
      "| sourceId | upstream | cluster | independence |",
      "|----------|----------|---------|--------------|",
      ...report.lineage.rows.map(
        (r) =>
          `| ${r.sourceId} | ${r.upstreamSource} | ${r.upstreamCluster} | ${r.independence} |`,
      ),
      "",
      "## GitHub audits",
      "",
      "| Repo | Original | Timestamps | STRICT |",
      "|------|----------|------------|--------|",
      ...report.github_audits.map(
        (g) =>
          `| ${g.repository} | ${g.original_source} | ${g.timestamps} | no |`,
      ),
      "",
      "## Sport adapters",
      "",
      ...Object.entries(report.sport_adapters).map(([s, st]) => `- ${s}: ${st}`),
      "",
      "## Better than DATE_ONLY",
      "",
      `${report.better_than_date_only.format}: found_format=${report.better_than_date_only.found_format}, ingested_for_capital=${report.better_than_date_only.ingested_for_capital}.`,
      "",
      report.better_than_date_only.reason,
      "",
    ].join("\n"),
  );
}

function writeProtocolDoc(docs: string): void {
  writeFileSync(
    join(docs, "task-020-blind-capital-protocol.md"),
    [
      "# TASK 020 — Blind capital protocol",
      "",
      "RAW → FILTER asOf → DecisionContext → features → frozen frequency model → evidence → risk → LOCK → REVEAL → settlement → bankroll.",
      "",
      "- Outcome is inaccessible before LOCK.",
      "- CLOSE never enters DecisionContext.",
      "- DATE_ONLY / DATASET_WINDOW / UNKNOWN never satisfy STRICT capital.",
      "- Bankroll starts at 1000 each solar year and does not roll.",
      "- Bankroll is clamped at 0 (never negative).",
      "- Frozen model `frequency` is predeclared before HOLDOUT.",
      "- rho = UNKNOWN → conservative same-event cap.",
      "- winner = null, real_money = false, auto_promote = false.",
      "",
    ].join("\n"),
  );
}

function writeResultsDoc(report: Task020Report, docs: string): void {
  writeFileSync(
    join(docs, "task-020-results.md"),
    [
      "# TASK 020 — Results",
      "",
      `**Verdict: ${report.verdict}**`,
      "",
      "```",
      `Events: ${report.dataset.events_normalized}`,
      `Club index: ${report.dataset.club_index}`,
      `Quotes: ${report.dataset.quotes}`,
      `Bookmakers: ${report.dataset.bookmakers}`,
      `Exact timestamp: ${report.dataset.exact_timestamp}`,
      `Date-only: ${report.dataset.date_only}`,
      `STRICT usable: ${report.dataset.strict_usable}`,
      `Markets observed: ${report.dataset.observed_markets.join(", ")}`,
      `Bets: ${report.counts.bets}`,
      `winner = null`,
      "```",
      "",
      "| Year | Valid | Decisions | Bet | Start | Final | P/L | ROI | Max DD | Model | Status |",
      "|------|------:|----------:|----:|------:|------:|----:|----:|-------:|-------|--------|",
      ...report.annual.map((a) => {
        const y = a.year === 2026 ? "2026 YTD" : String(a.year);
        return `| ${y} | ${a.valid_data} | ${a.decisions} | ${a.bets} | ${a.start} | ${a.final ?? "—"} | ${a.pnl ?? "—"} | ${a.roi ?? "—"} | ${a.max_dd ?? "—"} | ${a.model} | ${a.data_status} |`;
      }),
      "",
      "## Model vs market (research, not capital)",
      "",
      "| Period | Market | N | Market Brier | Model Brier | Significant? |",
      "|--------|--------|--:|-------------:|------------:|--------------|",
      ...report.model_rows.map(
        (r) =>
          `| ${r.period} | ${r.market} | ${r.n} | ${r.market_brier?.toFixed(4) ?? "—"} | ${r.model_brier?.toFixed(4) ?? "—"} | no |`,
      ),
      "",
    ].join("\n"),
  );
}

function writeQualityDoc(report: Task020Report, docs: string): void {
  writeFileSync(
    join(docs, "task-020-data-quality.md"),
    [
      "# TASK 020 — Data quality",
      "",
      "## Error frequencies (decision sample path)",
      "",
      ...Object.entries(report.error_freq).map(([k, v]) => `- ${k}: ${v}`),
      "",
      "## MODEL_READY",
      "",
      ...Object.entries(report.model_ready).map(
        ([m, r]) => `- ${m}: ${r ? "YES" : "NO"}`,
      ),
      "",
      `Live football-data.co.uk: ${report.live_football_data_co_uk ?? "not probed"}`,
      "",
      "Multiple testing: no cell declared significant.",
      "",
    ].join("\n"),
  );
}
