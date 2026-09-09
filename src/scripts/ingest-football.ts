import { config } from "dotenv";
import { licenseClassForProvider } from "@/domain/alignment-ids";
import { runIngestion } from "@/ingest/engine";
import { getProvider, registerProvider } from "@/ingest/registry";
import {
  ApiFootballProvider,
  API_FOOTBALL_PROVIDER_ID,
  footballIngestRequests,
  getApiFootballKey,
} from "@/providers/api-football/adapter";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!getApiFootballKey()) {
    console.error("API_FOOTBALL_KEY is not set. No request was sent.");
    process.exit(1);
  }

  registerProvider(new ApiFootballProvider());
  const provider = getProvider(API_FOOTBALL_PROVIDER_ID);
  const result = await runIngestion({
    provider,
    requests: footballIngestRequests(),
    licenseClass: licenseClassForProvider(provider.id),
  });

  console.log(
    JSON.stringify({
      provider: provider.id,
      runId: result.runId,
      status: result.status,
      recordsReceived: result.recordsReceived,
      recordsStored: result.recordsStored,
      recordsRejected: result.recordsRejected,
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
