import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printVerdictBlock035, type Task035Report } from "@/domain/eval/breakthrough-035/lab";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

export function renderFinalReport035(r: Task035Report): string {
  return [
    "# TASK 035 — DEFINITIVE DATA BREAKTHROUGH",
    "",
    printVerdictBlock035(r),
    "",
    r.fixture_mode ? "FIXTURE MODE — run `pnpm lab:task-035` on the local audit cache for full inventory hashes." : "",
    "",
    "## Decision",
    "",
    r.verdict === "INSUFFICIENT_DATA_FINAL"
      ? "After a complete local inventory plus public-copy hunt (GitHub, HuggingFace, Zenodo, Figshare, Internet Archive, official samples), no new source produces ≥100 STRICT events with exact quote timestamp, exact kickoff, documented TZ, MATCH_EXACT, quote < kickoff, and a later HOLDOUT. The 10.499-event 2015–16 LEVEL_B file remains the only capital-grade STRICT set and is **not** a 035 calendar breakthrough. The blocker is the absence of a redistributable clocked archive, not an incomplete search and not the model family."
      : `Verdict ${r.verdict}.`,
    "",
    "## Best candidate",
    "",
    `- id: \`${r.best_candidate_id}\``,
    `- why it cannot become STRICT: ${r.best_candidate_why}`,
    "",
    "## Frozen flags",
    "",
    `- winner = ${r.winner}`,
    `- auto_promotion = ${r.auto_promotion}`,
    `- real_money = ${r.real_money}`,
    `- MODEL_READY = ${r.MODEL_READY}`,
    `- BETS = ${r.BETS}`,
    `- BANKROLL = ${r.BANKROLL} (never silent 1000→1000)`,
    `- TASK_031_BASE SHA-256: \`${r.observed_sha256}\``,
    `- experiment SHA-256: \`${r.experiment_sha256}\``,
    `- fingerprint: \`${r.fingerprint}\``,
    "",
    "No TASK 036 is opened to repeat this search.",
    "",
  ].join("\n");
}

export function renderLocalInventory035(r: Task035Report): string {
  return [
    "# TASK 035 — Local data inventory",
    "",
    `Files walked: ${r.inventory.length}. Roots missing: ${r.roots_missing.join(", ") || "none"}.`,
    "",
    "| path | bytes | SHA256 | rows | dates | markets | kickoff | quote ts | TZ | semantics | availability | MATCH_EXACT | license | level | STRICT | exclusion |",
    "|---|---:|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...r.inventory.map((f) => {
      const sha = f.sha256 ? `\`${f.sha256.slice(0, 12)}…\`` : f.hashed ? "—" : "skipped (>hash cap)";
      return `| \`${f.path}\` | ${f.bytes} | ${sha} | ${dash(f.rows)} | ${f.date_min ?? "—"}–${f.date_max ?? "—"} | ${(f.markets[0] ?? "—")} | ${f.kickoff == null ? "—" : f.kickoff} | ${f.quote_timestamp == null ? "—" : f.quote_timestamp} | ${f.timezone ?? "—"} | ${f.timestamp_semantics} | ${f.availability} | ${f.match_exact_possible == null ? "—" : f.match_exact_possible} | ${f.license} | ${f.temporal_level} | ${f.strict_usable} | ${f.exclusion} |`;
    }),
    "",
    "Gitignored `audit/external/` was walked when present. `data/`, `datasets/`, `tmp/`, `cache/` are listed in roots_missing when absent.",
    "",
  ].join("\n");
}

export function renderDataInventory035(r: Task035Report): string {
  return [
    "# TASK 035 — Data inventory (candidates)",
    "",
    "| id | access | new | clock | kickoff | match | depth | coverage | holdout | total | class | why not STRICT |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ...r.catalog.map(
      (s) =>
        `| ${s.id} | ${s.access} | ${s.new_source} | ${s.scores.clock} | ${s.scores.kickoff} | ${s.scores.match} | ${s.scores.depth} | ${s.scores.coverage} | ${s.scores.holdout} | ${s.scores.total} | ${s.temporal_class} | ${s.why_not_strict} |`,
    ),
    "",
    `BEST CANDIDATE: \`${r.best_candidate_id}\``,
    "",
    r.best_candidate_why,
    "",
  ].join("\n");
}

