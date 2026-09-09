import { acquireHistoricalMarkets020 } from "@/domain/eval/capital-020/lab";
import { writeAcquisitionArtifacts } from "@/domain/eval/capital-020/write-artifacts";

async function main() {
  const pack = await acquireHistoricalMarkets020({ allowNetwork: true });
  writeAcquisitionArtifacts(pack);
  console.log(
    JSON.stringify(
      {
        events: pack.events.length,
        quotes: pack.snapshots.length,
        bookmakers: [...new Set(pack.snapshots.map((s) => s.bookmaker))].length,
        markets: [...new Set(pack.snapshots.map((s) => s.marketType))],
        clusters: [...new Set(pack.lineages.map((l) => l.upstreamCluster))],
        live_football_data_co_uk: pack.acquired.liveFdStatus,
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
