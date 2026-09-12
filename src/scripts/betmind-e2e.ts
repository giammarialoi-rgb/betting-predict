/**
 * pnpm betmind:e2e — one real Golden Event through the full path.
 * Honest checklist. No invented numbers. NEON NON UTILIZZATO.
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setRemoteMirrorStoreOverride } from "@/domain/eval/betmind-runtime/remote-mirror";
import {
  runGoldenEventE2E,
  writeGoldenE2EArtifacts,
  goldenE2EArtifactDir,
} from "@/domain/eval/betmind-runtime/golden-e2e/pipeline";

function printChecklist(report: Awaited<ReturnType<typeof runGoldenEventE2E>>): void {
  console.log("\n=== BetMind Golden Event E2E ===");
  console.log(`at=${report.at}`);
  console.log(`neon=${report.neon_status_it} neon_in_use=${report.neon_in_use}`);
  console.log(`blob=${report.blob_credentials} remote_backend=${report.remote_backend}`);
  if (report.golden) {
    console.log(
      `golden=${report.golden.home} vs ${report.golden.away} | ${report.golden.competition} | ${report.golden.kickoff_utc} | ${report.golden.event_id} | ${report.golden.source} | ${report.golden.status}`,
    );
  } else {
    console.log("golden=UNAVAILABLE");
  }
  console.log("\n-- counts --");
  for (const [k, v] of Object.entries(report.counts)) {
    console.log(`  ${k}=${v}`);
  }
  console.log("\n-- checklist --");
  for (const s of report.checklist) {
    const mark = s.ok ? "OK" : "FAIL";
    console.log(`  [${mark}] ${s.step}: ${s.evidence}`);
  }
  if (report.prediction?.kind === "PREDICTION") {
    console.log(
      `\nPREDICTION id=${report.prediction.prediction_id} model=${report.prediction.model_version} sel=${report.prediction.selection} probs=${JSON.stringify(report.prediction.probs)}`,
    );
  } else if (report.prediction?.kind === "NO_PREDICTION") {
    console.log(
      `\nNO PREDICTION reason=${report.prediction.reason} failed_gates=${report.prediction.failed_gates.join(",")}`,
    );
  }
  if (report.errors.length) {
    console.log("\n-- errors --");
    for (const e of report.errors) {
      console.log(`  ERROR ${e.error}`);
      console.log(`  CAUSE ${e.cause}`);
      console.log(`  EVIDENCE ${e.evidence}`);
      console.log(`  REMEDIATION ${e.remediation}`);
    }
  }
}

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  try {
    const report = await runGoldenEventE2E({ useMemoryMirrorIfNoBlob: true });
    const jsonPath = writeGoldenE2EArtifacts(report);
    printChecklist(report);
    console.log(`\njson=${jsonPath}`);
    const mdPath = join(goldenE2EArtifactDir(), "checklist.md");
    const lines = [
      "# Golden Event checklist",
      "",
      `at: ${report.at}`,
      `neon: ${report.neon_status_it}`,
      `blob: ${report.blob_credentials}`,
      "",
      ...report.checklist.map((s) => `- [${s.ok ? "x" : " "}] **${s.step}** — ${s.evidence}`),
      "",
    ];
    writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
    const required = ["discovery", "persist", "research", "dossier_builder", "neon_excluded"];
    const failedRequired = report.checklist.filter((s) => required.includes(s.step) && !s.ok);
    if (failedRequired.length) {
      process.exitCode = 2;
    }
  } finally {
    setRemoteMirrorStoreOverride(null);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
