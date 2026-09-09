import { persistHarvestManifests, runTask037 } from "@/domain/eval/harvest-037/lab";

async function main() {
  const report = await runTask037({ skipHeavy: false });
  persistHarvestManifests(report.harvest);
  console.log(JSON.stringify({ harvest: report.harvest.map((h) => ({ id: h.id, class: h.classification, events: h.events_est, exists: h.exists })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
