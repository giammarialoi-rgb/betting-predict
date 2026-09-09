import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task033Report } from "@/domain/eval/market-033/lab";
import type { WindowId033 } from "@/domain/eval/market-033/types";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

function winLine(w: Record<WindowId033, boolean>): string {
  return (Object.keys(w) as WindowId033[]).map((k) => `${k}=${w[k] ? "yes" : "no"}`).join(" · ");
}

export function renderFinalReport033(report: Task033Report): string {
  return [
    "# TASK 033 — FINAL VERDICT",
    "",
    `VERDICT: ${report.verdict}`,
    `STRICT_EVENTS: ${report.strict_events_1x2} (1X2 LEVEL_B) + ${report.strict_events_other} (exchange MIRROR clock, not capital)`,
    `STRICT_MARKETS: ${report.strict_markets}`,
    `MODEL_READY: ${report.model_ready_markets}`,
    `BEST_MODEL: ${report.best_model}`,
    `BEST_MARKET: ${report.best_market}`,
    `DELTA_VS_MARKET: ${dash(report.delta_vs_market)}`,
    `HOLM: n_tests=${report.holm.n_tests} (no new market reached n≥100; 1X2 not re-tested)`,
    `HOLDOUT: ${report.HOLDOUT_STATUS}`,
    `BET_COUNT: ${report.BET_COUNT}`,
    `BANKROLL: ${report.BANKROLL}`,
    `WINNER: ${report.winner}`,
    `AUTO_PROMOTION: ${report.auto_promotion}`,
    `REAL_MONEY: ${report.real_money}`,
    "",
    `FINGERPRINT: \`${report.fingerprint}\``,
    `DATASET_031_SHA256: \`${report.observed_031_sha256}\``,
    `TASK_032_FINGERPRINT: \`${report.carry_032_fingerprint}\``,
    report.fixture_mode ? "FIXTURE MODE — production numbers require `pnpm lab:task-033`." : "",
    "",
    "## 1. WHAT WE ACTUALLY HAVE",
    "",
    "- Frozen 1X2 STRICT set TASK_031_BASE: 10 499 events, T−1h, MATCH_EXACT, SHA frozen. File not copied or rewritten.",
    "- TASK 032 already showed MARKET_DEVIG unbeaten on that set (NO_DEMONSTRATED_EDGE). This task does not re-fit those models.",
    "- Betfair BASIC GitHub MIRROR: one football event (2017-04-30 Middlesbrough v Man City) with `pt` < `marketTime` (ISO-Z). Many market types, n=1.",
    "- Kaggle zygmunt/betfair-sports weekly CSV (~329 MB): many football markets, naive `FIRST_TAKEN`/`SCHEDULED_OFF`, **no timezone** → not STRICT.",
    "- BeatTheBookie odds_series / closing_odds: 1X2 only (series) or DATE_ONLY closing.",
    "- Club-Football, Zenodo UCD, football-data lineage: 1X2 + OU 2.5 + AH labels, DATE_ONLY.",
    "- soccer-dataset odds.parquet: known_at = kickoff (closing) → FORBIDDEN as DecisionContext.",
    "",
    "## 2. WHAT WAS DISCOVERED",
    "",
    `Filesystem inventory: ${report.inventory.file_count} candidate files under artifacts/audit/data/datasets/downloads/external/tmp/cache/docs. Missing roots: ${report.inventory.roots_missing.join(", ") || "none"}.`,
    "",
    "New public probes (not previously treated as SUCCESS):",
    ...report.probes.map((p) => `- ${p.id}: acquired=${p.acquired} class=${p.classification} — ${p.note}`),
    report.probes.length ? "" : "- skipped in fixture mode",
    "",
    "No additional LEVEL_A/B dump with n≥100 non-1X2 markets was physically acquired.",
    "",
    "## 3. MARKETS TESTED",
    "",
    "| Market | STRICT events | Model | Test Brier | Market Brier | Δ | CI95 | Holm p | Holdout | Verdict |",
    "|---|---:|---|---:|---:|---:|---|---:|---|---|",
    ...report.markets.map(
      (m) =>
        `| ${m.market} | ${m.strict_events} | ${m.model ?? "—"} | ${dash(m.test_brier)} | ${dash(m.market_brier)} | ${m.delta == null ? "—" : dash(m.delta)} | ${m.ci95} | ${m.holm_p} | ${m.holdout} | ${m.verdict} |`,
    ),
    "",
    "Betfair BASIC market types (MIRROR, capital_eligible=false):",
    ...report.basic.map((b) => `- ${b.market_type} (${b.family}) event=${b.event_id} prematch_ticks=${b.prematch_ticks} last_pt=${b.last_prematch_pt ?? "—"}`),
    "",
    `As-of windows on the MIRROR event (observed ticks only): ${winLine(report.windows)}`,
    "",
    "## 4. BLIND TEST",
    "",
    "1X2: TRAIN/VAL/TEST/HOLDOUT already locked in TASK 028–032. TEST was not re-opened. No model was chosen on TEST.",
    "Other markets: n<100 → MODEL_READY=false; no TEST evaluation; no staking.",
    `HOLDOUT 2020+: ${report.HOLDOUT_STATUS} (${report.holdout_2020_plus} events). Not used for confirmation.`,
    "",
    "## 5. STATISTICAL RESULTS",
    "",
    "No new Holm family. 1X2 incremental Holm from TASK 032: 0 rejections. Selected VAL model (schedule) TEST ΔBrier ≈ +0.000034, CI includes 0.",
    "Declaring edge from DATE_ONLY OU/AH Brier on Club/Zenodo is forbidden.",
    "",
    "## 6. HOLDOUT",
    "",
    "HOLDOUT_STATUS = EMPTY. The 2016 corpus leftover is not 2020+ and was not used.",
    "",
    "## 7. ANNUAL €1000 BANKROLL",
    "",
    "QUALIFIED=false. Predictive gate failed. No Kelly, no flat, no Masaniello production. End = —. Never 1000→1000.",
    "",
    "| Anno | Mercato | STRICT | Decisioni | Bets | Start | End | P/L | ROI | Max DD | Modello | Stato |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ...report.annual.map(
      (r) =>
        `| ${r.year_label} | ${r.market} | ${r.strict} | ${r.decisions} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.model ?? "—"} | ${r.status} |`,
    ),
    "",
    "## 8. LEAKAGE AUDIT",
    "",
    ...report.leakage.map((l) => `- ${l.id}: ${l.throws ? "HARD FAIL (ok)" : "MISS"}`),
    "",
    "## 9. DATA LIMITATIONS",
    "",
    "- Official Betfair Historic BASIC/Advanced remains account-gated. The GitHub sample is a MIRROR, not an independent licensed bulk.",
    "- Weekly Betfair CSV clocks have no timezone; they are not converted to UTC.",
    "- Opening/closing labels without a quote clock are not STRICT.",
    "- News/lineup/injury without a pre-kickoff timestamp stay CONTEXT_ONLY / BLOCKED.",
    "- A second independent 2020+ HOLDOUT does not exist on disk.",
    "",
    "## 10. FINAL SCIENTIFIC CONCLUSION",
    "",
    "Il mercato è il miglior benchmark osservato e non è stato battuto in modo statisticamente robusto.",
    "",
    "That does not mean the engine is useless. It means we do not have sufficient temporally valid evidence to turn it into capital.",
    "",
    "No TASK 034 is opened. The predictive laboratory on currently available STRICT data is CLOSED.",
    "",
    `WINNER = null · AUTO_PROMOTION = false · REAL_MONEY = false · REPRODUCIBILITY pending dual-run CLI.`,
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

export function renderDataLineage033(report: Task033Report): string {
  return [
    "# TASK 033 — Data lineage",
    "",
    "## Immutable 1X2 reference (not copied)",
    "",
    `- TASK_031_BASE SHA-256: \`${report.observed_031_sha256}\``,
    "- File: `audit/external/task-027/strict-candidates.csv`",
    "- Quotes expansion: `artifacts/task-031/quotes.csv` (1X2 only, EXACT_RELATIVE T−1h)",
    "- Provenance: Kaggle austro / BeatTheBookie odds_series LEVEL B + soccer-dataset UTC kickoff. Cluster: REDISTRIBUTION of Lisandro79/BeatTheBookie (GPL-3.0).",
    "",
    "## Exchange MIRROR (LEVEL_A clock, not capital)",
    "",
    "- petermclagan football-basic-sample (GitHub MIRROR of Betfair Historic BASIC)",
    "- Clock: `pt` (epoch ms) vs `marketTime` ISO-Z; timezone field Europe/London is not used to invent UTC.",
    "- Official cluster: ACCESS_BLOCKED (historicdata.betfair.com login).",
    "",
    "## Research-only (not STRICT capital)",
    "",
    "- zygmunt/betfair-sports weekly CSV: naive FIRST_TAKEN / SCHEDULED_OFF, license Other, one week, no TZ.",
    "- TilenKopac closing_odds.csv: DATE_ONLY 1X2.",
    "- Club-Football Matches.csv: DATE_ONLY 1X2/OU2.5/AH; Form*/C_* forbidden.",
    "- Zenodo 12673394: football-data lineage DATE_ONLY.",
    "- soccer-dataset odds.parquet: known_at = kickoff.",
    "- Kaggle AH 90-match sample: compact clock, kickoff absent, license UNKNOWN.",
    "",
    "## TASK 033 dataset",
    "",
    "- id: TASK_033_STRICT_MARKETS",
    "- Does not rewrite TASK 027/028/030/031 files.",
    `- Fingerprint: \`${report.fingerprint}\``,
    "",
  ].join("\n");
}

export function renderMarketAudit033(report: Task033Report): string {
  return [
    "# TASK 033 — Market audit",
    "",
    "| Market | Observed | STRICT n | Research n | Temporal | Verdict | Note |",
    "|---|---|---:|---:|---|---|---|",
    ...report.markets.map(
      (m) =>
        `| ${m.market} | ${m.observed} | ${m.strict_events} | ${m.research_events} | ${m.temporal_class} | ${m.verdict} | ${m.note} |`,
    ),
    "",
    "## Weekly Betfair (naive clock)",
    "",
    `path: ${report.weekly.path ?? "—"} · rows=${report.weekly.rows} · football_rows=${report.weekly.football_rows} · timezone_in_file=${report.weekly.timezone_in_file}`,
    "",
    "| Family | Rows | Events | FIRST_TAKEN < SCHEDULED_OFF (naive) | IN_PLAY rows |",
    "|---|---:|---:|---:|---:|",
    ...report.weekly.families.map(
      (f) => `| ${f.family} | ${f.rows} | ${f.events} | ${f.pre_off_naive} | ${f.in_play} |`,
    ),
    "",
    "Naive order is not UTC. These counts are RESEARCH_ONLY.",
    "",
  ].join("\n");
}

export function renderBlindProtocol033(report: Task033Report): string {
  return [
    "# TASK 033 — Blind protocol",
    "",
    "AS_OF → FEATURES → MARKET → MODEL → EVIDENCE → RISK GATE → LOCK → REVEAL → SETTLE",
    "",
    "- DecisionContext contains only information with available_at ≤ asOf.",
    "- FT/HT/outcome live in OutcomeContext after LOCK.",
    "- CLOSE is never in DecisionContext.",
    "- TEST locked. HOLDOUT locked. No random split.",
    "- 1X2 models were frozen in TASK 032; TASK 033 does not re-select on TEST.",
    "- Markets with n<100: MODEL_READY=false, diagnostic only.",
    "",
    "## Leakage battery",
    "",
    "| id | throws |",
    "|----|--------|",
    ...report.leakage.map((l) => `| ${l.id} | ${l.throws} |`),
    "",
    `test_used_for_selection: ${report.test_used_for_selection}`,
    `HOLDOUT_TOUCHED: ${report.HOLDOUT_TOUCHED}`,
    "",
  ].join("\n");
}

export function renderAnnual033(report: Task033Report): string {
  return [
    "# TASK 033 — Annual bankroll",
    "",
    "START = 1000 per year. NO CARRY. QUALIFIED=false → Bets=0, End=—.",
    "",
    "| Anno | Mercato | STRICT | Decisioni | Bets | Start | End | P/L | ROI | Max DD | Modello | Stato |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ...report.annual.map(
      (r) =>
        `| ${r.year_label} | ${r.market} | ${r.strict} | ${r.decisions} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.model ?? "—"} | ${r.status} |`,
    ),
    "",
    "Staking policies (flat / fractional Kelly / risk-capped Kelly / actuarial_v1) were not executed. Masaniello remains a non-production challenger.",
    "",
  ].join("\n");
}

