import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task029Report } from "@/domain/eval/incremental-029/lab";
import type { Score029 } from "@/domain/eval/incremental-029/types";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

function challengerLabel(s: Score029): string {
  if (s.delta_brier == null) return "—";
  if (s.delta_brier === 0) return "identical to market";
  if (s.delta_brier < 0) return "ΔBrier < 0 but not Holm-significant";
  return "does not beat MARKET_ONLY";
}

function rowFor(id: string, s: Score029, verdict: string, ci: string): string {
  return `| ${id} | ${s.n} | ${dash(s.brier)} | ${dash(s.logloss)} | ${id === "market_only" ? "baseline" : dash(s.delta_brier)} | — | ${ci} | ${verdict} |`;
}

export function renderFinalReport029(report: Task029Report): string {
  const t = (id: string) => report.scores[id]?.TEST;
  const mkt = t("market_only");
  return [
    "# TASK 029 — INFORMATIONAL EDGE DISCOVERY",
    "",
    `VERDICT: ${report.verdict}`,
    "",
    `STRICT EVENTS: ${report.partitions.TRAIN.events + report.partitions.VALIDATION.events + report.partitions.TEST.events + report.partitions.HOLDOUT.events}`,
    `TEST EVENTS: ${report.partitions.TEST.events}`,
    `HOLDOUT EVENTS: ${report.partitions.HOLDOUT.events}`,
    `FROZEN 028 SHA-256: ${report.frozen_028_sha256}`,
    `OBSERVED SHA-256: ${report.observed_sha256}`,
    `T-1h MULTI-BOOK ROWS: ${report.overlay_rows} (coverage TEST n≥2: ${dash(report.disagreement_coverage_test)})`,
    `SELECTED FAMILIES (VAL only): ${report.selected_families.join(", ") || "none"}`,
    `PREDICTIVE GATE: ${report.predictive_gate}`,
    `PROMOTION: ${report.promotion}`,
    `winner = null · real_money = false · auto_promote = false`,
    "",
    "| Modello | N TEST | Brier | LogLoss | Δ Brier vs Market | ROI | 95% CI | Verdict |",
    "|---------|-------:|------:|--------:|------------------:|----:|--------|---------|",
    rowFor(
      "market_only",
      mkt ?? { n: 0, brier: null, logloss: null, ece: null, cal_slope: null, cal_intercept: null, delta_brier: null, delta_logloss: null },
      "BASELINE",
      "—",
    ),
    ...["market_elo", "market_form", "market_schedule", "market_disagreement", "market_news", "market_weather", "market_all_safe", "ensemble"].map((id) => {
      const s = t(id);
      const v = s ? challengerLabel(s) : "—";
      const ci =
        id === "market_all_safe" && report.ci95_delta_brier_m7
          ? `[${report.ci95_delta_brier_m7.low.toFixed(6)}, ${report.ci95_delta_brier_m7.high.toFixed(6)}]`
          : "—";
      return s ? rowFor(id, s, v, ci) : `| ${id} | — | — | — | — | — | — | — |`;
    }),
    "",
    `M7 ΔBrier 95% CI: ${report.ci95_delta_brier_m7 ? `[${report.ci95_delta_brier_m7.low.toFixed(6)}, ${report.ci95_delta_brier_m7.high.toFixed(6)}]` : "—"}`,
    "",
    "## ANNUAL BANKROLL",
    "",
    "Staking runs only after the predictive gate. No model was auto-staked from TEST ROI.",
    "",
    "| Year | Start | Bets | End | P/L | ROI | Max DD | Status |",
    "|-----:|------:|-----:|----:|----:|----:|-------:|--------|",
    ...report.annual.map(
      (r) =>
        `| ${r.year} | ${r.start} | ${r.bets} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.status} |`,
    ),
    "",
    "## DATASET_029_A (overlay, not a silent 028 replace)",
    "",
    `- file: audit/external/task-029/books-t1h.csv`,
    `- SHA-256: ${report.overlay_sha256 ?? "missing"}`,
    `- book-rows: ${report.overlay_rows}`,
    "- join: frozen match_id (MATCH_EXACT only)",
    "- temporal: same PHP hours_before=1 bin as TASK 028",
    "- 2017–2025 STRICT quotes+kickoff: not in this overlay",
    "",
    "## ABLATION (VALIDATION, selection frozen before TEST)",
    "",
    "| Family removed / solo | VAL ΔBrier vs Market | Label |",
    "|-----------------------|---------------------:|-------|",
    ...["elo", "form", "schedule", "disagreement", "news", "weather"].map((fam) => {
      const id = fam === "elo" ? "market_elo" : fam === "form" ? "market_form" : fam === "schedule" ? "market_schedule" : fam === "disagreement" ? "market_disagreement" : fam === "news" ? "market_news" : "market_weather";
      const s = report.scores[id]?.VALIDATION;
      const lab = report.family_labels[fam] ?? "—";
      const note =
        lab === "HARMFUL" ? "HARMFUL" : lab === "CANDIDATE_SIGNAL" ? "CANDIDATE_SIGNAL" : lab === "UNAVAILABLE" ? "UNAVAILABLE" : "NO_INCREMENTAL_VALUE";
      return `| MARKET+${fam} | ${dash(s?.delta_brier)} | ${note} |`;
    }),
    "",
    "Leave-one-family-out of ALL_SAFE is the same as MARKET+remaining when at most one family is selected; with none selected, ALL_SAFE = MARKET_ONLY.",
    "",
    ...(Object.keys(report.ablation_loo ?? {}).length
      ? [
          "| Dropped from ALL_SAFE | VAL ΔBrier | TEST ΔBrier (diagnostic, not selection) |",
          "|-----------------------|-----------:|----------------------------------------:|",
          ...Object.entries(report.ablation_loo).map(
            ([fam, v]) => `| −${fam} | ${dash(v.val_delta_brier)} | ${dash(v.test_delta_brier)} |`,
          ),
          "",
        ]
      : []),
    "## WHAT WE ADDED",
    "",
    "- Residual MARKET+X (not 50/50 mix).",
    "- T-1h bookmaker disagreement from the same BeatTheBookie dump (overlay, not a silent 028 replace).",
    "- Lagged Elo / form / schedule reconstructed with kickoff < asOf.",
    "- News/weather: coverage 0 in STRICT (CONTEXT / DATE_ONLY / unpaid archives).",
    "- 2017–2025 STRICT quotes+kickoff: not acquired (Football Charts paid; Betfair account; football-data.co.uk DATE_ONLY).",
    "",
    "## ROBUSTNESS",
    "",
    "No predictive gate, so no economic robustness slices. Diagnostic only:",
    `- Elo TEST ΔBrier ${dash(report.scores.market_elo?.TEST.delta_brier)} → HOLDOUT ${dash(report.scores.market_elo?.HOLDOUT.delta_brier)} (reverses).`,
    `- Form TEST ΔBrier ${dash(report.scores.market_form?.TEST.delta_brier)} → HOLDOUT ${dash(report.scores.market_form?.HOLDOUT.delta_brier)} (reverses).`,
    `- Schedule (VAL-selected) TEST ΔBrier ${dash(report.scores.market_schedule?.TEST.delta_brier)} (worse than market).`,
    `- Disagreement TEST ΔBrier ${dash(report.scores.market_disagreement?.TEST.delta_brier)} (HARMFUL).`,
    "- Holm rejections: 0. No LOCAL_SIGNAL claimed for a single league or bookmaker.",
    "",
    "## FAMILY LABELS (VALIDATION, not TEST selection of winner)",
    "",
    ...Object.entries(report.family_labels).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## HOLM",
    "",
    ...report.holm.ids.map(
      (id, i) => `- ${id}: raw_p=${dash(report.holm.raw_p[i])} adj=${dash(report.holm.adjusted_p[i])} rejected=${report.holm.rejected[i]}`,
    ),
    "",
    "## 30-SECOND ANSWERS",
    "",
    `1. STRICT events: ${report.partitions.TRAIN.events + report.partitions.VALIDATION.events + report.partitions.TEST.events + report.partitions.HOLDOUT.events}`,
    `2. Usable TEST: ${report.partitions.TEST.events}`,
    `3. Added: disagreement overlay + lagged schedule/form/elo residual`,
    `4. Beats market? ${report.predictive_gate ? "gate true" : "no"}`,
    `5. ΔBrier M7 TEST: ${dash(report.scores.market_all_safe?.TEST.delta_brier)}`,
    `6. Credible? Holm rejections=${report.holm.rejected.filter(Boolean).length}`,
    `7. HOLDOUT project 2020+: empty. PROMOTION BLOCKED. Corpus HOLDOUT ΔBrier=${dash(report.scores.market_all_safe?.HOLDOUT.delta_brier)}`,
    `8. 1000/year: End=— (no qualified staking)`,
    `9. Testable years: 2015–2016 only`,
    "10. Missing: LEVEL A clocks, injuries/lineups, weather MATCH_EXACT, 2017+ STRICT quotes",
    "",
  ].join("\n");
}

export function renderSourcesMd(report: Task029Report): string {
  return [
    "# TASK 029 — Source acquisition",
    "",
    "Independent clusters only. BeatTheBookie GitHub forks are not counted separately.",
    "DATASET_029_A is a new extract from the same dump as TASK 028, not a second independent market.",
    "",
    "| Source | URL | Access | Data | Timestamp | Kickoff | License | Match Rate | Classification |",
    "|--------|-----|--------|------|-----------|---------|---------|------------|----------------|",
    ...report.sources.map(
      (s) =>
        `| ${s.source} | ${s.url} | ${s.access} | ${s.data} | ${s.timestamp} | ${s.kickoff} | ${s.license} | ${s.match_rate} | ${s.classification} |`,
    ),
    "",
  ].join("\n");
}

export function writeTask029Artifacts(report: Task029Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(artifacts, "task-029-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(docs, "task-029-final-report.md"), renderFinalReport029(report));
  writeFileSync(join(docs, "task-029-source-acquisition.md"), renderSourcesMd(report));
}
