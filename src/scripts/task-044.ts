import { config } from "dotenv";
import { runPermanent044Cycle } from "@/domain/eval/permanent-044/cycle";
import { runTask044, printVerdictBlock044 } from "@/domain/eval/permanent-044/lab";
import { writeArtifacts044 } from "@/domain/eval/permanent-044/write-artifacts";
import { auditTask044 } from "@/domain/eval/permanent-044/audit";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  await runPermanent044Cycle({ runCollector042: false });
  const report = await runTask044({ runCollector042: false });
  writeArtifacts044(report);
  const audit = auditTask044(report);
  console.log(printVerdictBlock044(report));
  console.log(JSON.stringify({ audit }, null, 2));
  if (!audit.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
