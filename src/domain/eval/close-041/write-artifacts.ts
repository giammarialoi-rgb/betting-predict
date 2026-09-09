import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactsRoot041 } from "@/domain/eval/close-041/config";
import { printVerdictBlock041, type Task041Report } from "@/domain/eval/close-041/lab";

export function writeTask041Artifacts(report: Task041Report): void {
  const docs = join(process.cwd(), "docs");
  const art = join(process.cwd(), "artifacts");
  const dir = artifactsRoot041();
  mkdirSync(docs, { recursive: true });
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(art, "task-041-result.json"), JSON.stringify(report, null, 2));
  if (report.freeze_manifest) {
    writeFileSync(join(dir, "freeze-manifest.json"), JSON.stringify(report.freeze_manifest, null, 2));
  }
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        source_store: report.source_store,
        settled: report.SETTLED_EVENTS,
        locked: report.LOCKED_DECISIONS,
        missing_to_100: report.MISSING_TO_100,
        verdict: report.FINAL_VERDICT,
        fingerprint: report.fingerprint,
        corpus_fingerprint: report.corpus_fingerprint,
        adapter_version: report.adapter_version,
        CLV: report.CLV,
        EXECUTION_COST: report.EXECUTION_COST,
        REAL_MONEY: report.REAL_MONEY,
        open_task_042: false,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(docs, "task-041-final-report.md"),
    [
      printVerdictBlock041(report),
      "",
      "## Interpretation",
      "",
      report.interpretation,
      "",
      "## Residual blocker",
      "",
      report.residual_blocker,
      "",
      "## Protocol answers",
      "",
      "1. Prospective live store = `audit/external/task-039` (TASK 039/040).",
      "2. AS_OF T−1h LOCK immutable; FT/HT only in RevealContext.",
      "3. MARKET_DEVIG frozen baseline; no TEST optimization.",
      "4. Capital closed while gates fail; BANKROLL = — when BETS = 0.",
      "5. TASK 042 is not opened.",
      "",
      `- fingerprint: \`${report.fingerprint}\``,
      `- MISSING_TO_100: ${report.MISSING_TO_100}`,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-041-data-lineage.md"),
    [
      "# TASK 041 — Data lineage",
      "",
      "| artifact | path |",
      "|---|---|",
      "| source of truth | `audit/external/task-039/` |",
      "| recover locks (040) | `decisions.jsonl` + `artifacts/task-040/locked_decisions.jsonl` |",
      "| close artifacts | `artifacts/task-041/` |",
      "| result | `artifacts/task-041-result.json` |",
      "",
      "Append-only quotes. `available_at` = source `last_update`. `collected_at` never replaces quote clock.",
      "Settlement ledger is separate from DecisionContext.",
      "TASK_031_BASE is REFERENCE only — not counted as new STRICT live.",
      "",
      `Adapter: \`${report.adapter_version}\`. Dataset fingerprint: \`${report.dataset_fingerprint}\`.`,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-041-results.md"),
    [
      "# TASK 041 — Results",
      "",
      printVerdictBlock041(report),
      "",
      "## Counts",
      "",
      `| metric | value |`,
      `|---|---|`,
      `| EVENTS_DISCOVERED | ${report.EVENTS_DISCOVERED} |`,
      `| STRICT_EVENTS | ${report.STRICT_EVENTS} |`,
      `| LOCKED_DECISIONS | ${report.LOCKED_DECISIONS} |`,
      `| SETTLED_EVENTS | ${report.SETTLED_EVENTS} |`,
      `| MISSING_TO_100 | ${report.MISSING_TO_100} |`,
      `| HOLDOUT_STATUS | ${report.HOLDOUT_STATUS} |`,
      `| CLV | ${report.CLV} |`,
      `| EXECUTION_COST | ${report.EXECUTION_COST} |`,
      "",
      report.interpretation,
      "",
    ].join("\n"),
  );
}
