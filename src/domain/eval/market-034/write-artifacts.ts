import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task034Report } from "@/domain/eval/market-034/lab";
import type { Challenger034 } from "@/domain/eval/market-034/types";

const H_TO_CHAL: Record<string, Challenger034> = {
  H001: "shin",
  H002: "power",
  H003: "additive",
  H004: "best_price",
  H005: "median_consensus",
  H006: "follow_steam",
};

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

function ciCell(ci: { low: number; high: number } | null | undefined): string {
  if (!ci) return "—";
  return `[${ci.low.toFixed(6)}, ${ci.high.toFixed(6)}]`;
}

export function renderFinalReport034(r: Task034Report): string {
  const ids = ["market", ...r.holm.ids];
  return [
    "# TASK 034 — FINAL VERDICT",
    "",
    `VERDICT: ${r.verdict}`,
    `STRICT_EVENTS: ${r.strict_events}`,
    `MARKET_SNAPSHOTS: ${r.market_snapshots}`,
    `HYPOTHESES: ${r.hypotheses}`,
    `SIGNIFICANT_SIGNALS: ${r.significant_signals}`,
    `BEST_SIGNAL: ${r.best_signal}`,
    `TEST_RESULT: selected_on_val=${r.selected_on_val ?? "none"}`,
    `HOLDOUT: ${r.HOLDOUT_STATUS}`,
    `COST_ROBUST: ${r.COST_ROBUST}`,
    `CLV: ${r.CLV_STATUS}`,
    `CAPITAL_QUALIFIED: ${r.CAPITAL_QUALIFIED}`,
    `WINNER: ${r.winner}`,
    `AUTO_PROMOTION: ${r.auto_promotion}`,
    `REAL_MONEY: ${r.real_money}`,
    "",
    `MARKET_EFFICIENCY: ${r.market_efficiency}`,
    `EXECUTION_COST: ${r.EXECUTION_COST}`,
    `REPRODUCIBILITY: ${r.reproducibility}`,
    `FINGERPRINT: \`${r.fingerprint}\``,
    `DATASET_SHA256: \`${r.observed_sha256}\``,
    `EXPERIMENT_SHA256: \`${r.experiment_sha256}\``,
    `HYPOTHESIS_REGISTRY_HASH: \`${r.hypothesis_registry_hash}\``,
    r.fixture_mode ? "FIXTURE MODE — run `pnpm lab:task-034` on the frozen 10.499-event file." : "",
    "",
    "## Signals vs MARKET_DEVIG (TEST)",
    "",
    "| Signal | N | Test Brier | Market Brier | Δ | CI95 | Holm | Holdout | Cost Robust | Verdict |",
    "|---|---:|---:|---:|---:|---|---:|---|---|---|",
    ...ids.map((id) => {
      const s = r.scores[id]?.TEST;
      const holmI = r.holm.ids.indexOf(id);
      const holm = holmI < 0 ? "—" : dash(r.holm.adjusted_p[holmI]);
      const mb = r.scores.market?.TEST.brier;
      return `| ${id} | ${s?.n ?? 0} | ${dash(s?.brier)} | ${dash(mb)} | ${id === "market" ? "baseline" : dash(s?.delta_brier)} | ${id === "market" ? "—" : ciCell(r.ci95[id])} | ${id === "market" ? "—" : holm} | EMPTY | ${r.COST_ROBUST} | ${r.classes[id]} |`;
    }),
    "",
    "## Inefficiency hypotheses",
    "",
    "| Hypothesis | N | Definition | Test Δ | CI95 | Holm p | Holdout | Robust | Verdict |",
    "|---|---:|---|---:|---|---:|---|---|---|",
    ...r.hypothesis_registry.map((h) => {
      const chal = H_TO_CHAL[h.id];
      const s = chal ? r.scores[chal]?.TEST : r.scores.market?.TEST;
      const hi = chal ? r.holm.ids.indexOf(chal) : -1;
      return `| ${h.id} | ${s?.n ?? 0} | ${h.definition} | ${chal ? dash(s?.delta_brier) : "—"} | ${chal ? ciCell(r.ci95[chal]) : "—"} | ${hi < 0 ? "—" : dash(r.holm.adjusted_p[hi])} | EMPTY | ${r.COST_ROBUST} | ${h.status} |`;
    }),
    "",
    "## Coverage (no interpolation)",
    "",
    ...Object.entries(r.coverage).map(([w, c]) => `- ${w}: php_possible=${c.php_possible} observed=${c.observed} coverage=${c.coverage.toFixed(4)}`),
    "",
    "T-72h and sub-hour windows are 0 on this dump. T-48/12/6/3 exist in PHP bins but were not extracted into TASK_031_BASE; they stay coverage 0 here (no new rows).",
    "Odds-ratio de-vig is NOT_IMPLEMENTED in the consensus engine and was not used as a challenger.",
    "",
    "## Final scientific conclusion",
    "",
    r.verdict === "NO_DEMONSTRATED_INEFFICIENCY"
      ? "MARKET_EFFICIENCY_SUPPORTED. No exploitable price inefficiency survived TEST + Holm + HOLDOUT-empty + cost unknown. The predictive lab remains CLOSED. No TASK 035."
      : r.verdict === "INEFFICIENCY_FOUND"
        ? "A TEST-only CANDIDATE exists. It is not promoted. HOLDOUT 2020+ is EMPTY so EDGE_CONFIRMED is impossible. CAPITAL_QUALIFIED=false. Confirmation would require a later STRICT clock, known execution cost, and robustness across bookmakers, leagues, and years."
        : "INSUFFICIENT_DATA on this run (fixture or TEST n<100).",
    "",
    "WINNER = null · AUTO_PROMOTION = false · REAL_MONEY = false",
    "",
  ].join("\n");
}

