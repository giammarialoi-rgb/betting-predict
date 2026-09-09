import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { quotesForEvents } from "@/domain/eval/breakthrough-031/canonical";
import { TASK031_ARTIFACTS_DIR } from "@/domain/eval/breakthrough-031/config";
import { freezeDataset031Base } from "@/domain/eval/breakthrough-031/freeze";
import type { Task031Report } from "@/domain/eval/breakthrough-031/lab";
import type { Score030 } from "@/domain/eval/final-edge-lab";

function dash(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6);
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function modelVerdict(id: string, s: Score030 | undefined, holmRejected: boolean | undefined): string {
  if (id === "market_only") return "BASELINE";
  if (!s || s.delta_brier == null) return "—";
  if (s.delta_brier < 0 && holmRejected) return "ΔBrier < 0 Holm-significant — not promoted";
  if (s.delta_brier < 0) return "ΔBrier < 0 not Holm-significant";
  if (s.delta_brier === 0) return "identical to market";
  return "does not beat MARKET";
}

export function renderAnnualBankroll031(report: Task031Report): string {
  return [
    "# TASK 031 — Annual bankroll",
    "",
    "Start = 1000 credits per solar year. No carry. No silent 1000→1000.",
    "Staking runs only if MODEL_READY and the frozen TASK 030 predictive gate passes.",
    `MODEL_READY=${report.model_ready} · CAPITAL_TEST=${report.capital_test} · predictive_gate=${report.predictive_gate}`,
    "",
    "| Anno | STRICT | Decisioni | Bets | Start | End | P/L | ROI | Max DD | Modello | Stato |",
    "|------|-------:|----------:|-----:|------:|----:|----:|----:|--------:|---------|-------|",
    ...report.annual.map(
      (r) =>
        `| ${r.year}${r.year === 2026 ? " YTD" : ""} | ${r.strict} | ${r.decisions} | ${r.bets} | ${r.start} | ${dash(r.end)} | ${dash(r.pnl)} | ${dash(r.roi)} | ${dash(r.max_dd)} | ${r.model ?? "—"} | ${r.status} |`,
    ),
    "",
  ].join("\n");
}

export function renderSourceAudit031(report: Task031Report): string {
  return [
    "# TASK 031 — Source audit",
    "",
    "| SOURCE | URL | DATASET | LICENSE | EVENTS | QUOTES | MARKETS | BOOKMAKERS | KICKOFF | QUOTE_TIMESTAMP | TIMESTAMP_TYPE | TIMEZONE | MATCHING | STRICT_EVENTS | STATUS | SHA256 | LEVEL |",
    "|--------|-----|---------|---------|-------:|-------:|---------|------------|---------|-----------------|----------------|----------|----------|--------------:|--------|--------|-------|",
    ...report.sources.map((s) => {
      const sha = s.sha256 ? s.sha256.slice(0, 16) + "…" : "—";
      return `| ${s.source} | ${s.url} | ${s.dataset} | ${s.license} | ${dash(s.events)} | ${dash(s.quotes)} | ${s.markets} | ${s.bookmakers} | ${s.kickoff} | ${s.quote_timestamp} | ${s.timestamp_type} | ${s.timezone} | ${s.matching} | ${s.strict_events} | ${s.status} | ${sha} | ${s.level} |`;
    }),
    "",
    "## Probes",
    "",
    ...report.probes.map(
      (p) =>
        `- ${p.channel}: HTTP ${p.http_status ?? "err"} acquired=${p.acquired} bytes=${p.bytes} sha=${p.sha256?.slice(0, 12) ?? "—"}`,
    ),
    "",
    "## Residual blockers for 2020+ STRICT",
    "",
    "1. Betfair Historic BASIC: LEVEL_A format (pt + marketTime) but ACCOUNT_REQUIRED. Credentials not used. BASIC is listed free of charge after login; login was not performed.",
    "2. OddsPapi `/v4/historical-odds`: examples use UTC `createdAt`, but API_KEY_REQUIRED and docs state history from January 2026 only — not 2015–2025.",
    "3. 5DollarFootballAPI `/odds/history`: paid $5/mo + key. Public HF sample has kickoff_utc but opening/closing labels without quote clocks.",
    "4. Football Charts: paid €199. Not purchased.",
    "5. football-data.co.uk / Zenodo 12673394 / Club-Football: DATE_ONLY or collection-window. Not T-1h.",
    "6. JulienDelavande soccer_odds.csv: ~80 quote rows, timezone-naive commence_time / last_update; datetime_insert is post-match.",
    "",
  ].join("\n");
}

