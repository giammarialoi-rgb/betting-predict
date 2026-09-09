import { persistHarvestManifests, runTask037 } from "@/domain/eval/harvest-037/lab";

async function main() {
  const skip = process.env.TASK_037_SKIP_HEAVY === "1";
  const report = await runTask037({ skipHeavy: skip });
  persistHarvestManifests(report.harvest);
  console.log(
    JSON.stringify(
      {
        scanned: report.GITHUB_REPOSITORIES_SCANNED,
        acquired: report.DATASETS_ACQUIRED,
        missing: report.harvest.filter((h) => !h.exists).map((h) => h.repository),
        strict: report.STRICT_EVENTS,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
