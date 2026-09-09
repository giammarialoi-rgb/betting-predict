import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { huntCsv027 } from "@/domain/eval/breakthrough-027/hunt";
import { onePageVerdict, type Task027Report } from "@/domain/eval/breakthrough-027/lab";

function dash(n: number | null | undefined): string {
  return n == null ? "—" : typeof n === "number" && !Number.isInteger(n) ? n.toFixed(4) : String(n);
}

export function renderFinalReport027(report: Task027Report): string {
  const table = [
    "| Anno | Dataset | STRICT events | Decisions | Bets | Start | End | P/L | ROI | Max DD | Brier | LogLoss | Strategy | Status |",
    "|------|---------|--------------:|----------:|-----:|------:|----:|----:|----:|-------:|------:|--------:|----------|--------|",
    ...report.annual.map((r) =>
      `| ${r.year} | ${r.dataset} | ${r.strict} | ${r.decisions} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${dash(r.brier)} | ${dash(r.logloss)} | ${r.strategy ?? "—"} | ${r.status} |`,
    ),
  ].join("\n");

  const models = report.model_scores
    .sort((a, b) => (a.brier ?? 9) - (b.brier ?? 9))
    .map((m) => `- ${m.id}: n=${m.n} Brier=${dash(m.brier)} LogLoss=${dash(m.logloss)}`)
    .join("\n");

  const ci = report.metrics.bootstrap_ci;

  return [
    onePageVerdict(report),
    "",
    table,
    "",
    "## WHAT WE FOUND",
    "",
    "Kaggle dataset `austro/beat-the-bookie-worldwide-football-dataset` v2 is a public redistribution of BeatTheBookie `odds_series` / `odds_series_b` (hourly LOCF, 32 bookmakers, 72 bins). Match files carry naive `match_datetime` without a documented timezone, so that clock is LEVEL C / TEMPORALLY_UNKNOWN and is not used as UTC.",
    "",
    "soccer-dataset `fixtures.parquet` documents `date_utc` as UTC. Unique MATCH_EXACT on calendar date + home slug + away slug, excluding midnight placeholders, plus PHP `hours_before` bins, yields LEVEL B STRICT events: quote = kickoff_utc − N hours, with N documented by `generate_odds_series_csv.php`.",
    "",
    `Production STRICT count in this run: ${report.metrics.strict_events}${report.fixture_mode ? " (FIXTURE MODE — mini CSV, not the 10k production set)" : ""}.`,
    "",
    "## WHAT WE COULD ACTUALLY USE",
    "",
    "- LEVEL B CAPITAL_STRICT: MATCH_EXACT ∧ soccer UTC kickoff SOURCE (non-midnight) ∧ PHP bin hours_before≥1 ∧ 1X2 prices>1 ∧ quote < kickoff.",
    "- Frozen model `elo` (expanding Elo from STRICT results after LOCK only), threshold 0.03 predeclared.",
    "- Primary risk `actuarial_v1` (capped Kelly). Flat / fractional Kelly / risk-capped Kelly compared; Masaniello challenger only.",
    "- Features at asOf: expanding form, Elo, frequency, rest days proxy via lastTs, market price / overround. No news FACT. No Club Odd* clocks.",
    "",
    "## WHAT REMAINS RESEARCH ONLY",
    "",
    "- BeatTheBookie naive `match_datetime` (TZ undocumented).",
    "- TilenKopac `closing_odds.csv` DATE_ONLY.",
    "- Club-Football Odd* DATE_ONLY; Form*/C_* forbidden.",
    "- soccer-dataset `odds.known_at` equals kickoff (closing).",
    "- Kaggle AH 90-match sample (license UNKNOWN, no kickoff).",
    "- Zenodo UCD DATE_ONLY.",
    "- Betfair Historic official archive (ACCESS_BLOCKED). GitHub MIRROR n=1 not licensed for capital.",
    "- 5Dollar / OddsPapi 401 (no signup).",
    "- Dropbox/Drive SQL dumps (ACCESS_BLOCKED). Wayback CDX empty.",
    "",
    "## SOURCES",
    "",
    "See `docs/task-027-source-hunt.csv`. Primary usable: Kaggle austro + soccer-dataset UTC overlay. Upstream code: Lisandro79/BeatTheBookie GPL-3.0.",
    "",
    "## TEMPORAL AUDIT",
    "",
    "- LEVEL A: not available (no documented TZ on BTB `odds_datetime`).",
    "- LEVEL B: PHP relative hours-before + soccer UTC kickoff. Z appended because soccer-dataset dictionary states UTC, not because we assumed Europe/Rome or Europe/London.",
    "- T-1h observed on STRICT rows (`hours_before=1`, PHP bin 70). T-72h does not exist (bins are 71h…0h). Sub-hour windows do not exist. No interpolation.",
    "- FT/HT/scores enter only after LOCK.",
    "",
    "## BLIND-LEAKAGE AUDIT",
    "",
    report.leakage.every((l) => l.throws)
      ? `Hostile battery: ${report.leakage.length}/${report.leakage.length} throw as required.`
      : `Hostile battery MISS: ${report.leakage.filter((l) => !l.throws).map((l) => l.id).join(", ")}`,
    `HOLDOUT_TOUCHED=${report.HOLDOUT_TOUCHED}. CLV not in DecisionContext. DATE_ONLY not promoted. Assumed TZ rejected.`,
    "",
    "## MODEL COMPARISON",
    "",
    "Diagnostic Brier/LogLoss on the walk-forward STRICT stream. Frozen capital model is `elo`. No winner from PnL. No HOLDOUT selection.",
    "",
    models || "- none",
    "",
    "## RISK COMPARISON",
    "",
    `- flat: ${report.risk.flat}`,
    `- fractional_kelly: ${report.risk.fractional_kelly}`,
    `- risk_capped_kelly: ${report.risk.risk_capped_kelly}`,
    `- actuarial_v1 (primary, not elected from PnL): ${report.risk.actuarial_v1}`,
    `- masaniello: ${report.risk.masaniello}`,
    `- rho: UNKNOWN (conservative caps only)`,
    `- winner: null`,
    "",
    "## STATISTICAL SIGNIFICANCE",
    "",
    `- bets=${report.metrics.bets} hit_rate=${dash(report.metrics.hit_rate)}`,
    `- bootstrap mean PnL/bet CI: ${ci ? `[${ci.low.toFixed(4)}, ${ci.high.toFixed(4)}] mean=${ci.mean.toFixed(4)}` : "—"}`,
    `- permutation p (sign-flip): ${dash(report.metrics.permutation_p)}`,
    `- Bonferroni α/m = ${report.scientific.multiple_testing.bonferroni.toFixed(6)} (m=${report.scientific.multiple_testing.tests})`,
    `- any_significant after correction: ${report.scientific.multiple_testing.any_significant}`,
    `- HOLDOUT STRICT bets: 0 (2015–2016 are TRAIN years; VAL/TEST/HOLDOUT have zero series coverage)`,
    "",
    "## FINAL SCIENTIFIC VERDICT",
    "",
    report.scientific_verdict,
    "",
    report.scientific_verdict === "EDGE_STATISTICALLY_SUPPORTED"
      ? "Holdout confirmation plus multiple-testing correction both passed."
      : "No scientific claim of a beatable market. MODEL_READY remains false. winner=null. real_money=false.",
    "",
    report.scientific.missing_external_input
      ? `If STRICT stayed below 100, the single missing external input would be: ${report.scientific.missing_external_input}`
      : "STRICT ≥ 100 was reached via LEVEL B overlay; VAL/TEST/HOLDOUT still have zero STRICT coverage so the result is not out-of-sample confirmed.",
    "",
  ].join("\n");
}

export function writeTask027Artifacts(report: Task027Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeFileSync(join(artifacts, "task-027-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(docs, "task-027-source-hunt.csv"), huntCsv027(report.hunt));
  writeFileSync(join(docs, "task-027-final-report.md"), renderFinalReport027(report));
}