export function renderLineage031(report: Task031Report): string {
  return [
    "# TASK 031 — Data lineage",
    "",
    "DATASET_031_BASE is the frozen TASK 028 STRICT file. New rows may only be appended. The base file is not rewritten.",
    "",
    "| Artifact | SHA-256 / id | Role | Temporal | STRICT |",
    "|----------|--------------|------|----------|--------|",
    `| DATASET_031_BASE | ${report.observed_base_sha256} | frozen 10.499 T-1h 1X2 | LEVEL_B EXACT_RELATIVE PHP hours_before=1 | ${report.fixture_mode ? "fixture" : report.strict_events} |`,
    `| Frozen SHA required | ${report.frozen_028_sha256} | integrity | immutable | yes |`,
    `| DATASET_031_ADD | none | no LEVEL_A/B public append | — | ${report.added_strict_events} |`,
    `| union fingerprint | ${report.union_fingerprint} | base + added ids | — | ${report.strict_events} |`,
    `| TASK 030 fingerprint | ${report.task_030_fingerprint} | frozen residual MARKET+X | STRICT_AS_OF T-1h | replay |`,
    "",
    `Period STRICT: ${report.period_start ?? "—"} → ${report.period_end ?? "—"}`,
    `HOLD OUT calendar 2020+: ${report.holdout_2020_plus} events`,
    `Corpus partitions (unchanged from TASK 030): TRAIN ${report.partitions.TRAIN.events} · VAL ${report.partitions.VALIDATION.events} · TEST ${report.partitions.TEST.events} · HOLDOUT ${report.partitions.HOLDOUT.events}`,
    "",
    "Matching: MATCH_EXACT only (unique calendar date + home slug + away slug). MATCH_AMBIGUOUS / MATCH_PROBABLE / MATCH_FAILED never enter STRICT.",
    "",
    "DecisionContext(asOf=kickoff−1h) sees only quote_timestamp ≤ asOf. FT/HT/outcome are settlement-only after LOCK/REVEAL.",
    "",
  ].join("\n");
}

export function renderFinalReport031(report: Task031Report): string {
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
    "# TASK 031 — FINAL DATA BREAKTHROUGH / STRICT CAPITAL REPLAY",
    "",
    `FINAL VERDICT: ${report.verdict}`,
    `MODEL_READY: ${report.model_ready}`,
    `CAPITAL_TEST: ${report.capital_test}`,
    `STRICT_EVENTS: ${report.strict_events}`,
    `ADDED_STRICT: ${report.added_strict_events}`,
    `WINNER: ${report.winner}`,
    `REAL_MONEY: ${report.real_money}`,
    `AUTO_PROMOTION: ${report.auto_promotion}`,
    `PREDICTIVE_GATE (frozen TASK 030): ${report.predictive_gate}`,
    `TASK 030 VERDICT: ${report.task_030_verdict}`,
    `FINGERPRINT: ${report.fingerprint}`,
    "",
    report.fixture_mode
      ? "FIXTURE MODE — mini CSV. Production numbers require `pnpm task:031` with the frozen 10.499-event file on disk."
      : `DATASET_031_BASE SHA-256: ${report.observed_base_sha256}`,
    "",
    "## COSA ABBIAMO DAVVERO",
    "",
    `1. DATASET DISPONIBILE: frozen BeatTheBookie/Kaggle austro T-1h overlay + research files (Julien sample, 5dollar opening/closing, football-data DATE_ONLY).`,
    `2. DATASET STRICT: ${report.strict_events} events LEVEL_B MATCH_EXACT 1X2 T-1h (${report.period_start ?? "—"} → ${report.period_end ?? "—"}).`,
    `3. DATASET RESEARCH: Julien naive TZ (${report.sources.find((s) => s.cluster === "julien-hf-odds-api-sample")?.events ?? 0} matches), 5dollar opening/closing (${report.sources.find((s) => s.cluster === "5dollar-hf-sample")?.events ?? 0} fixtures), football-data/Zenodo/Club-Football DATE_ONLY.`,
    `4. MODEL_READY: ${report.model_ready}`,
    `5. ANNI TESTABILI: ${report.years_testable.join(", ") || "none"}`,
    `6. ANNI NON TESTABILI: ${report.years_not_testable.join(", ")}`,
    `7. BET REALMENTE ESEGUITE NEL REPLAY: ${report.annual.reduce((a, r) => a + r.bets, 0)}`,
    `8. P/L: — (no stakes; gate ${report.predictive_gate ? "open" : "closed"})`,
    `9. EDGE: no demonstrated edge vs MARKET_DEVIG (TASK 030 frozen residual; Holm 0 rejections on TEST).`,
    `10. SIGNIFICATIVITÀ: Holm-Bonferroni on TEST ΔBrier; see table. 95% CI MARKET+ALL: ${report.ci95_delta_brier_all ? `[${report.ci95_delta_brier_all.low.toFixed(6)}, ${report.ci95_delta_brier_all.high.toFixed(6)}]` : "—"}`,
    "11. LIMITAZIONI: no 2020+ STRICT quotes+kickoff publicly acquired without account/key/purchase; DATE_ONLY sources not promoted; Julien TZ not invented; TASK 030 model not retuned on TEST/HOLDOUT.",
    "",
    "## Models vs MARKET_DEVIG (frozen TASK 030, TEST)",
    "",
    "| Modello | Test Brier | Δ vs Market | Test LogLoss | Holdout Brier | Holm | Verdict |",
    "|---------|-----------:|------------:|-------------:|--------------:|------|---------|",
    ...ids.map((id) => {
      const test = t(id)?.TEST;
      const hold = t(id)?.HOLDOUT;
      const holm = holmOf(id);
      return `| ${id === "market_only" ? "MARKET_DEVIG" : id.replace("market_", "MARKET+").toUpperCase()} | ${dash(test?.brier)} | ${id === "market_only" ? "baseline" : dash(test?.delta_brier)} | ${dash(test?.logloss)} | ${dash(hold?.brier)} | ${id === "market_only" ? "—" : holm ? "reject" : "no"} | ${modelVerdict(id, test, holm)} |`;
    }),
    "",
    "## Annual capital",
    "",
    renderAnnualBankroll031(report).split("\n").slice(6).join("\n"),
    "",
    "No TASK 032 is opened. Residual 2020+ coverage requires a licensed LEVEL_A dump (Betfair Historic login or a paid odds-history API), not a new model.",
    "",
  ].join("\n");
}

