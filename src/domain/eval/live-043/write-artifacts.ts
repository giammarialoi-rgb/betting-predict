import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactsRoot043 } from "@/domain/eval/live-043/config";
import { printVerdictBlock043, type Task043Report } from "@/domain/eval/live-043/lab";

export function writeTask043Artifacts(report: Task043Report): void {
  const docs = join(process.cwd(), "docs");
  const art = join(process.cwd(), "artifacts");
  const dir = artifactsRoot043();
  mkdirSync(docs, { recursive: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(art, "task-043-result.json"), JSON.stringify({ ...report, cycle: undefined }, null, 2));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({
    experiment_id: report.experiment_id,
    verdict: report.FINAL_VERDICT,
    fingerprint: report.fingerprint,
    model_version: report.MODEL_VERSION,
    total_events: report.TOTAL_EVENTS,
    locked: report.LOCKED_DECISIONS,
    settled: report.SETTLED_EVENTS,
    credits_remaining: report.CREDITS_REMAINING,
  }, null, 2));

  writeFileSync(
    join(docs, "task-043-final-report.md"),
    [
      printVerdictBlock043(report),
      "",
      "## Residual",
      report.residual_blocker,
      "",
      `- fingerprint: \`${report.fingerprint}\``,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-043-data-lineage.md"),
    [
      "# TASK 043 — Data lineage",
      "",
      "| store | role |",
      "|---|---|",
      "| `audit/external/task-039/` | source events/quotes/LOCK/settlement (immutable LOCKs) |",
      "| `audit/external/task-043/` | catalog, predictions, snapshots, triangulation, autopsy, learning |",
      "",
      "TASK_031_BASE / 028–042 scientific artifacts are not rewritten.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-043-model-learning.md"),
    [
      "# TASK 043 — Model learning",
      "",
      "MODEL_v1 = MARKET_ONLY (model_prob mirrors MARKET_DEVIG consensus).",
      "Learning candidates append to `learning-candidates.jsonl`.",
      "proposeNextModel043 creates non-production MODEL_vN with training_cutoff — never retro-recalculates TEST.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-043-credit-budget.md"),
    [
      "# TASK 043 — Credit budget",
      "",
      "Reuses TASK 042 governor (`credit-state.json`).",
      "Default once cycle analyzes persisted store with **zero** new odds discovery.",
      `CREDITS_REMAINING in last report: ${report.CREDITS_REMAINING ?? "—"}`,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-043-autopsy.md"),
    [
      "# TASK 043 — Autopsy",
      "",
      "Automatic autopsy after verified settlement.",
      "Classes include overconfidence, missed features, calibration, data quality.",
      "Never mutates prior LOCK / DecisionContext.",
      "",
    ].join("\n"),
  );
}
