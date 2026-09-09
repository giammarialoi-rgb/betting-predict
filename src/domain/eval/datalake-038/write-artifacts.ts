import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printVerdictBlock038, type Task038Report } from "@/domain/eval/datalake-038/lab";

function table(rows: string[][]): string {
  return rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
}

export function writeTask038Artifacts(report: Task038Report): void {
  const docs = join(process.cwd(), "docs");
  const art = join(process.cwd(), "artifacts");
  const dir = join(art, "task-038");
  mkdirSync(docs, { recursive: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(art, "task-038-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(dir, "lake.json"), JSON.stringify(report.lake, null, 2));
  writeFileSync(join(dir, "sources.json"), JSON.stringify(report.sources, null, 2));
  writeFileSync(join(dir, "health.json"), JSON.stringify(report.health, null, 2));

  const inv = [
    ["sourceId", "cluster", "class", "partition", "research", "strict", "events", "rejection"],
    ...report.sources.map((s) => [
      s.sourceId,
      s.sourceCluster,
      s.temporalClass,
      s.partition,
      String(s.researchEligible),
      String(s.strictEligible),
      String(s.eventCount ?? 0),
      (s.rejectionReason ?? "").replaceAll("|", "/"),
    ]),
  ];

  writeFileSync(
    join(docs, "task-038-final-report.md"),
    [
      printVerdictBlock038(report),
      "",
      "## Separation of problems",
      "",
      `- DATA PROBLEM: ${report.DATA_PROBLEM}`,
      `- MODEL PROBLEM: ${report.MODEL_PROBLEM}`,
      `- CAPITAL PROBLEM: ${report.CAPITAL_PROBLEM}`,
      "",
      "## Live",
      "",
      `LIVE_ADAPTER = ${report.LIVE_ADAPTER}`,
      `LIVE_SOURCE = ${report.LIVE_SOURCE}`,
      `API_KEY = ${report.API_KEY}`,
      `HISTORICAL_SEARCH = ${report.HISTORICAL_SEARCH}`,
      `DATA_LAKE = ${report.DATA_LAKE_STATUS}`,
      `STRICT_PIPELINE = ${report.STRICT_PIPELINE}`,
      `CAPITAL = ${report.CAPITAL}`,
      "",
      report.API_KEY === "missing" ? "THE_ODDS_API_KEY=<user must provide>" : "Key is configured; never logged.",
      "",
      "acquired != strict usable. TASK 037 GitHub corpus is RESEARCH_ONLY except the live adapter surface.",
      "TASK 039 is not opened. TASK_031_BASE is not rewritten and is not counted as new STRICT.",
      "",
      `- fingerprint: \`${report.fingerprint}\``,
      `- experiment: \`${report.experiment_sha256}\``,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-038-data-lineage.md"),
    [
      "# TASK 038 — Data lineage",
      "",
      "Lake roots: `data/raw`, `data/normalized`, `data/manifests`, `data/research`, `data/strict`, `data/quarantine`.",
      "Raw GitHub clones stay immutable at `data/external/github/_clones` (gitignored).",
      "Live raw responses: `audit/external/task-038/raw/` (gitignored, hashed, append-only).",
      "Manifests: `data/manifests/*.json` and `data/external/manifests/task-038-sources.json`.",
      "",
      "Every field traces to sourceId / sourceCluster / source file / sha256 / retrieved_at.",
      "TASK_031_BASE pointer: `data/strict/task-031-base.pointer.json` — REFERENCE only.",
      "No Neon migration.",
      "",
      table([
        ["sourceId", "sha256", "commit", "url"],
        ...report.sources.map((s) => [s.sourceId, s.sha256 ?? "—", s.commit ?? "—", s.originalUrl ?? "—"]),
      ]),
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-038-live-collection.md"),
    [
      "# TASK 038 — Live collection",
      "",
      "Source: THE_ODDS_API `/v4/sports/{sport}/odds`.",
      "`last_update` = quote observation timestamp. `commence_time` = kickoff.",
      "Timestamps are stored as received. No timezone invention. No collector clock as quote clock.",
      "football-data.org is fixture/kickoff/result only — never a quote clock.",
      "",
      `API_KEY: ${report.API_KEY}`,
      `COLLECTION_STATUS: ${report.COLLECTION_STATUS}`,
      `LIVE_ADAPTER: ${report.LIVE_ADAPTER}`,
      `STRICT_EVENTS: ${report.STRICT_EVENTS}`,
      "",
      "Commands:",
      "",
      "```",
      "pnpm collect:task-038",
      "pnpm collect:task-038:loop",
      "```",
      "",
      "If the key is missing the collector exits 0 with NOT_CONFIGURED. It does not invent quotes.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-038-source-inventory.md"),
    [
      "# TASK 038 — Source inventory",
      "",
      "acquired != strict usable.",
      "",
      table(inv),
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-038-temporal-audit.md"),
    [
      "# TASK 038 — Temporal audit",
      "",
      "| class | enters capital |",
      "|---|---|",
      "| LEVEL_A_STRICT | yes, if MATCH_EXACT + quote < kickoff + source timestamp |",
      "| LEVEL_B_STRICT | yes, same clocks, weaker semantics |",
      "| RESEARCH_TEMPORAL | no |",
      "| DATE_ONLY | no |",
      "| POSTMATCH | no |",
      "| AMBIGUOUS | no (naive / missing TZ / client retrieval) |",
      "| INVALID | no |",
      "",
      "AS_OF: asOf = kickoff − window; last observation with observedAt ≤ asOf; no interpolation.",
      "T−1h lock uses last observation ≤ kickoff−3600s.",
      "OPEN/CLOSE, DATE_ONLY, collector retrieved_at never become quote timestamps.",
      "",
    ].join("\n"),
  );
}