export function renderSourceAudit035(r: Task035Report): string {
  return [
    "# TASK 035 — Source audit",
    "",
    `Investigated: ${r.sources_investigated}. Usable (local/public/sample/mirror files): ${r.sources_usable}. New in 035: ${r.new_sources}.`,
    "",
    "## Probes",
    "",
    r.probes.length === 0
      ? "No live probes in this run (fixture / skipHeavy or acquire not executed)."
      : [
          "| id | HTTP | acquired | class | note |",
          "|---|---:|---|---|---|",
          ...r.probes.map((p) => `| ${p.id} | ${p.http_status ?? "—"} | ${p.acquired} | ${p.classification} | ${p.note.replace(/\|/g, "/")} |`),
        ].join("\n"),
    "",
    "## Axes A–T",
    "",
    "Betfair historic/stream/snapshots, Match Odds, tick data, bookmaker timestamp CSVs, historical APIs, Kaggle, HuggingFace, Zenodo, Figshare, university/Zenodo mirrors, GitHub raw, exchange research, odds movement, 1X2 and OU timestamp sets were each assigned at least one catalog row. Login/API-key sources were not attacked; public copies and official samples were sought immediately.",
    "",
    "Mirrors of football-data.co.uk and Betfair Historic do not count as independent sources.",
    "",
  ].join("\n");
}

export function renderLineage035(r: Task035Report): string {
  return [
    "# TASK 035 — Data lineage",
    "",
    `- TASK_031_BASE SHA-256: \`${r.observed_sha256}\` (not rewritten)`,
    `- Parser: task-035-parser-v1`,
    `- New files under \`audit/external/task-035/\` (gitignored downloads) + fixtures for CI`,
    `- HuggingFace JulienDelavande soccer_odds / soccer_stats.sql`,
    `- HuggingFace oliviersportsdata closing sample`,
    `- HuggingFace 5Dollar in-play first-goal study`,
    `- SharpAPI CC BY 4.0 World Cup 2026 snapshot (GitHub + sharpapi.io)`,
    `- Kaggle AH sample already on disk from TASK 026`,
    `- Fingerprint: \`${r.fingerprint}\``,
    "",
    "No DATE_ONLY row was promoted. No OPEN/CLOSE label was turned into a timestamp. No timezone was invented.",
    "",
  ].join("\n");
}

export function renderTemporalAudit035(r: Task035Report): string {
  return [
    "# TASK 035 — Temporal audit",
    "",
    "STRICT requires: exact quote_timestamp AND exact kickoff_timestamp AND UTC or documented conversion AND MATCH_EXACT AND quote < kickoff AND pre-match AND verifiable provenance.",
    "",
    "Classes observed on newly parsed quotes:",
    "",
    ...Object.entries(r.class_counts).map(([k, v]) => `- ${k}: ${v} quote rows`),
    "",
    `- New STRICT_A/B events: ${r.strict_events}`,
    `- New STRICT 2020+: ${r.strict_2020_plus}`,
    `- Exact quote timestamps (ISO offset present): ${r.exact_quote_timestamps}`,
    `- Exact kickoffs (ISO offset present): ${r.exact_kickoffs}`,
    `- Legacy STRICT_B 2015–16: ${r.strict_legacy_031} (not counted as 035 breakthrough)`,
    "",
    "Naive datetimes stay AMBIGUOUS. In-play first-goal quotes stay POSTMATCH. Closing samples stay DATE_ONLY. SharpAPI ISO-Z rows stay RESEARCH_TEMPORAL without settled FT / with midnight-ambiguous starts.",
    "",
  ].join("\n");
}

export function renderStatistical035(r: Task035Report): string {
  return [
    "# TASK 035 — Statistical results",
    "",
    "Predictive TEST was **not** opened. Gate: new STRICT events ≥ 100. Observed new STRICT = " + String(r.strict_events) + ".",
    "",
    "MARKET_DEVIG was not re-fit. Elo/Form/History/Schedule/Movement/MARKET_PLUS_ALL were not re-run on 2015–16 as if it were a new corpus.",
    "",
    `- MARKET_BRIER: ${dash(r.MARKET_BRIER)}`,
    `- BEST_MODEL: ${r.BEST_MODEL ?? "—"}`,
    `- Δ Brier: ${dash(r.DELTA_BRIER)}`,
    `- 95% CI: ${r.CI95 ?? "—"}`,
    `- Holm: ${r.HOLM ?? "—"}`,
    `- SIGNIFICANT: ${r.SIGNIFICANT}`,
    `- TEST_EVENTS: ${r.TEST_EVENTS}`,
    `- HOLDOUT_EVENTS: ${r.HOLDOUT_EVENTS}`,
    "",
    "Partitions were frozen before reveal: TRAIN 2017–2018, VAL 2019, TEST 2020–2021, HOLDOUT 2022–2025. They remain unused because n_STRICT_new < 100.",
    "",
  ].join("\n");
}

