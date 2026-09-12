import { runPhase9ReportOnly } from "@/domain/eval/phase-9/run";

function main() {
  const bundle = runPhase9ReportOnly();
  console.log(JSON.stringify(bundle, null, 2));
}

main();
