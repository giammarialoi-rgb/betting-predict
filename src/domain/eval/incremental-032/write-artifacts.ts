import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task032Report } from "@/domain/eval/incremental-032/lab";
import type { ModelId032, Score032 } from "@/domain/eval/incremental-032/types";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

const LABELS: Record<ModelId032, string> = {
  market_only: "MARKET_DEVIG",
  market_elo: "MARKET+ELO",
  market_form: "MARKET+FORM",
  market_history: "MARKET+HISTORY",
  market_schedule: "MARKET+SCHEDULE",
  market_movement: "MARKET+MOVEMENT",
  market_all: "MARKET+ALL",
};

function ciCell(ci: { low: number; high: number } | null | undefined): string {
  if (!ci) return "—";
  return `[${ci.low.toFixed(6)}, ${ci.high.toFixed(6)}]`;
}

export function renderFeatureAudit032(report: Task032Report): string {
  return [
    "# TASK 032 — Feature audit",
    "",
    "Inventory of information that already exists in this repository. Nothing was invented.",
    "",
    "| feature | source | coverage | temporal basis | available_at | matchability | leakage risk | missingness | T-1h | class | motivo |",
    "|---------|--------|----------|----------------|--------------|--------------|--------------|-------------|------|-------|--------|",
    ...report.features.map(
      (f) =>
        `| ${f.feature} | ${f.source} | ${f.coverage} | ${f.temporal_basis} | ${f.available_at} | ${f.matchability} | ${f.leakage_risk} | ${f.missingness} | ${f.usable_t1h} | ${f.class} | ${f.reason} |`,
    ),
    "",
    `Feature fingerprint: \`${report.feature_fingerprint}\``,
    "",
    "G6 = elo+form+history+schedule+movement reconstructed on DATASET_031_BASE. Bookmaker disagreement was already tested in TASK 029 and is not a seventh group. News/injury/lineup/weather/ClubElo/CLOSE remain BLOCKED.",
    "",
  ].join("\n");
}

export function renderLeakageAudit032(report: Task032Report): string {
  return [
    "# TASK 032 — Leakage audit",
    "",
    "Every listed probe must HARD FAIL (throw). A miss fails the lab.",
    "",
    "| id | throws | maps to |",
    "|----|--------|---------|",
    ...report.leakage.map((l) => `| ${l.id} | ${l.throws} | ${l.id} |`),
    "",
    "A. outcome in DecisionContext",
    "B. FT/HT",
    "C. quote > asOf",
    "D. closing odds / close bin",
    "E–G. future form/Elo/H2H",
    "H. normalization fit on TEST",
    "I. imputation from TEST",
    "J. feature selection on TEST",
    "K. tuning on TEST",
    "L. HOLDOUT used for training/selection",
    "",
    `test_used_for_selection: ${report.test_used_for_selection}`,
    `HOLDOUT_TOUCHED: ${report.HOLDOUT_TOUCHED}`,
    `HOLDOUT_STATUS: ${report.HOLDOUT_STATUS}`,
    "",
  ].join("\n");
}