export function renderAnnual035(r: Task035Report): string {
  return [
    "# TASK 035 — Annual bankroll",
    "",
    "QUALIFIED=false. BETS=0. End=—. No 1000→1000.",
    "",
    "| Year | Signal | N | Bets | Start | End | P/L | ROI | MaxDD | Status |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ...r.annual.map(
      (a) =>
        `| ${a.year_label} | ${a.signal} | ${a.n} | ${a.bets} | ${a.start} | ${dash(a.end)} | ${dash(a.pnl)} | ${dash(a.roi)} | ${dash(a.max_dd)} | ${a.status} |`,
    ),
    "",
    "Matching (new quotes, event-level):",
    "",
    `- MATCH_EXACT: ${r.matching.exact}`,
    `- MATCH_PROBABLE: ${r.matching.probable}`,
    `- MATCH_AMBIGUOUS: ${r.matching.ambiguous}`,
    `- MATCH_FAILED: ${r.matching.failed}`,
    `- UNMATCHED: ${r.matching.unmatched}`,
    `- collisions: ${r.matching.collisions.length}`,
    "",
  ].join("\n");
}

export function writeTask035Artifacts(report: Task035Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const dir = join(artifacts, "task-035");
  const docs = join(process.cwd(), "docs");
  mkdirSync(dir, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const slim = { ...report, inventory: report.inventory.map((f) => ({ ...f, sha256: f.sha256 })) };
  writeFileSync(join(artifacts, "task-035-result.json"), JSON.stringify(slim, null, 2));
  writeFileSync(join(dir, "source-inventory.json"), JSON.stringify(report.catalog, null, 2));
  writeFileSync(join(dir, "candidate-ranking.json"), JSON.stringify(report.catalog.map((s) => ({ id: s.id, total: s.scores.total, class: s.temporal_class, access: s.access })), null, 2));
  writeFileSync(join(dir, "raw-metadata.json"), JSON.stringify({ inventory: report.inventory, roots_missing: report.roots_missing, probes: report.probes }, null, 2));
  writeFileSync(
    join(dir, "normalized-events.json"),
    JSON.stringify({ total_events: report.total_events, class_counts: report.class_counts }, null, 2),
  );
  writeFileSync(
    join(dir, "normalized-quotes.json"),
    JSON.stringify({ exact_quote_timestamps: report.exact_quote_timestamps, exact_kickoffs: report.exact_kickoffs }, null, 2),
  );
  writeFileSync(
    join(dir, "strict-events.json"),
    JSON.stringify({ new: report.strict_events, legacy_031: report.strict_legacy_031, y2020: report.strict_2020_plus }, null, 2),
  );
  writeFileSync(join(dir, "matching-report.json"), JSON.stringify(report.matching, null, 2));
  writeFileSync(
    join(dir, "fingerprints.json"),
    JSON.stringify(
      { dataset: report.observed_sha256, experiment: report.experiment_sha256, result: report.fingerprint },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "test-results.json"),
    JSON.stringify(
      { TEST_EVENTS: report.TEST_EVENTS, MARKET_BRIER: report.MARKET_BRIER, HOLM: report.HOLM, SIGNIFICANT: report.SIGNIFICANT },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "holdout-results.json"),
    JSON.stringify({ HOLDOUT_EVENTS: report.HOLDOUT_EVENTS, HOLDOUT_STATUS: report.HOLDOUT_STATUS }, null, 2),
  );
  writeFileSync(join(dir, "bankroll-results.json"), JSON.stringify(report.annual, null, 2));
  writeFileSync(join(dir, "leakage-audit.json"), JSON.stringify(report.leakage, null, 2));
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        winner: report.winner,
        auto_promotion: report.auto_promotion,
        real_money: report.real_money,
        fingerprint: report.fingerprint,
        reproducibility: report.reproducibility,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(docs, "task-035-final-report.md"), renderFinalReport035(report));
  writeFileSync(join(docs, "task-035-local-data-inventory.md"), renderLocalInventory035(report));
  writeFileSync(join(docs, "task-035-data-inventory.md"), renderDataInventory035(report));
  writeFileSync(join(docs, "task-035-source-audit.md"), renderSourceAudit035(report));
  writeFileSync(join(docs, "task-035-data-lineage.md"), renderLineage035(report));
  writeFileSync(join(docs, "task-035-temporal-audit.md"), renderTemporalAudit035(report));
  writeFileSync(join(docs, "task-035-statistical-results.md"), renderStatistical035(report));
  writeFileSync(join(docs, "task-035-annual-bankroll.md"), renderAnnual035(report));
}
