import { persistHarvestManifests, runTask037 } from "@/domain/eval/harvest-037/lab";
import { writeTask037Artifacts } from "@/domain/eval/harvest-037/write-artifacts";

async function main() {
  const report = await runTask037({ skipHeavy: false });
  persistHarvestManifests(report.harvest);
  writeTask037Artifacts(report);
  console.log(JSON.stringify({ lake: report.lake, features: report.features }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