export function renderFinalReport032(report: Task032Report): string {
  const ids: ModelId032[] = [
    "market_only",
    "market_elo",
    "market_form",
    "market_history",
    "market_schedule",
    "market_movement",
    "market_all",
  ];
  const holmOf = (id: string) => {
    const i = report.holm.ids.indexOf(id);
    return i >= 0 ? dash(report.holm.adjusted_p[i]) : "—";
  };
  const t = (id: ModelId032): Score032 | undefined => report.scores[id]?.TEST;
  return [
    "# TASK 032 — INCREMENTAL EDGE FINAL EXPERIMENT",
    "",
    `### VERDETTO SCIENTIFICO`,
    "",
    report.verdict,
    "",
    `### MODELLO PROMOSSO`,
    "",
    `model = ${report.promoted_model ?? "null"}`,
    "",
    `### CAPITAL STATUS`,
    "",
    `QUALIFIED = ${report.qualified}`,
    "",
    `### REAL MONEY`,
    "",
    "false",
    "",
    `### AUTO PROMOTION`,
    "",
    "false",
    "",
    `DATASET: TASK_031_BASE \`${report.observed_sha256}\``,
    `STRICT_EVENTS: ${report.strict_events}`,
    `BASELINE: MARKET_DEVIG`,
    `SELECTED ON VAL: ${report.selected_on_val ?? "null"}`,
    `HOLDOUT_STATUS: ${report.HOLDOUT_STATUS} (2020+ events = ${report.holdout_2020_plus})`,
    `FEATURE FP: ${report.feature_fingerprint}`,
    `PREDICTIONS FP: ${report.predictions_fingerprint}`,
    `FINGERPRINT: ${report.fingerprint}`,
    "",
    report.fixture_mode
      ? "FIXTURE MODE — mini CSV. Production numbers require `pnpm lab:task-032`."
      : `TEST n=${report.partitions.TEST.events} · VAL n=${report.partitions.VALIDATION.events} · TRAIN n=${report.partitions.TRAIN.events}`,
    "",
    "Corpus HOLDOUT 2016 is scored only as a descriptive leftover of the 031 split. It is **not** a 2020+ HOLDOUT and was not used to confirm edge.",
    "",
    "| Modello | Test Brier | Δ vs Market | LogLoss | Δ LogLoss | 95% CI ΔBrier | Holm p | Holdout | Verdict |",
    "|---|---:|---:|---:|---:|---|---:|---|---|",
    ...ids.map((id) => {
      const s = t(id);
      const cls = report.classes[id] ?? "INCONCLUSIVE";
      return `| ${LABELS[id]} | ${dash(s?.brier)} | ${id === "market_only" ? "baseline" : dash(s?.delta_brier)} | ${dash(s?.logloss)} | ${id === "market_only" ? "baseline" : dash(s?.delta_logloss)} | ${id === "market_only" ? "—" : ciCell(report.ci95[id])} | ${id === "market_only" ? "—" : holmOf(id)} | EMPTY | ${id === "market_only" ? "BASELINE" : cls} |`;
    }),
    "",
    report.stress
      ? [
          "## Stress (VAL-selected on TEST)",
          "",
          `selected: ${report.selected_on_val}`,
          `CI95 ΔBrier (10k): ${ciCell(report.stress.ci95_delta_brier)}`,
          `CI95 ΔLogLoss (10k): ${ciCell(report.stress.ci95_delta_logloss)}`,
          `FRAGILE: ${report.stress.fragile} — ${report.stress.fragile_note}`,
          `missing-feature (x=0 → market): ΔBrier ${dash(report.stress.missing_feature_delta_brier)}`,
          "",
        ].join("\n")
      : "## Stress\n\nNo VAL-selected challenger (no group beat market on VAL).\n",
    "",
    "## Bankroll",
    "",
    report.qualified
      ? "QUALIFIED=true — economic replay would run under actuarial_v1."
      : "QUALIFIED=false. BET_COUNT=0. End = —. No silent 1000→1000.",
    "",
    "| Anno | STRICT | Bets | Start | End | P/L | ROI | Max DD | Status |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ...report.annual.map(
      (r) =>
        `| ${r.year} | ${r.strict} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.status} |`,
    ),
    "",
    "No TASK 033 is opened. The predictive lab on DATASET_031_BASE is closed if the verdict is NO_DEMONSTRATED_EDGE.",
    "",
  ].join("\n");
}

export function writeTask032Artifacts(report: Task032Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(artifacts, "task-032-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(docs, "task-032-final-report.md"), renderFinalReport032(report));
  writeFileSync(join(docs, "task-032-feature-audit.md"), renderFeatureAudit032(report));
  writeFileSync(join(docs, "task-032-leakage-audit.md"), renderLeakageAudit032(report));
}
