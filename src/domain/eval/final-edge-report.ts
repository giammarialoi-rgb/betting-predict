import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Score030, Task030Report } from "@/domain/eval/final-edge-lab";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

function yesNo(s: Score030 | undefined, holmRejected: boolean | undefined): string {
  if (!s || s.delta_brier == null) return "—";
  if (s.delta_brier < 0 && holmRejected) return "yes";
  return "no";
}

function modelVerdict(id: string, s: Score030 | undefined, holmRejected: boolean | undefined): string {
  if (id === "market_only") return "BASELINE";
  if (!s || s.delta_brier == null) return "—";
  if (s.delta_brier < 0 && holmRejected) return "ΔBrier < 0 Holm-significant — not promoted";
  if (s.delta_brier < 0) return "ΔBrier < 0 not Holm-significant";
  if (s.delta_brier === 0) return "identical to market";
  return "does not beat MARKET";
}

export function renderFinalReport030(report: Task030Report): string {
  const t = (id: string) => report.scores[id];
  const holmOf = (id: string) => {
    const i = report.holm.ids.indexOf(id);
    return i >= 0 ? report.holm.rejected[i] : false;
  };
  const ids = [
    "market_only",
    "market_elo",
    "market_form",
    "market_history",
    "market_schedule",
    "market_movement",
    "market_all",
  ];
  return [
    "# TASK 030 — FINAL PRE-MATCH EDGE LAB",
    "",
    `VERDICT: ${report.verdict}`,
    `PRODUCTION: ${report.production}`,
    `winner = null · real_money = false · auto_promotion = false · PROMOTION = BLOCKED`,
    "",
    `STRICT EVENTS: ${report.partitions.TRAIN.events + report.partitions.VALIDATION.events + report.partitions.TEST.events + report.partitions.HOLDOUT.events}`,
    `TEST: ${report.partitions.TEST.events} · HOLDOUT: ${report.partitions.HOLDOUT.events}`,
    `FROZEN 028 SHA-256: ${report.frozen_028_sha256}`,
    `OBSERVED SHA-256: ${report.observed_sha256}`,
    `T-24h MOVEMENT ROWS: ${report.movement_rows} SHA ${report.movement_sha256 ?? "—"}`,
    `FEATURE STATUS: ${Object.entries(report.feature_status)
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ")}`,
    `SELECTED FAMILIES (VAL only): ${report.selected_families.join(", ") || "none"}`,
    `PREDICTIVE GATE: ${report.predictive_gate}`,
    `FINGERPRINT: ${report.fingerprint}`,
    "",
    "| Modello | Test Brier | Δ vs Market | Test LogLoss | Holdout Brier | Significativo | ROI | Max DD | Verdict |",
    "|---------|-----------:|------------:|-------------:|--------------:|---------------|----:|-------:|---------|",
    ...ids.map((id) => {
      const s = t(id);
      const test = s?.TEST;
      const hold = s?.HOLDOUT;
      const holm = holmOf(id);
      return `| ${id === "market_only" ? "MARKET" : id.replace("market_", "MARKET+").toUpperCase()} | ${dash(test?.brier)} | ${id === "market_only" ? "baseline" : dash(test?.delta_brier)} | ${dash(test?.logloss)} | ${dash(hold?.brier)} | ${id === "market_only" ? "—" : yesNo(test, holm)} | — | — | ${modelVerdict(id, test, holm)} |`;
    }),
    "",
    `MARKET+ALL ΔBrier 95% CI: ${report.ci95_delta_brier_all ? `[${report.ci95_delta_brier_all.low.toFixed(6)}, ${report.ci95_delta_brier_all.high.toFixed(6)}]` : "—"}`,
    "",
    "## ANNUAL BANKROLL",
    "",
    "Staking runs only after EDGE_DEMONSTRATED. No post-hoc staking search.",
    "",
    "| Anno | Start | Bets | End | P/L | ROI | Max DD | Stato |",
    "|-----:|------:|-----:|----:|----:|----:|-------:|--------|",
    ...report.annual.map(
      (r) =>
        `| ${r.year} | ${r.start} | ${r.bets} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.status} |`,
    ),
    "",
    "### VERDETTO SCIENTIFICO",
    "",
    report.verdict,
    "",
    "## HOLM (TEST ΔBrier market − model, one-sided)",
    "",
    ...report.holm.ids.map(
      (id, i) =>
        `- ${id}: raw_p=${dash(report.holm.raw_p[i])} adj=${dash(report.holm.adjusted_p[i])} rejected=${report.holm.rejected[i]}`,
    ),
    "",
    "## 12 ANSWERS",
    "",
    `1. Beat the market with available STRICT information? **${report.verdict === "EDGE_DEMONSTRATED" ? "yes" : "no"}**`,
    `2. Incremental family selected on VAL: ${report.selected_families.join(", ") || "none"}`,
    `3. ΔBrier MARKET+ALL TEST: ${dash(report.scores.market_all?.TEST.delta_brier)}`,
    `4. ΔLogLoss MARKET+ALL TEST: ${dash(report.scores.market_all?.TEST.delta_logloss)}`,
    `5. Holm-significant? ${report.holm.rejected.some(Boolean) ? "at least one raw rejection" : "no"}`,
    `6. HOLDOUT ΔBrier ALL: ${dash(report.scores.market_all?.HOLDOUT.delta_brier)} · project 2020+ empty`,
    "7. Economic value? not staked (gate failed or no bets)",
    "8. Capital per year: End = — (no qualified bets)",
    "9. Drawdown: —",
    `10. Declare an edge? **${report.verdict}**`,
    `11. Production: **${report.production}**`,
    "12. Missing for a real claim: LEVEL A quote clocks, MATCH_EXACT injuries/lineups, 2017–2025 STRICT quotes+kickoff, 2020+ HOLDOUT",
    "",
  ].join("\n");
}

export function renderLineage030(report: Task030Report): string {
  return [
    "# TASK 030 — Data lineage",
    "",
    "No new independent market. No ClubElo in STRICT. No silent replace of TASK 028.",
    "",
    "| Artifact | SHA-256 / id | Role | Temporal |",
    "|----------|--------------|------|----------|",
    `| TASK 028 STRICT CSV | ${report.observed_sha256} | 1X2 T-1h LEVEL B MATCH_EXACT | PHP hours_before=1 DERIVED |`,
    `| Frozen SHA required | ${report.frozen_028_sha256} | integrity | immutable |`,
    `| T-24h overlay DATASET_030 | ${report.movement_sha256 ?? "missing"} | movement vs T-1h, same dump | PHP hours_before=24, no interpolation, never bin 0 |`,
    "| ClubElo | not used | DATE_ONLY B_RESEARCH | excluded from capital |",
    "| Feature clocks | kickoff < asOf | lagged Elo/form/H2H/schedule | HARD FAIL if availableAt > asOf |",
    "",
    `Partitions: TRAIN ${report.partitions.TRAIN.events} · VAL ${report.partitions.VALIDATION.events} · TEST ${report.partitions.TEST.events} · HOLDOUT ${report.partitions.HOLDOUT.events}`,
    "",
    "Residual model: z_k = log(p_market_k) + W_k · x. Weights fit on TRAIN only. ALL families chosen on VALIDATION Brier only.",
    "",
  ].join("\n");
}

export function writeTask030Artifacts(report: Task030Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(artifacts, "task-030-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(docs, "task-030-final-report.md"), renderFinalReport030(report));
  writeFileSync(join(docs, "task-030-data-lineage.md"), renderLineage030(report));
}
