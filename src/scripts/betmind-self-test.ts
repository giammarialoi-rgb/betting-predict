/**
 * pnpm betmind:self-test
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runBetmindSelfTest } from "@/domain/eval/mega-pipeline/self-test";

async function main() {
  const report = await runBetmindSelfTest({ probeSources: true });
  const outDir = join(process.cwd(), "artifacts", "mega-pipeline");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "self-test.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.overall === "FAIL") process.exitCode = 2;
  else if (report.overall === "PARTIAL") process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
