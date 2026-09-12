/**
 * pnpm analyze:event -- <EVENT_ID>
 * One future (or specified) real match through the wired vertical slice.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatPipelineReport, runRealAnalysisPipeline } from "@/domain/eval/real-pipeline";
import { setRemoteMirrorStoreOverride } from "@/domain/eval/betmind-runtime/remote-mirror";

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const eventId = args[0] && !args[0].startsWith("-") ? args[0] : undefined;
  try {
    const report = await runRealAnalysisPipeline({ eventId });
    console.log(formatPipelineReport(report));
    const dir = join(process.cwd(), "artifacts", "real-pipeline");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "last-report.json");
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\njson=${path}`);
    if (report.errors.includes("EVENT_NOT_FOUND") || report.errors.includes("NO_FUTURE_EVENT")) {
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
