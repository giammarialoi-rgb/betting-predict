/**
 * pnpm betmind:mega-cycle — free discover + live + settle + source probes.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runMegaPipelineCycle } from "@/domain/eval/mega-pipeline/cycle";

async function main() {
  const result = await runMegaPipelineCycle({
    persistNeon: Boolean(process.env.DATABASE_URL),
  });
  const outDir = join(process.cwd(), "artifacts", "mega-pipeline");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "last-cycle.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