export function renderPriceDiscovery034(r: Task034Report): string {
  return [
    "# TASK 034 — Price discovery",
    "",
    "## Overround (TRAIN)",
    "",
    Object.entries(r.overround_summary)
      .map(([k, v]) => `- ${k}: ${dash(v)}`)
      .join("\n"),
    "",
    "## Cross-book (all STRICT events with ≥2 books at T-1h)",
    "",
    `- n_multi: ${r.cross_book.n_events_multi}`,
    `- mean CV home: ${dash(r.cross_book.mean_cv_home)}`,
    `- mean range home: ${dash(r.cross_book.mean_range_home)}`,
    `- mean entropy home: ${dash(r.cross_book.mean_entropy_home)}`,
    "",
    "## Favorite odds bands (TEST, market Brier)",
    "",
    "| Band | N | Brier |",
    "|---|---:|---:|",
    ...r.bands.map((b) => `| ${b.band} | ${b.n} | ${dash(b.brier)} |`),
    "",
    "## Favorite-longshot bins (TEST, all 1X2 legs)",
    "",
    "| Bin | N | Mean implied | Observed | Residual |",
    "|---:|---:|---:|---:|---:|",
    ...r.flb.map((x) => `| ${x.bin / 10}–${(x.bin + 1) / 10} | ${x.n} | ${dash(x.mean_implied)} | ${dash(x.observed)} | ${dash(x.residual)} |`),
    "",
    "## Movement patterns (frozen before TEST; T-24→T-1h only)",
    "",
    "| Pattern | N | Brier | Note |",
    "|---|---:|---:|---|",
    ...r.movement.map((m) => `| ${m.pattern} | ${m.n} | ${dash(m.brier)} | ${m.note} |`),
    "",
    `CLV: ${r.CLV_STATUS} (AS_OF = last observed pre-kickoff quote; T-24 is earlier, not close).`,
    "",
    "Best-price mixes books; it is not an executable parlay. EXECUTION_COST_UNKNOWN.",
    "",
  ].join("\n");
}

