import { config } from "dotenv";
import { runDataIntelligenceAudit } from "@/domain/eval/data-intelligence/audit";

config({ path: ".env.local" });
config();

async function main() {
  const result = await runDataIntelligenceAudit({
    runScrapeProbes: process.env.BETMIND_TEST_SCRAPE === "true",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
