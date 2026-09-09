import { config } from "dotenv";
import { licenseClassForProvider } from "@/domain/alignment-ids";
import { runIngestion } from "@/ingest/engine";
import { getProvider, registerProvider } from "@/ingest/registry";
import {
  FOOTBALL_DATA_ORG_PROVIDER_ID,
  FootballDataOrgProvider,
  footballDataOrgIngestRequests,
  getFootballDataOrgToken,
} from "@/providers/football-data-org/adapter";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!getFootballDataOrgToken()) {
    console.error("FOOTBALL_DATA_ORG_TOKEN is not set. No request was sent.");
    process.exit(1);
  }

  registerProvider(new FootballDataOrgProvider());
  const provider = getProvider(FOOTBALL_DATA_ORG_PROVIDER_ID);
  const result = await runIngestion({
    provider,
    requests: footballDataOrgIngestRequests(),
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
