/**
 * pnpm analyze:board  (alias: analyze:all)
 * Analyze every eligible board event through the real ANALYZE_EVENT slice.
 *
 * Flags:
 *   --include-finished   also analyze settled / FT rows
 *   --concurrency N      1 or 2 (default 1)
 *   --limit N            cap selected events
 *   --dry-run            select + print, do not analyze
 *   --no-discovery       board / next_events / local store only
 */
import { config } from "dotenv";
import {
  formatBoardRunTable,
  runBoardAnalysis,
  writeBoardRunReport,
} from "@/domain/eval/real-pipeline";
import { setRemoteMirrorStoreOverride } from "@/domain/eval/betmind-runtime/remote-mirror";

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const concurrency = Number(arg("--concurrency") ?? 1);
  const limitRaw = arg("--limit");
  try {
    const report = await runBoardAnalysis({
      includeFinished: flag("--include-finished"),
      includeDiscovery: !flag("--no-discovery"),
      concurrency,
      limit: limitRaw ? Number(limitRaw) : undefined,
      dryRun: flag("--dry-run"),
    });
    console.log(formatBoardRunTable(report));
    const path = writeBoardRunReport(report);
    console.log(`\njson=${path}`);
    if (report.failed > 0 && report.analyzed === 0) process.exitCode = 2;
  } finally {
    setRemoteMirrorStoreOverride(null);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
