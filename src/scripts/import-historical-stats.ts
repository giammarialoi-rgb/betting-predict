import { config } from "dotenv";
import { importFootballDataDataset } from "@/domain/eval/predictive-intelligence/dataset/loader";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const manifest = await importFootballDataDataset({});
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
