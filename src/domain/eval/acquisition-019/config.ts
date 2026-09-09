import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp019Config } from "@/domain/eval/acquisition-019/types";

export function loadExp019Config(): Exp019Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_019_historical_market_acquisition_v1.json"),
      "utf8",
    ),
  ) as Exp019Config;
  if (raw.experiment_id !== "exp_019_historical_market_acquisition_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.retroactive_optimization !== false ||
    raw.auto_promote !== false ||
    raw.winner !== null ||
    raw.real_money !== false ||
    raw.declared_edge !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  return raw;
}
