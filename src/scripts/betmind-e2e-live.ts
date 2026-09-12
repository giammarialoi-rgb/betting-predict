/**
 * pnpm betmind:e2e:live — ingest real ESPN live/FT for the Golden Event.
 * Settles only when a finished score is published. NEON NON UTILIZZATO.
 */
import { config } from "dotenv";
import { setRemoteMirrorStoreOverride } from "@/domain/eval/betmind-runtime/remote-mirror";
import { GOLDEN_EVENT_ID } from "@/domain/eval/betmind-runtime/live-state";
import {
  runGoldenLiveE2E,
  writeLiveE2EArtifacts,
} from "@/domain/eval/betmind-runtime/golden-e2e/live-pipeline";

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const args = process.argv.slice(2);
  const evIdx = args.indexOf("--event");
  const eventId = evIdx >= 0 ? args[evIdx + 1] : GOLDEN_EVENT_ID;
  try {
    const report = await runGoldenLiveE2E({
      eventId,
      useMemoryMirrorIfNoBlob: true,
    });
    const jsonPath = writeLiveE2EArtifacts(report);
    console.log("\n=== BetMind Golden Event LIVE E2E ===");
    console.log(`at=${report.at}`);
    console.log(`neon=${report.neon_status_it}`);
    console.log(`blob=${report.blob_credentials} remote_backend=${report.remote_backend}`);
    console.log(`event_id=${report.event_id} source=${report.source}`);
    console.log(
      `live available=${report.live.available} status=${report.live.status} score=${report.live.home_goals}-${report.live.away_goals} minute=${report.live.minute}`,
    );
    console.log(`settlement available=${report.settlement.available} result=${report.settlement.result} reason=${report.settlement.reason}`);
    console.log(`learning written=${report.learning.written} reason=${report.learning.reason}`);
    if (report.settle_deferred) {
      console.log(`\nSETTLE DEFERRED until real FT. Re-run: ${report.settle_command}`);
    }
    console.log("\n-- checklist --");
    for (const s of report.checklist) {
      console.log(`  [${s.ok ? "OK" : "FAIL"}] ${s.step}: ${s.evidence}`);
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
    console.log(`\njson=${jsonPath}`);
    if (report.checklist.some((s) => s.step === "neon_excluded" && !s.ok)) {
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
