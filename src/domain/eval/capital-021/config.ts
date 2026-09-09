import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp021Config } from "@/domain/eval/capital-021/types";

export function loadExp021Config(): Exp021Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_021_realtime_truth_v1.json"),
      "utf8",
    ),
  ) as Exp021Config;
  if (raw.experiment_id !== "exp_021_realtime_truth_v1") {
    throw new Error("bad experiment_id");
  }
  if (
    raw.retroactive_optimization !== false ||
    raw.auto_promote !== false ||
    raw.winner !== null ||
    raw.real_money !== false ||
    raw.declared_edge !== false ||
    raw.strategy_selected_from_pnl !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_in_strict_capital !== false ||
    raw.invent_available_at !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 021 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "frequency") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay frequency");
  }
  return raw;
}
