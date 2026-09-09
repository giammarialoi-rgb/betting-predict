import { runTask019 } from "@/domain/eval/acquisition-019/lab";
import { writeTask019Artifacts } from "@/domain/eval/acquisition-019/write-artifacts";

async function main() {
  const report = await runTask019({ allowNetwork: true });
  writeTask019Artifacts(report);
  console.log(
    JSON.stringify(
      {
        experiment_id: report.experiment_id,
        verdict: report.verdict,
        counts: report.counts,
        new_sources: report.new_sources,
        new_markets: report.new_markets,
        new_bookmakers: report.new_bookmakers,
        winner: report.winner,
        live_football_data_co_uk: report.live_football_data_co_uk,
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
