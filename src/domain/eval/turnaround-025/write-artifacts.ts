import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task025Report } from "@/domain/eval/turnaround-025/lab";

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

export function writeTask025Artifacts(report: Task025Report): void {
  const artifacts = join(process.cwd(), "artifacts");
  const docs = join(process.cwd(), "docs");
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(docs, { recursive: true });

  writeFileSync(join(artifacts, "task-025-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(artifacts, "task-025-source-inventory.json"),
    JSON.stringify(
      {
        probes: report.probes,
        github: report.github,
        academic: report.academic,
        scores: report.scores,
        kaggle: report.kaggle,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(artifacts, "task-025-blind-decisions.json"),
    JSON.stringify(
      {
        winner: null,
        real_money: false,
        declared_edge: false,
        decisions: [report.blind.decision],
      },
      null,
      2,
    ),
  );

  const ledger = report.strict_ledger[0];
  const eventsLines = [
    [
      "event_id",
      "source",
      "competition",
      "date",
      "home",
      "away",
      "kickoff",
      "data_class",
      "match_grade",
      "capital_eligible",
    ].join(","),
  ];
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
        csv("A_STRICT"),
        csv(report.overlay.grade),
        csv("true"),
      ].join(","),
    );
  }
  if (report.overlay.club_event_id) {
    eventsLines.push(
      [
        csv(report.overlay.club_event_id),
        csv("club-football-match-data"),
        csv("E0"),
        csv("2017-04-30"),
        csv("Middlesbrough"),
        csv("Man City"),
        csv(""),
        csv("C_RESEARCH_ONLY"),
        csv(report.overlay.grade),
        csv("false"),
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-025-events.csv"), eventsLines.join("\n") + "\n");

  const quotesLines = [
    ["event_id", "source", "market", "selection", "price", "quote_timestamp", "data_class", "capital_eligible"].join(
      ",",
    ),
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
        csv("A_STRICT"),
        csv("true"),
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-025-quotes.csv"), quotesLines.join("\n") + "\n");

  const temporalLines = [
    ["source", "row_id", "kickoff", "quote_ts", "relation", "data_class", "reason"].join(","),
  ];
  if (ledger) {
    temporalLines.push(
      [
        csv("betfair-historic-basic-mirror"),
        csv(ledger.event),
        csv(ledger.kickoff_utc),
        csv(ledger.quote_timestamp),
        csv("QUOTE_BEFORE_KICKOFF"),
        csv("A_STRICT"),
        csv(`delta_sec=${ledger.delta_kickoff_sec}`),
      ].join(","),
    );
  }
  temporalLines.push(
    [
      csv("kaggle-zygmunt-betfair-sports"),
      csv(report.kaggle.bulk_acquired ? "bulk" : "schema_fixture"),
      csv(""),
      csv(""),
      csv("UNVERIFIED_TZ"),
      csv("B_RESEARCH_TEMPORAL"),
      csv(
        `A=${report.kaggle.class_counts.A_STRICT};B=${report.kaggle.class_counts.B_RESEARCH_TEMPORAL};C=${report.kaggle.class_counts.C_RESEARCH_ONLY};D=${report.kaggle.class_counts.D_INVALID};bulk=${report.kaggle.bulk_acquired}`,
      ),
    ].join(","),
  );
  writeFileSync(join(artifacts, "task-025-temporal-audit.csv"), temporalLines.join("\n") + "\n");

  const annualLines = [
    [
      "year",
      "events",
      "strict",
      "decisions",
      "candidates",
      "bets",
      "start",
      "end",
      "pnl",
      "roi",
      "max_dd",
      "sharpe",
      "status",
    ].join(","),
  ];
  for (const r of report.annual) {
    annualLines.push(
      [
        r.year,
        r.events,
        r.strict,
        r.decisions,
        r.candidates,
        r.bets,
        r.start,
        r.end ?? "",
        r.pnl ?? "",
        r.roi ?? "",
        r.max_dd ?? "",
        r.sharpe ?? "",
        r.status,
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-025-annual-results.csv"), annualLines.join("\n") + "\n");

  const coverageLines = [
    [
      "year",
      "competition",
      "events",
      "odds",
      "exact_timestamp",
      "date_only",
      "strict",
      "strict_ratio",
      "research_ratio",
      "observed",
    ].join(","),
  ];
  for (const c of report.coverage) {
    coverageLines.push(
      [
        c.year,
        csv(c.competition),
        c.events,
        c.odds,
        c.exact_timestamp,
        c.date_only,
        c.strict,
        c.strict_ratio,
        c.research_ratio,
        "true",
      ].join(","),
    );
  }
  writeFileSync(join(artifacts, "task-025-coverage.csv"), coverageLines.join("\n") + "\n");

  const m = report.metrics;
  const s = report.scientific;
  const r = report.research;

  writeFileSync(
    join(docs, "task-025-results.md"),
    [
      "# TASK 025 — Real data turnaround lab",
      "",
      `**TASK 025 VERDICT: ${report.verdict}**`,
      "",
      "winner = null · real_money = false · declared_edge = false · HOLDOUT sacred",
      "",
      "## Photograph",
      "",
      "```",
      "THIS IS EVERYTHING WE HAVE",
      "↓",
      "THIS IS STRICT-USABLE",
      "↓",
      "THIS IS RESEARCH-ONLY",
      "↓",
      "THIS IS WHAT WE TESTED",
      "↓",
      "THIS IS THE RESULT",
      "↓",
      "THIS IS EXACTLY WHAT IS MISSING",
      "```",
      "",
      "## The 12 numbers",
      "",
      "| # | Question | Answer |",
      "|---|---|---|",
      `| 1 | Matches really in hand (Club this run / overlapping listed) | ${m.events_club} / ${m.events_listed_overlapping} |`,
      `| 2 | With odds (Club Odd* this run) | ${m.quotes_date_only} listed overlapping; Club with_odds=${r.with_odds} |`,
      `| 3 | With timestamp (exact quote clock) | ${m.as_of_usable} STRICT event(s); ${m.quotes_exact} MATCH_ODDS legs |`,
      `| 4 | AS_OF usable (STRICT) | ${m.as_of_usable} |`,
      `| 5 | Model decisions | ${m.decisions} |`,
      `| 6 | BET candidates | ${m.candidates} |`,
      `| 7 | Annual P/L from 1000 | ${dash(null)} (not 1000→1000) |`,
      `| 8 | Best staking | null (no winner) |`,
      `| 9 | Drawdown | ${dash(null)} |`,
      `| 10 | Beats market? | not testable on STRICT n=${m.events_strict}; research market_brier=${r.market_brier ?? "—"} vs frequency_brier=${r.frequency_brier ?? "—"} |`,
      `| 11 | Where it works/fails | STRICT: n=1 EPL 2017-04-30 only. Research coverage = observed Club divisions, not a catalog. |`,
      `| 12 | If it doesn't work, why | ${report.answers.q12_why_not} |`,
      "",
      "## We have",
      "",
      ...s.we_have.map((x) => `- ${x}`),
      "",
      "## STRICT usable",
      "",
      ledger
        ? `| ${ledger.event} | ${ledger.competition} | ${ledger.kickoff_utc} | ${ledger.quote_timestamp} | Δ ${ledger.delta_kickoff_sec}s | ${ledger.independence} |`
        : "_none_",
      "",
      "## Research only",
      "",
      `- Club-Football: events=${r.events} with_odds=${r.with_odds} decisions_diag=${r.decisions} illegal_edge_if_date_only_were_strict=${r.would_be_edge_candidates_if_illegal_date_only} bets=0`,
      `- market_brier=${r.market_brier ?? "—"} frequency_brier=${r.frequency_brier ?? "—"} form_brier=${r.form_brier ?? "—"} elo_brier=${r.elo_brier ?? "—"} poisson_brier=${r.poisson_brier ?? "—"}`,
      `- Kaggle weekly bulk acquired: ${report.kaggle.bulk_acquired} (schema fixture rows=${report.kaggle.sample_rows}, classes ${JSON.stringify(report.kaggle.class_counts)})`,
      "",
      "## Tested",
      "",
      ...s.we_tested.map((x) => `- ${x}`),
      "",
      `Blind decision: **${d.decision}** (${d.reason}) candidate=${d.candidate}`,
      "",
      "## Result",
      "",
      `- Scientific verdict: **${s.verdict}**`,
      `- STRICT n=${s.sample_size_strict} / gate 100`,
      `- Bonferroni α/9 = ${s.multiple_testing.bonferroni} — any_significant=false`,
      `- Monte Carlo simulated=${report.monte_carlo.simulated} (${report.monte_carlo.reason})`,
      "",
      "## Missing",
      "",
      ...s.missing.map((x) => `- ${x}`),
      "",
      "## PRIMARY BLOCKER",
      "",
      s.primary_blocker,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-025-data-inventory.md"),
    [
      "# TASK 025 — data inventory",
      "",
      "| Source | Class | Events this run | Odds | STRICT | Notes |",
      "|---|---|---:|---:|---:|---|",
      `| Betfair BASIC GitHub MIRROR | A_STRICT | 1 | 3 | 1 | quote < kickoff proven |`,
      `| Club-Football Matches.csv | C_RESEARCH_ONLY | ${m.events_club} | ${r.with_odds} | 0 | DATE_ONLY Odd* |`,
      `| Kaggle zygmunt/betfair-sports | B_RESEARCH_TEMPORAL | ${report.kaggle.bulk_acquired ? report.kaggle.unique_events_sample : 0} | ${report.kaggle.bulk_acquired ? report.kaggle.sample_rows : 0} | ${report.kaggle.class_counts.A_STRICT} | bulk=${report.kaggle.bulk_acquired}; one week not multi-year |`,
      `| eatpizzanot/soccer-dataset | C_RESEARCH_ONLY | listed in overlapping | closing | 0 | known_at = kickoff |`,
      `| BeatTheBookie closing | C_RESEARCH_ONLY | listed | DATE_ONLY | 0 | |`,
      `| football-data.co.uk | C_RESEARCH_ONLY | optional | DATE_ONLY | 0 | 503=BLOCKED continue |`,
      `| UCD WP2025/22 Advanced | A potential | 0 | 0 | 0 | not public |`,
      "",
      "## Matching V2",
      "",
      `M001 vs Club: **${report.overlay.grade}** (only MATCH_EXACT may join STRICT capital; Club odds remain C)`,
      "",
      "## Countries (observed vs not observed)",
      "",
      "| Country | Status | Events |",
      "|---|---|---:|",
      ...report.countries.map((c) => `| ${c.country} | ${c.status} | ${c.events} |`),
      "",
      "## Coverage matrix (E0 / Premier League, observed)",
      "",
      "| Period | Competition | Events | Odds | Exact timestamp | Date-only | STRICT | STRICT_RATIO | RESEARCH_RATIO |",
      "|---:|---|---:|---:|---:|---:|---:|---:|---:|",
      ...report.coverage
        .filter((c) => c.competition === "E0")
        .map(
          (c) =>
            `| ${c.year} | ${c.competition} | ${c.events} | ${c.odds} | ${c.exact_timestamp} | ${c.date_only} | ${c.strict} | ${c.strict_ratio.toFixed(4)} | ${c.research_ratio.toFixed(4)} |`,
        ),
      "",
      "_Full year×division matrix: `artifacts/task-025-coverage.csv` (observed cells only, not catalogued)._",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-025-temporal-audit.md"),
    [
      "# TASK 025 — temporal audit",
      "",
      "| Source | Kickoff | Quote | Relation | Class |",
      "|---|---|---|---|---|",
      ledger
        ? `| Betfair MIRROR | ${ledger.kickoff_utc} | ${ledger.quote_timestamp} | QUOTE_BEFORE_KICKOFF | A_STRICT |`
        : "| none | | | | |",
      `| Kaggle weekly | SCHEDULED_OFF naive | FIRST/LATEST_TAKEN naive | order on dataset clock only | B unless ISO offset proven |`,
      `| Club Odd* | DATE_ONLY | none | UNKNOWN | C_RESEARCH_ONLY |`,
      `| soccer-dataset known_at | mixed | equals date_utc | not < kickoff | C / D for capital |`,
      "",
      "## Time-to-kickoff (M001 HOME LTP, observed only)",
      "",
      "| Bucket | Observed | Price | Timestamp |",
      "|---|---|---:|---|",
      ...report.blind.ttk.map(
        (t) => `| ${t.bucket} | ${t.observed ? "yes" : "no"} | ${t.price ?? "—"} | ${t.timestamp ?? "—"} |`,
      ),
      "",
      `Movement (first vs last observed HOME price): ${report.blind.movement.direction} magnitude=${report.blind.movement.magnitude ?? "—"} n=${report.blind.movement.n_observed}`,
      "",
      "CLV is diagnostic after LOCK, never a DecisionContext feature.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-025-annual-bankroll.md"),
    [
      "# TASK 025 — annual bankroll",
      "",
      "START = 1000 per solar year. No carry. Zero STRICT or zero bets → END = — (never silent 1000→1000).",
      "",
      "| Year | Events | Strict | Decisions | Candidates | Bets | Start | End | P/L | ROI | Max DD | Sharpe | Status |",
      "|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|",
      ...report.annual.map(
        (row) =>
          `| ${row.year} | ${row.events} | ${row.strict} | ${row.decisions} | ${row.candidates} | ${row.bets} | ${row.start} | ${dash(row.end)} | ${dash(row.pnl)} | ${dash(row.roi)} | ${dash(row.max_dd)} | ${dash(row.sharpe)} | ${row.status} |`,
      ),
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-025-source-acquisition.md"),
    [
      "# TASK 025 — source acquisition",
      "",
      "EIG/cost ranking. A 10k exact-timestamp source outranks 500k DATE_ONLY.",
      "",
      "| Source | temporal | coverage | EIG | cost | EIG/cost | capital | class |",
      "|---|---:|---:|---:|---:|---:|---|---|",
      ...report.scores.map(
        (x) =>
          `| ${x.sourceId} | ${x.temporalPrecision} | ${x.eventCoverage} | ${x.expectedInformationGain} | ${x.cost} | ${x.eigOverCost} | ${x.capitalEligible} | ${x.dataClass} |`,
      ),
      "",
      "## Probes",
      "",
      "| Channel | HTTP | Acquired | Note |",
      "|---|---:|---|---|",
      ...report.probes.map((p) => `| ${p.channel} | ${p.http_status ?? "—"} | ${p.acquired} | ${clean(p.note).slice(0, 220)} |`),
      "",
      "## GitHub audits",
      "",
      ...report.github.map((g) => `- **${g.repo}** license=${g.license ?? "null"} raw=${g.hasRawData} provenance=${g.provenance}. ${g.note}`),
      "",
      "## Academic",
      "",
      ...report.academic.map(
        (a) =>
          `- **${a.name}** acquired=${a.acquired} paper=${a.paperUrl} dataset=${a.datasetUrl ?? "none"} redistribution=${a.redistribution}`,
      ),
      "",
    ].join("\n"),
  );
}
