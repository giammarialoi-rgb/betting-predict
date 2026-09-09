import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactsRoot044 } from "@/domain/eval/permanent-044/config";
import type { Task044Report } from "@/domain/eval/permanent-044/lab";
import { printVerdictBlock044 } from "@/domain/eval/permanent-044/lab";

export function writeArtifacts044(report: Task044Report): string {
  const root = artifactsRoot044();
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "task-044-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(root, "FINAL_VERDICT.txt"), printVerdictBlock044(report) + "\n");
  writeFileSync(
    join(root, "summary.md"),
    [
      "# TASK 044 summary",
      "",
      `- FINAL_VERDICT: ${report.FINAL_VERDICT}`,
      `- Lab B events: ${report.TOTAL_EVENTS} (soccer ${report.SOCCER_EVENTS}, tennis ${report.TENNIS_EVENTS})`,
      `- Predictions: ${report.PREDICTION_RECORDS}`,
      `- Lab B locks: ${report.LOCKED_EVENTS}`,
      `- Lab A locks (untouched): ${report.LAB_A_LOCKED}`,
      `- Settled: ${report.SETTLED_EVENTS}`,
      `- MODEL_READY: ${report.MODEL_READY}`,
      `- CAPITAL_QUALIFIED: ${report.CAPITAL_QUALIFIED}`,
      `- BETS: ${report.BETS} BANKROLL: ${report.BANKROLL}`,
      "",
    ].join("\n"),
  );
  return root;
}
