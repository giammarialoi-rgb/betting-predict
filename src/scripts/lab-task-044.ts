import { config } from "dotenv";
import { runTask044, printVerdictBlock044 } from "@/domain/eval/permanent-044/lab";
import { writeArtifacts044 } from "@/domain/eval/permanent-044/write-artifacts";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const report = await runTask044({ runCollector042: false });
  writeArtifacts044(report);
  console.log(printVerdictBlock044(report));
  console.log(JSON.stringify({ fingerprint: report.fingerprint, artifacts: "artifacts/task-044" }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
