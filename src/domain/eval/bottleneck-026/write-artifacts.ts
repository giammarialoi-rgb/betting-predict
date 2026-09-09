import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { onePageVerdict, type Task026Report } from "@/domain/eval/bottleneck-026/lab";

function csv(v: string | number | boolean | null | undefined): string {
  if (v == null) return "";
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function clean(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").replace(/\|/g, "/");
}

function dash(n: number | null | undefined): string {
  return n == null ? "—" : String(n);
}

export function writeTask026Artifacts(report: Task026Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-026-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(artifacts, "task-026-source-audit.json"),
    JSON.stringify(
      {
        funnel: report.funnel,
        probes: report.probes,
        matrix: report.matrix,
        kaggle: {
          zip_present: report.kaggle.zip_present,
          public_csv_files: report.kaggle.public_csv_files,
          exact_timestamp_events: report.kaggle.exact_timestamp_events,
          license: report.kaggle.license,
          claimed_roi_used: report.kaggle.claimed_roi_used,
          note: report.kaggle.note,
        },
        zenodo: report.zenodo,
        paid_after_free: report.paid_after_free,
      },
      null,
      2,
    ),
  );

  const eventsLines = [
    ["event_id", "source", "competition", "date", "home", "away", "kickoff", "corpus_level", "match_grade", "capital_eligible"].join(
      ",",
    ),
  ];
  const ledger = report.strict_ledger[0];
  if (ledger) {
    eventsLines.push(
      [
        csv(ledger.event),
        csv("betfair-historic-basic-mirror"),
        csv(ledger.competition),
        csv(ledger.kickoff_utc.slice(0, 10)),
        csv("Middlesbrough"),
        csv("Man City"),
        csv(ledger.kickoff_utc),
        csv("RESEARCH_STRICT"),
        csv(report.overlay.grade),
        csv("false"),
      ].join(","),
    );
  }
  for (const f of report.kaggle.files.filter((x) => x.exact_timestamps > 0).slice(0, 120)) {
    eventsLines.push(
      [
        csv(`kaggle-ah-${f.match_id ?? f.path}`),
        csv("kaggle-realsingwong-ah"),
        csv(f.league ?? ""),
        csv(f.ts_max ? f.ts_max.slice(0, 10) : ""),
        csv(f.teams_look_cjk ? "[CJK]" : ""),
        csv(""),
        csv(""),
        csv("RESEARCH_STRICT"),
        csv("FAILED"),
        csv("false"),
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-026-events.csv"), eventsLines.join("\n") + "\n");

  const quotesLines = [
    [
      "event_id",
      "source",
      "market",
      "selection",
      "price",
      "quote_timestamp",
      "precision",
      "origin",
      "capital_eligible",
    ].join(","),
  ];
  const d = report.blind.decision;
  for (const [sel, price] of [
    ["HOME", d.prices.home],
    ["DRAW", d.prices.draw],
    ["AWAY", d.prices.away],
  ] as const) {
    quotesLines.push(
      [
        csv(d.eventId),
        csv("betfair-historic-basic-mirror"),
        csv("MATCH_ODDS"),
        csv(sel),
        csv(price),
        csv(report.blind.quote_timestamp),
        csv("EXACT_TIMESTAMP"),
        csv("SOURCE_TIMESTAMP"),
        csv("false"),
      ].join(","),
    );
  }
  for (const f of report.kaggle.files.filter((x) => x.exact_timestamps > 0).slice(0, 120)) {
    quotesLines.push(
      [
        csv(`kaggle-ah-${f.match_id ?? f.path}`),
        csv("kaggle-realsingwong-ah"),
        csv("ASIAN_HANDICAP"),
        csv("HOME"),
        csv(""),
        csv(f.ts_max),
        csv("EXACT_TIMESTAMP"),
        csv("SOURCE_TIMESTAMP"),
        csv("false"),
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-026-quotes.csv"), quotesLines.join("\n") + "\n");

  const temporalLines = [
    ["source", "row_id", "kickoff", "quote_ts", "precision", "origin", "relation", "corpus_level"].join(","),
  ];
  if (ledger) {
    temporalLines.push(
      [
        csv("betfair-historic-basic-mirror"),
        csv(ledger.event),
        csv(ledger.kickoff_utc),
        csv(ledger.quote_timestamp),
        csv("EXACT_TIMESTAMP"),
        csv("SOURCE_TIMESTAMP"),
        csv("QUOTE_BEFORE_KICKOFF"),
        csv("RESEARCH_STRICT"),
      ].join(","),
    );
  }
  temporalLines.push(
    [
      csv("kaggle-realsingwong-ah"),
      csv("sample"),
      csv(""),
      csv("YYYYMMDDHHmmss"),
      csv("EXACT_TIMESTAMP"),
      csv("SOURCE_TIMESTAMP"),
      csv("KICKOFF_MISSING"),
      csv("RESEARCH_STRICT"),
    ].join(","),
  );
  temporalLines.push(
    [
      csv("zenodo-12673394-ucd"),
      csv("raw_data1.0"),
      csv("DATE_ONLY / kickoff Time in notes"),
      csv(""),
      csv("DATE_ONLY"),
      csv("SOURCE_TIMESTAMP"),
      csv("NOT_A_QUOTE_CLOCK"),
      csv("RESEARCH_DATE_ONLY"),
    ].join(","),
  );
  writeFileSync(join(artifacts, "task-026-temporal.csv"), temporalLines.join("\n") + "\n");

  const annualLines = [
    ["year", "events", "strict", "decisions", "bets", "start", "end", "pnl", "roi", "max_dd", "model", "status"].join(
      ",",
    ),
  ];
  for (const r of report.annual) {
    annualLines.push(
      [
        r.year,
        r.events,
        r.strict,
        r.decisions,
        r.bets,
        r.start,
        r.end ?? "",
        r.pnl ?? "",
        r.roi ?? "",
        r.max_dd ?? "",
        r.model ?? "",
        r.status,
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-026-annual-bankroll.csv"), annualLines.join("\n") + "\n");

  const m = report.metrics;
  const f = report.funnel;
  const r = report.research;

  writeFileSync(
    join(docs, "task-026-results.md"),
    [
      "# TASK 026 — Break the data bottleneck",
      "",
      `**TASK 026 VERDICT: ${report.verdict}**`,
      "",
      `SUCCESS BAND: **${report.success_band}** (exact timestamp events = ${m.exact_timestamp_events}; gate A = 100)`,
      "",
      "winner = null · real_money = false · declared_edge = false · MODEL_READY = false · HOLDOUT sacred",
      "",
      "## Funnel (facts, not a catalog)",
      "",
      `\`${f.sources_tried} tried → ${f.accessible} accessible → ${f.with_timestamp} with timestamp → ${f.with_historical_rows} historical → ${f.exact_timestamp_events} exact → ${f.temporally_verified_events} verified vs kickoff → ${f.capital_strict_events} capital\``,
      "",
      `**Blocker:** ${f.blocker}`,
      "",
      "## Photograph",
      "",
      "- Experiment A (research corpus): Club-Football DATE_ONLY Brier if loaded; Zenodo UCD DATE_ONLY acquired.",
      "- Experiment B (STRICT capital): 0 licensed CAPITAL_STRICT events. 1 Betfair MIRROR event validates the temporal engine only.",
      "- Kaggle AH: real SOURCE timestamps in the **public sample** (not 7,494). License UNKNOWN. No kickoff column. Claimed ROI unused.",
      "",
      "## One-page verdict",
      "",
      "```",
      onePageVerdict(report),
      "```",
      "",
      "## Research diagnostic (not capital)",
      "",
      `- Club events=${r.events} with_odds=${r.with_odds} bets=${r.bets}`,
      `- market_brier=${r.market_brier ?? "—"} frequency_brier=${r.frequency_brier ?? "—"} elo_brier=${r.elo_brier ?? "—"} form_brier=${r.form_brier ?? "—"} poisson_brier=${r.poisson_brier ?? "—"}`,
      "",
      "If A has signal and B cannot run, the bottleneck is data. This run: B cannot run (capital n=0). A is DATE_ONLY only.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-026-data-acquisition.md"),
    [
      "# TASK 026 — data acquisition",
      "",
      "Each source: DISCOVER → ACCESS → DOWNLOAD/QUERY → PARSE → INSPECT ROWS → TIMESTAMP → MATCH → CLASSIFY → HASH/REPORT.",
      "",
      "| Channel | HTTP | Acquired | License | Note |",
      "|---|---:|---|---|---|",
      ...report.probes.map(
        (p) => `| ${p.channel} | ${p.http_status ?? "—"} | ${p.acquired} | ${csv(p.license)} | ${clean(p.note).slice(0, 240)} |`,
      ),
      "",
      "## Paid alternatives (only after €0 paths were actually tried)",
      "",
      "| Source | Cost | Events | Timestamp | Markets | Depth | License | Cost/event |",
      "|---|---|---|---|---|---|---|---|",
      ...report.paid_after_free.map(
        (p) =>
          `| ${p.source} | ${p.cost} | ${p.events} | ${p.timestamp_quality} | ${p.markets} | ${p.historical_depth} | ${p.license} | ${p.cost_per_event} |`,
      ),
      "",
      "No key was purchased. No user signup was performed.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-026-temporal-audit.md"),
    [
      "# TASK 026 — temporal audit",
      "",
      "DATE_ONLY, OPEN/CLOSE without a clock, scrape date, file mtime, dataset publication date, assumed-before-kickoff are never STRICT_AS_OF.",
      "",
      "| Source | Kickoff | Quote | Precision | Origin | Relation | Level |",
      "|---|---|---|---|---|---|---|",
      ledger
        ? `| Betfair MIRROR | ${ledger.kickoff_utc} | ${ledger.quote_timestamp} | EXACT_TIMESTAMP | SOURCE | QUOTE_BEFORE_KICKOFF | RESEARCH_STRICT |`
        : "| none | | | | | | |",
      `| Kaggle AH sample | missing in file | YYYYMMDDHHmmss UTC (claimed) | EXACT_TIMESTAMP | SOURCE | KICKOFF_MISSING | RESEARCH_STRICT (not capital) |`,
      `| Zenodo UCD | match date / kickoff Time | none | DATE_ONLY | SOURCE | NOT_A_QUOTE_CLOCK | RESEARCH_DATE_ONLY |`,
      "",
      "## STRICT entry windows (Betfair M001 HOME LTP, observed only)",
      "",
      "| Bucket | Observed | Price | Timestamp |",
      "|---|---|---:|---|",
      ...report.blind.ttk.map(
        (t) => `| ${t.bucket} | ${t.observed ? "yes" : "no"} | ${t.price ?? "—"} | ${t.timestamp ?? "—"} |`,
      ),
      "",
      "Kaggle AH windows vs kickoff: all false — kickoff not in file, so T-Xh cannot be proven.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-026-annual-bankroll.md"),
    [
      "# TASK 026 — annual bankroll",
      "",
      "START = 1000 credits per solar year. No carry. Zero CAPITAL_STRICT bets → END = — (never silent 1000→1000).",
      "",
      "| Anno | Eventi | Strict | Decisioni | Bet | Start | End | P/L | ROI | Max DD | Model | Stato |",
      "|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|",
      ...report.annual.map(
        (row) =>
          `| ${row.year} | ${row.events} | ${row.strict} | ${row.decisions} | ${row.bets} | ${row.start} | ${dash(row.end)} | ${dash(row.pnl)} | ${dash(row.roi)} | ${dash(row.max_dd)} | ${row.model ?? "—"} | ${row.status} |`,
      ),
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-026-source-matrix.md"),
    [
      "# TASK 026 — source matrix",
      "",
      "| Source | Accessible | Free | Events | Quotes | Exact ts | License | Level | STRICT | Note |",
      "|---|---|---|---:|---:|---|---|---|---:|---|",
      ...report.matrix.map(
        (x) =>
          `| ${x.sourceId} | ${x.accessible} | ${x.free} | ${x.events ?? "—"} | ${x.quotes ?? "—"} | ${x.timestamp_exact ?? "—"} | ${x.license} | ${x.corpus_level} | ${x.strict_events} | ${clean(x.note).slice(0, 180)} |`,
      ),
      "",
      "CAPITAL_STRICT, RESEARCH_STRICT, RESEARCH_DATE_ONLY, SECONDARY, INDEX, UNUSABLE are never mixed.",
      "",
    ].join("\n"),
  );
}