export function writeTask031Artifacts(report: Task031Report): void {
  const artifactsRoot = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifactsRoot, { recursive: true });
  mkdirSync(docs, { recursive: true });
  mkdirSync(TASK031_ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(artifactsRoot, "task-031-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(docs, "task-031-final-report.md"), renderFinalReport031(report));
  writeFileSync(join(docs, "task-031-data-lineage.md"), renderLineage031(report));
  writeFileSync(join(docs, "task-031-source-audit.md"), renderSourceAudit031(report));
  writeFileSync(join(docs, "task-031-annual-bankroll.md"), renderAnnualBankroll031(report));

  const freeze = freezeDataset031Base({ skipHeavy: report.fixture_mode });
  const quotes = quotesForEvents(freeze.events);
  const eventHeader = [
    "event_id",
    "competition",
    "season",
    "home_team",
    "away_team",
    "kickoff",
    "market",
    "home_odds",
    "draw_odds",
    "away_odds",
    "quote_timestamp",
    "timestamp_timezone",
    "available_at",
    "source",
    "source_dataset",
    "bookmaker",
    "temporal_basis",
    "license",
    "match_confidence",
    "strict_status",
  ];
  const eventLines = [
    eventHeader.join(","),
    ...freeze.events.map((e) =>
      [
        e.event_id,
        e.competition,
        e.season,
        e.home_team,
        e.away_team,
        e.kickoff,
        e.market,
        e.home_odds,
        e.draw_odds,
        e.away_odds,
        e.quote_timestamp,
        e.timestamp_timezone,
        e.available_at,
        e.source,
        e.source_dataset,
        e.bookmaker,
        e.temporal_basis,
        e.license,
        e.match_confidence,
        e.strict_status,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  const quoteHeader = [
    "event_id",
    "competition",
    "season",
    "home_team",
    "away_team",
    "kickoff",
    "market",
    "selection",
    "odds",
    "quote_timestamp",
    "timestamp_timezone",
    "available_at",
    "source",
    "source_dataset",
    "bookmaker",
    "temporal_basis",
    "license",
    "match_confidence",
    "strict_status",
  ];
  const quoteLines = [
    quoteHeader.join(","),
    ...quotes.map((q) =>
      [
        q.event_id,
        q.competition,
        q.season,
        q.home_team,
        q.away_team,
        q.kickoff,
        q.market,
        q.selection,
        q.odds,
        q.quote_timestamp,
        q.timestamp_timezone,
        q.available_at,
        q.source,
        q.source_dataset,
        q.bookmaker,
        q.temporal_basis,
        q.license,
        q.match_confidence,
        q.strict_status,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "events.csv"), eventLines.join("\n"));
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "quotes.csv"), quoteLines.join("\n"));
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "events.json"), JSON.stringify({ n: freeze.events.length, period: [freeze.period_start, freeze.period_end] }, null, 2));
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "quotes.json"), JSON.stringify({ n: quotes.length }, null, 2));
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "sources.json"), JSON.stringify(report.sources, null, 2));
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "annual-results.json"), JSON.stringify(report.annual, null, 2));
  const fingerprints = {
    dataset_031_base: report.observed_base_sha256,
    frozen_028_required: report.frozen_028_sha256,
    union: report.union_fingerprint,
    task_030: report.task_030_fingerprint,
    task_031: report.fingerprint,
    added_strict_events: report.added_strict_events,
  };
  writeFileSync(join(TASK031_ARTIFACTS_DIR, "fingerprints.json"), JSON.stringify(fingerprints, null, 2));
  writeFileSync(
    join(TASK031_ARTIFACTS_DIR, "manifest.json"),
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        strict_events: report.strict_events,
        model_ready: report.model_ready,
        capital_test: report.capital_test,
        winner: report.winner,
        real_money: report.real_money,
        auto_promotion: report.auto_promotion,
        fingerprints,
        files: ["events.csv", "quotes.csv", "sources.json", "annual-results.json", "fingerprints.json"],
      },
      null,
      2,
    ),
  );
}