export function renderEfficiency034(r: Task034Report): string {
  return [
    "# TASK 034 — Market efficiency",
    "",
    `Verdict: ${r.verdict}`,
    `Label: ${r.market_efficiency}`,
    "",
    `Hosmer–Lemeshow (home, TEST): n=${r.hl_home.n} chi2=${dash(r.hl_home.chi2)} df=${r.hl_home.df}`,
    `Brier decomp home (TEST): brier=${dash(r.brier_decomp_home.brier)} reliability=${dash(r.brier_decomp_home.reliability)} resolution=${dash(r.brier_decomp_home.resolution)} uncertainty=${dash(r.brier_decomp_home.uncertainty)}`,
    "",
    "Permutation tests are one-sided on market_brier − challenger_brier (H1: challenger improves Brier).",
    "Holm correction is applied to the six pre-registered inferential hypotheses.",
    "HOLDOUT 2020+ = EMPTY — EDGE_CONFIRMED is impossible on this corpus.",
    "",
    "### Overround quartiles (cuts from TRAIN, scores on TEST)",
    "",
    "| Q | N | Brier |",
    "|---|---:|---:|",
    ...r.quartile_overround.map((q) => `| ${q.q} | ${q.n} | ${dash(q.brier)} |`),
    "",
    "### Dispersion quartiles (TRAIN cuts, TEST, n_books≥2)",
    "",
    "| Q | N | Brier |",
    "|---|---:|---:|",
    ...r.quartile_dispersion.map((q) => `| ${q.q} | ${q.n} | ${dash(q.brier)} |`),
    "",
    "### Conditional efficiency (ex-ante groups, TEST diagnostic, not Holm)",
    "",
    "| Group | Level | N | Brier |",
    "|---|---|---:|---:|",
    ...r.conditional
      .filter((c) => c.group !== "league" || c.n >= 20)
      .map((c) => `| ${c.group} | ${c.level} | ${c.n} | ${dash(c.brier)} |`),
    "",
    r.market_efficiency === "MARKET_EFFICIENCY_SUPPORTED"
      ? "The T-1h 1X2 book, after proportional de-vig, is not beaten by Shin, Power, additive, best-price, median consensus, or frozen steam-follow."
      : "",
    "",
    "Friction scenarios 0 / 0.5 / 1 / 2 / 3% were not executed: capital gate closed.",
    "",
  ].join("\n");
}

export function renderHypothesisDoc034(r: Task034Report): string {
  return [
    "# TASK 034 — Hypothesis registry",
    "",
    "All hypotheses were frozen in `experiments/exp_034_market_inefficiency.json` / `hypotheses.ts` before TEST.",
    "",
    `Registry hash: \`${r.hypothesis_registry_hash}\``,
    "",
    "| ID | Inferential | Definition | Status |",
    "|---|---|---|---|",
    ...r.hypothesis_registry.map((h) => `| ${h.id} | ${h.inferential} | ${h.definition} | ${h.status} |`),
    "",
  ].join("\n");
}

export function renderLineage034(r: Task034Report): string {
  return [
    "# TASK 034 — Data lineage",
    "",
    `- TASK_031_BASE SHA-256: \`${r.observed_sha256}\``,
    `- Experiment SHA-256: \`${r.experiment_sha256}\``,
    "- File: `audit/external/task-027/strict-candidates.csv` (not rewritten)",
    "- T-1h 1X2 LEVEL_B: PHP hours_before=1 + soccer-dataset UTC kickoff",
    "- T-24h overlay: `audit/external/task-030/movement-t24.csv` (same LEVEL_B clock, no interpolation)",
    "- Cross-book: `audit/external/task-029/books-t1h.csv`",
    "- CLOSE / DATE_ONLY / Club Form* / news: not in DecisionContext",
    `- Result fingerprint: \`${r.fingerprint}\``,
    "",
    "## Secondary corpora (not promoted)",
    "",
    "| Dataset | Class | Use |",
    "|---|---|---|",
    "| TASK_031_BASE 1X2 T-1h | STRICT | capital-eligible clock; this audit |",
    "| books-t1h overlay | STRICT overlay | cross-book at T-1h |",
    "| movement-t24 overlay | STRICT overlay | second pre-match timestamp |",
    "| BeatTheBookie closing_odds | DATE_ONLY | hypothesis generation only |",
    "| Club-Football | DATE_ONLY / TEMPORALLY_UNKNOWN | not STRICT |",
    "| Betfair weekly CSV | RESEARCH / UNKNOWN timezone | not STRICT |",
    "| HuggingFace oliviersportsdata sample | DATE_ONLY / closing | not STRICT |",
    "",
    "No DATE_ONLY row was promoted. No synthetic quote or timestamp was added.",
    "",
  ].join("\n");
}