export function writeTask033Artifacts(report: Task033Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const dir = join(artifacts, "task-033");
  const docs = join(process.cwd(), "docs");
  mkdirSync(dir, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(artifacts, "task-033-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(dir, "dataset-manifest.json"),
    JSON.stringify(
      {
        dataset_id: report.dataset_id,
        immutable_1x2_ref: {
          dataset: "TASK_031_BASE",
          sha256: report.observed_031_sha256,
          copied: false,
        },
        carry_032_fingerprint: report.carry_032_fingerprint,
        fingerprint: report.fingerprint,
        verdict: report.verdict,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "sha256.json"), JSON.stringify({ dataset_031: report.observed_031_sha256, result: report.fingerprint }, null, 2));
  writeFileSync(join(dir, "market-inventory.json"), JSON.stringify(report.markets, null, 2));
  writeFileSync(join(dir, "temporal-coverage.json"), JSON.stringify(report.windows, null, 2));
  writeFileSync(join(dir, "event-matching.json"), JSON.stringify({ basic: report.basic.map((b) => ({ id: b.event_id, market: b.market_type, family: b.family })) }, null, 2));
  writeFileSync(join(dir, "model-results.json"), JSON.stringify({ best_model: report.best_model, best_market: report.best_market, delta: report.delta_vs_market }, null, 2));
  writeFileSync(join(dir, "statistical-results.json"), JSON.stringify({ holm: report.holm, markets: report.markets }, null, 2));
  writeFileSync(join(dir, "annual-bankroll.json"), JSON.stringify(report.annual, null, 2));
  writeFileSync(join(dir, "leakage-audit.json"), JSON.stringify(report.leakage, null, 2));
  writeFileSync(join(dir, "source-provenance.json"), JSON.stringify({ probes: report.probes, weekly: report.weekly.path }, null, 2));
  writeFileSync(join(docs, "task-033-final-report.md"), renderFinalReport033(report));
  writeFileSync(join(docs, "task-033-data-lineage.md"), renderDataLineage033(report));
  writeFileSync(join(docs, "task-033-market-audit.md"), renderMarketAudit033(report));
  writeFileSync(join(docs, "task-033-blind-protocol.md"), renderBlindProtocol033(report));
  writeFileSync(join(docs, "task-033-annual-bankroll.md"), renderAnnual033(report));
}
