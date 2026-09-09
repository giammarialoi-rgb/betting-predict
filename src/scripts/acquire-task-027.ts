import { extractStrictIfNeeded, inspectLocal027 } from "@/domain/eval/breakthrough-027/acquire";

function main() {
  const local = inspectLocal027();
  const extracted = local.candidates_present ? local : extractStrictIfNeeded();
  console.log(JSON.stringify(extracted, null, 2));
}

main();