export function renderAnnual034(r: Task034Report): string {
  return [
    "# TASK 034 — Annual bankroll",
    "",
    "QUALIFIED=false. BETS=0. End=—. EXECUTION_COST_UNKNOWN. No 1000→1000.",
    "",
    "| Year | Signal | N | Bets | Start | End | P/L | ROI | MaxDD | Status |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ...r.annual.map(
      (a) =>
        `| ${a.year_label} | ${a.signal} | ${a.n} | ${a.bets} | ${a.start} | ${dash(a.end)} | ${dash(a.pnl)} | ${dash(a.roi)} | ${dash(a.max_dd)} | ${a.status} |`,
    ),
    "",
  ].join("\n");
}

export function renderBlind034(r: Task034Report): string {
  return [
    "# TASK 034 — Blind lock",
    "",
    "DATA → AS_OF → PRICE FEATURES → MARKET SIGNAL → EVIDENCE → DECISION → RISK GATE → LOCK → REVEAL → SETTLEMENT",
    "",
    "The model does not see FT, HT, outcome, post-kickoff quotes, future timestamps, future lineups, or future news.",
    "TEST is not used for challenger selection. HOLDOUT 2020+ is EMPTY and was not touched.",
    `test_used_for_selection: ${r.test_used_for_selection}`,
    `HOLDOUT_TOUCHED: ${r.HOLDOUT_TOUCHED}`,
    "",
    "## Leakage battery",
    "",
    "| id | throws |",
    "|----|--------|",
    ...r.leakage.map((l) => `| ${l.id} | ${l.throws} |`),
    "",
  ].join("\n");
}

export function writeTask034Artifacts(report: Task034Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const dir = join(artifacts, "task-034");
  const docs = join(process.cwd(), "docs");
  mkdirSync(dir, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const slim = { ...report, quote_windows: undefined };
  writeFileSync(join(artifacts, "task-034-result.json"), JSON.stringify({ ...slim, quote_windows_n: report.quote_windows.length }, null, 2));
  writeFileSync(join(dir, "hypothesis_registry.json"), JSON.stringify(report.hypothesis_registry, null, 2));
  writeFileSync(join(dir, "coverage.json"), JSON.stringify(report.coverage, null, 2));
  writeFileSync(join(dir, "quote-windows.json"), JSON.stringify(report.quote_windows, null, 2));
  writeFileSync(join(dir, "scores.json"), JSON.stringify(report.scores, null, 2));
  writeFileSync(
    join(dir, "statistical-results.json"),
    JSON.stringify({ holm: report.holm, ci95: report.ci95, hl: report.hl_home, brier_decomp: report.brier_decomp_home }, null, 2),
  );
  writeFileSync(join(dir, "annual-bankroll.json"), JSON.stringify(report.annual, null, 2));
  writeFileSync(join(dir, "leakage-audit.json"), JSON.stringify(report.leakage, null, 2));
  writeFileSync(
    join(dir, "sha256.json"),
    JSON.stringify(
      {
        dataset: report.observed_sha256,
        experiment: report.experiment_sha256,
        hypothesis_registry: report.hypothesis_registry_hash,
        result: report.fingerprint,
      },
      null,
      2,
    ),
  );
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
  writeFileSync(join(docs, "task-034-final-report.md"), renderFinalReport034(report));
  writeFileSync(join(docs, "task-034-price-discovery.md"), renderPriceDiscovery034(report));
  writeFileSync(join(docs, "task-034-market-efficiency.md"), renderEfficiency034(report));
  writeFileSync(join(docs, "task-034-hypothesis-registry.md"), renderHypothesisDoc034(report));
  writeFileSync(join(docs, "task-034-data-lineage.md"), renderLineage034(report));
  writeFileSync(join(docs, "task-034-annual-bankroll.md"), renderAnnual034(report));
}
