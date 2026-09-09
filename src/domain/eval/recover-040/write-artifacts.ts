import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactsRoot040, storeRoot040 } from "@/domain/eval/recover-040/config";
import { printVerdictBlock040, type Task040Report } from "@/domain/eval/recover-040/lab";

export function writeTask040Artifacts(report: Task040Report): void {
  const docs = join(process.cwd(), "docs");
  const art = join(process.cwd(), "artifacts");
  const dir = artifactsRoot040();
  const lake = storeRoot040();
  mkdirSync(docs, { recursive: true });
  mkdirSync(dir, { recursive: true });
  mkdirSync(lake, { recursive: true });

  const lockedPath = join(dir, "locked_decisions.jsonl");
  writeFileSync(lockedPath, report.locked_rows.map((r) => `${JSON.stringify(r)}\n`).join(""));
  writeFileSync(join(lake, "locked_decisions.jsonl"), report.locked_rows.map((r) => `${JSON.stringify(r)}\n`).join(""));

  const tablePath = join(dir, "recover-table.json");
  writeFileSync(tablePath, JSON.stringify(report.recover_table, null, 2));

  const manifest = {
    source: "THE_ODDS_API",
    source_store: report.source_store,
    retrieved_at: new Date().toISOString(),
    schema: "Event039/Quote039/Decision039",
    row_count: report.QUOTE_OBSERVATIONS,
    event_count: report.EVENTS_DISCOVERED,
    quote_count: report.QUOTE_OBSERVATIONS,
    unique_quotes: report.UNIQUE_QUOTES,
    locked_decisions: report.LOCKED_DECISIONS,
    settled_events: report.SETTLED_EVENTS,
    sha256: report.dataset_fingerprint,
    coverage: {
      T72: report.T72_COVERAGE,
      T48: report.T48_COVERAGE,
      T24: report.T24_COVERAGE,
      T12: report.T12_COVERAGE,
      T6: report.T6_COVERAGE,
      T3: report.T3_COVERAGE,
      T1H: report.T1H_COVERAGE,
      T30M: report.T30M_COVERAGE,
      T15M: report.T15M_COVERAGE,
      T5M: report.T5M_COVERAGE,
      T1M: report.T1M_COVERAGE,
    },
    license_terms: "THE_ODDS_API terms — local research cache only; do not redistribute raw API payloads",
    adapter_version: report.adapter_version,
    experiment_id: report.experiment_id,
    experiment_sha256: report.experiment_sha256,
    secrets: false,
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(lake, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(art, "task-040-result.json"), JSON.stringify({ ...report, locked_rows: undefined }, null, 2));

  // Refresh stale 039 UI artifact when live data exists
  if (report.QUOTE_OBSERVATIONS > 0 && existsSync(join(art, "task-039-result.json"))) {
    try {
      const old = JSON.parse(readFileSync(join(art, "task-039-result.json"), "utf8")) as {
        FINAL_VERDICT?: string;
        QUOTE_OBSERVATIONS?: number;
      };
      if (old.FINAL_VERDICT === "LIVE_NOT_CONFIGURED" || (old.QUOTE_OBSERVATIONS ?? 0) === 0) {
        writeFileSync(
          join(art, "task-039-result.stale-backup.json"),
          readFileSync(join(art, "task-039-result.json")),
        );
      }
    } catch {
      /* ignore */
    }
  }

  writeFileSync(
    join(docs, "task-040-final-report.md"),
    [
      printVerdictBlock040(report),
      "",
      "## Recover table (phase 14)",
      "",
      "```json",
      JSON.stringify(report.recover_table, null, 2),
      "```",
      "",
      "## Notes",
      "",
      "- Consumes `audit/external/task-039/` without requiring a new pull.",
      "- `available_at` = source `last_update`; never `collected_at`.",
      "- AS_OF T−1h LOCK recovery does not wait for the live calendar window.",
      "- Settlement stays out of DecisionContext. Capital closed. No TASK 041.",
      "",
      `- fingerprint: \`${report.fingerprint}\``,
      `- residual: ${report.residual_blocker}`,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-040-recover-audit.md"),
    [
      "# TASK 040 — Recover audit",
      "",
      `| metric | value |`,
      `|---|---|`,
      `| TOTAL_QUOTE_ROWS | ${report.recover_table.TOTAL_QUOTE_ROWS} |`,
      `| UNIQUE_QUOTE_ROWS | ${report.recover_table.UNIQUE_QUOTE_ROWS} |`,
      `| UNIQUE_EVENTS | ${report.recover_table.UNIQUE_EVENTS} |`,
      `| EVENTS_WITH_EXACT_KICKOFF | ${report.recover_table.EVENTS_WITH_EXACT_KICKOFF} |`,
      `| EVENTS_WITH_T1H_COMPLETE_1X2 | ${report.recover_table.EVENTS_WITH_T1H_COMPLETE_1X2} |`,
      `| LOCKED_DECISIONS | ${report.recover_table.LOCKED_DECISIONS} |`,
      `| SETTLED_EVENTS | ${report.recover_table.SETTLED_EVENTS} |`,
      "",
      "events=0 on a collector pull means no *new* catalog inserts, not an empty store.",
      "",
    ].join("\n"),
  );

  const lockedSha = createHash("sha256").update(readFileSync(lockedPath)).digest("hex");
  writeFileSync(
    join(dir, "locked_decisions.sha256"),
    `${lockedSha}  locked_decisions.jsonl\n`,
  );
}
