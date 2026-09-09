import { config } from "dotenv";
import { runFootballDataCoUkIngestion } from "@/ingest/odds-engine";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const seasonCode = process.env.FOOTBALL_DATA_CO_UK_SEASON ?? "2425";
  const division = process.env.FOOTBALL_DATA_CO_UK_DIVISION ?? "E0";

  const result = await runFootballDataCoUkIngestion({
    seasonCode,
    division,
  });

  console.log(
    JSON.stringify({
      provider: "football-data-co-uk",
      seasonCode,
      division,
      runId: result.runId,
      status: result.status,
      recordsReceived: result.recordsReceived,
      recordsStored: result.recordsStored,
      recordsRejected: result.recordsRejected,
      errorMessage: result.errorMessage,
    }),
  );

  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
