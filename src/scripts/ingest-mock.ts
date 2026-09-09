import { config } from "dotenv";
import { licenseClassForProvider } from "@/domain/alignment-ids";
import { runIngestion } from "@/ingest/engine";
import { getProvider, registerProvider } from "@/ingest/registry";
import {
  MOCK_PROVIDER_ID,
  MockSportsProvider,
  mockIngestRequests,
} from "@/providers/mock/adapter";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  registerProvider(new MockSportsProvider());
  const provider = getProvider(MOCK_PROVIDER_ID);
  const result = await runIngestion({
    provider,
    requests: mockIngestRequests(),
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
