import { config } from "dotenv";
import { runMockOddsIngestion } from "@/ingest/odds-engine";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const result = await runMockOddsIngestion();
  console.log(
    JSON.stringify({
      provider: "mock-odds",
      runId: result.runId,
      status: result.status,
      recordsReceived: result.recordsReceived,
      recordsStored: result.recordsStored,
      recordsRejected: result.recordsRejected,
      eventId: result.eventId,
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
