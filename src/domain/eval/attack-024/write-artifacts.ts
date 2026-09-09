import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task024Report } from "@/domain/eval/attack-024/lab";

function csv(v: string | number | boolean | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function cell(v: boolean | "mixed" | "equals_kickoff"): string {
  if (v === true) return "✓";
  if (v === false) return "no";
  if (v === "mixed") return "mixed";
  return "equals kickoff (not <)";
}

export function writeTask024Artifacts(report: Task024Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-024-result.json"), JSON.stringify(report, null, 2));

  const m = report.metrics;
  const ledgerMd =
    report.strict_ledger.length === 0
      ? "_No STRICT events._"
      : [
          "| Event | Competition | Kickoff UTC | Market | Bookmaker/Exchange | Quote timestamp | Δ kickoff | Outcome | STRICT | Independence |",
          "|---|---|---|---|---|---|---:|---|---|---|",
          ...report.strict_ledger.map(
            (r) =>
              `| ${r.event} | ${r.competition} | ${r.kickoff_utc} | ${r.market} | ${r.bookmaker_or_exchange} | ${r.quote_timestamp} | ${r.delta_kickoff_sec}s | ${r.outcome} | ${r.strict} | ${r.independence} |`,
          ),
        ].join("\n");

  writeFileSync(
    join(docs, "task-024-results.md"),
    [
      "# TASK 024 — Historical data attack v1",
      "",
      `**TASK 024 VERDICT: ${report.verdict}**`,
      "",
      `Success class: **${report.success}** (${report.success === "A" ? "STRICT ≥ 100" : report.success === "B" ? "STRICT < 100 but a concrete acquirable path to ≥100 is documented" : "catalog without materialized files"})`,
      "",
      "## HISTORICAL DATA ATTACK — TASK 024",
      "",
      "| Metrica | Risultato |",
      "|---|---|",
      `| Dataset realmente acquisiti | ${m.datasets_acquired} |`,
      `| Eventi totali (listed, overlapping sources) | ${m.events_listed} |`,
      `| Quote totali (listed, overlapping sources) | ${m.odds_listed} |`,
      `| Quote exact timestamp | ${m.quotes_exact_timestamp} |`,
      `| Kickoff exact | ${m.kickoff_exact} |`,
      `| Temporal relation proven | ${m.temporal_relation_proven} |`,
      `| STRICT events | ${m.strict_events} |`,
      `| Eventi rejected | ${m.events_rejected} |`,
      `| Lineage clusters | ${m.lineage_clusters} |`,
      `| Mercati STRICT | ${m.markets_strict.join(", ") || "none"} |`,
      `| Primo anno testabile | ${m.first_testable_year ?? "—"} |`,
      `| Modello testato | ${m.models_tested.join(", ") || "none"} |`,
      `| Bets cieche | ${m.blind_bets} |`,
      `| Edge dimostrato | ${m.edge_demonstrated ? "YES" : "NO"} |`,
      `| Bankroll testabile | ${m.bankroll_testable ? "YES" : "NO"} |`,
      `| Verdict | ${report.verdict} |`,
      "",
      "## PRIMARY BLOCKER",
      "",
      report.scientific.primary_blocker,
      "",
      "## NEXT ACTION",
      "",
      report.scientific.next_action,
      "",
      "```",
      report.scientific.data_available,
      `STRICT events: ${report.scientific.strict_events} (gate ${report.scientific.strict_gate})`,
      "Replay launched: false",
      "winner = null",
      "real_money = false",
      "```",
      "",
      "## Main inventory",
      "",
      "| Source | Events | Odds | Exact timestamp | Exact kickoff | Temporal relation proven | STRICT | Independence | Status |",
      "|---|---:|---:|---|---|---|---:|---|---|",
      ...report.inventory.map(
        (r) =>
          `| ${r.source} | ${r.events} | ${r.odds} | ${cell(r.exact_timestamp)} | ${cell(r.exact_kickoff)} | ${cell(r.temporal_relation_proven)} | ${r.strict} | ${r.independence} | ${r.status} |`,
      ),
      "",
      "## STRICT_EVENT_LEDGER",
      "",
      "Only `STRICT = YES` may enter the capital lab. n=1 is a method demo (GitHub MIRROR), not a 100-event official dump.",
      "",
      ledgerMd,
      "",
      "## Rejected from STRICT (why, not INSUFFICIENT_DATA as a slogan)",
      "",
      "| Reason | Events | Odds rows |",
      "|---|---:|---:|",
      ...report.rejects.map((r) => `| ${r.reason} | ${r.events} | ${r.odds_rows} |`),
      "",
      "## NEXT_DATA_BLOCKER (EIG / cost)",
      "",
      "| Rank | ID | EIG | Cost | Action |",
      "|---:|---|---|---|---|",
      ...report.next_blockers.map(
        (b) => `| ${b.rank} | ${b.id} | ${b.expected_information_gain} | ${b.acquisition_cost} | ${b.action} |`,
      ),
      "",
      "## BeatTheBookie series semantics (generator + Figure2B.m)",
      "",
      `- Bulk odds_series / odds_series_b: **${report.btb_series_acquired ? "acquired" : "NOT_ACQUIRED"}**`,
      `- Case: **${report.btb_series_case.case}** — ${report.btb_series_case.note}`,
      "- PHP: 72 hourly LOCF bins; column 0 = 71h before; column 71 = kickoff marker.",
      "- Figure2B.m MATLAB 1-indexed 67:71 = PHP 66:70 = **5h → 1h before kickoff** (kickoff column excluded).",
      "- Absolute `odds_datetime` lives in the SQL dump (not acquired). TXT files destroy it.",
      "- Timezone of `matches.date`: undocumented → no UTC `available_at`.",
      "",
      "| MATLAB 1-index | PHP 0-index | Hours before kickoff |",
      "|---:|---:|---:|",
      ...report.figure2b_bins.map((b) => `| ${b.matlab1} | ${b.php0} | ${b.relative_hours} |`),
      "",
      "## soccer-dataset (materialized parquet)",
      "",
      `- fixtures ${report.soccer.fixtures}; odds rows ${report.soccer.odds_rows}; odds fixtures ${report.soccer.odds_fixtures}`,
      `- known_at < kickoff: ${report.soccer.known_at_before}; = kickoff: ${report.soccer.known_at_eq_kickoff}; > kickoff: ${report.soccer.known_at_after}`,
      `- kickoff midnight fixtures ${report.soccer.odds_fixtures_midnight}; kickoff with clock ${report.soccer.odds_fixtures_clock}`,
      `- match_stats ${report.soccer.match_stats_rows} known_at = kickoff + ${report.soccer.match_stats_known_at_offset_sec}s (105 min) — POST_MATCH`,
      `- dictionary odds.known_at: ${report.soccer.dictionary_odds_known_at}`,
      `- sources: ${Object.entries(report.soccer.sources)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")}`,
      `- bookmaker Maximum is an aggregate label, not a book.`,
      `- The-Odds-API rows still have known_at copied to kickoff — last_update was not preserved.`,
      "",
      "Parquet hash checks:",
      "",
      ...report.soccer_files.map(
        (f) =>
          `- ${f.file}: present=${f.present} match=${f.match} bytes=${f.bytes ?? "—"} sha256=${f.sha256 ?? "—"}`,
      ),
      "",
      "## Gates",
      "",
      "| Source | EXISTS | ACQUIRED | PARSED | HAS_TS | TS_EXACT | KO_EXACT | RELATION | STRICT_USABLE | Class |",
      "|---|---|---|---|---|---|---|---|---|---|",
      ...report.gates.map(
        (g) =>
          `| ${g.sourceId} | ${g.SOURCE_EXISTS} | ${g.SOURCE_ACQUIRED} | ${g.SOURCE_PARSED} | ${g.SOURCE_HAS_TIMESTAMP} | ${g.TIMESTAMP_IS_EXACT} | ${g.KICKOFF_IS_EXACT} | ${g.TEMPORAL_RELATION_PROVEN} | ${g.STRICT_USABLE} | ${g.temporal_class} |`,
      ),
      "",
      "## Lineage clusters",
      "",
      `${report.lineage_clusters} clusters. GitHub/Kaggle/HF/Dropbox copies of the same root are not independent.`,
      "",
      ...report.lineage.map(
        (l) =>
          `- ${l.sourceId}: root=${l.lineageRoot}; upstream=${l.upstreamSources.join(" + ")}; channel=${l.distributionChannel}; class=${l.independenceClass}`,
      ),
      "",
      "## Acquisition probes",
      "",
      ...report.probes.map(
        (p) =>
          `- ${p.channel} [${p.source_class}]: acquired=${p.acquired} status=${p.http_status ?? "n/a"} ${p.note}`,
      ),
      "",
      "## Hostile leakage A–H",
      "",
      "| Attack | HARD FAIL |",
      "|---|---|",
      ...report.leakage.map((l) => `| ${l.id} | ${l.throws ? "yes" : "NO — TEST BROKEN"} |`),
      "",
      "## Annual capital (start 1000 / solar year, no carry)",
      "",
      "STRICT < 100 → no replay. END = **—**, never silent 1000 → 1000.",
      "",
      "| year | start | bets | end | status |",
      "|---:|---:|---:|---:|---|",
      ...report.annual.map(
        (a) => `| ${a.year} | ${a.start_bankroll} | ${a.bets} | ${a.end_bankroll ?? "—"} | ${a.status} |`,
      ),
      "",
      "## Evidence (TASK 015)",
      "",
      "```",
      JSON.stringify(report.assessment, null, 2),
      "```",
      "",
      "## SCIENTIFIC VERDICT",
      "",
      `- DATA AVAILABLE: ${report.scientific.data_available}`,
      `- STRICT EVENTS: ${report.scientific.strict_events}`,
      `- YEARS TESTABLE: none`,
      `- YEARS INSUFFICIENT: ${report.scientific.years_insufficient.join(", ")}`,
      `- TOTAL BETS: 0`,
      `- BEST MODEL: null`,
      `- HOLDOUT: SACRED`,
      `- AUTO-PROMOTION: FALSE`,
      `- REAL MONEY: FALSE`,
      `- ${report.verdict}`,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-024-data-inventory.csv"),
    [
      [
        "source",
        "events",
        "odds",
        "exact_timestamp",
        "exact_kickoff",
        "temporal_relation_proven",
        "strict",
        "independence",
        "status",
      ].join(","),
      ...report.inventory.map((r) =>
        [
          r.source,
          r.events,
          r.odds,
          r.exact_timestamp,
          r.exact_kickoff,
          r.temporal_relation_proven,
          r.strict,
          r.independence,
          r.status,
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n") + "\n",
  );

  writeFileSync(
    join(docs, "task-024-temporal-audit.csv"),
    [
      ["fixture_id", "kickoff", "odds_known_at", "bookmaker", "source", "delta_seconds", "temporal_class"].join(
        ",",
      ),
      ...report.temporal_audit_sample.map((r) =>
        [
          r.fixture_id,
          r.kickoff,
          r.odds_known_at,
          r.bookmaker,
          r.source,
          r.delta_seconds,
          r.temporal_class,
        ]
          .map(csv)
          .join(","),
      ),
      ...report.strict_ledger.map((r) =>
        [
          r.event,
          r.kickoff_utc,
          r.quote_timestamp,
          r.bookmaker_or_exchange,
          r.lineage_root,
          r.delta_kickoff_sec,
          "STRICT_PREMATCH",
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n") + "\n",
  );

  writeFileSync(
    join(artifacts, "task-024-strict-ledger.csv"),
    [
      [
        "event",
        "competition",
        "kickoff_utc",
        "market",
        "bookmaker_or_exchange",
        "quote_timestamp",
        "delta_kickoff_sec",
        "outcome",
        "strict",
        "independence",
      ].join(","),
      ...report.strict_ledger.map((r) =>
        [
          r.event,
          r.competition,
          r.kickoff_utc,
          r.market,
          r.bookmaker_or_exchange,
          r.quote_timestamp,
          r.delta_kickoff_sec,
          r.outcome,
          r.strict,
          r.independence,
        ]
          .map(csv)
          .join(","),
      ),
    ].join("\n") + "\n",
  );
}
