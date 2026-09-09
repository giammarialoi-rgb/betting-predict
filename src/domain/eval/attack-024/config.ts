import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp024Config } from "@/domain/eval/attack-024/types";

export function loadExp024Config(): Exp024Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_024_historical_data_attack_v1.json"),
      "utf8",
    ),
  ) as Exp024Config & { experiment_id: string; as_of_policy: string; frozen_model_id: string };
  if (raw.experiment_id !== "exp_024_historical_data_attack_v1") {
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
    raw.unknown_in_strict_capital !== false ||
    raw.match_probable_in_strict !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timezone !== false ||
    raw.date_only_promoted_to_exact !== false ||
    raw.close_promoted_to_open !== false ||
    raw.auto_purchase !== false ||
    raw.use_user_credentials !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 024 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "market_only") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay market_only");
  }
  if (raw.dataset_id !== "historical_data_attack_v1") {
    throw new Error("ExperimentIntegrityError: dataset_id frozen");
  }
  if (raw.strict_event_gate !== 100) {
    throw new Error("ExperimentIntegrityError: strict_event_gate must stay 100");
  }
  return raw;
}

export function assertHoldoutUntouched024(input: {
  holdoutYears: readonly number[];
  usedHoldoutForSelection: boolean;
}): void {
  if (input.usedHoldoutForSelection) {
    throw new Error("HOLDOUT_SACRED: holdout must not choose model/staking/threshold");
  }
  if (!input.holdoutYears.includes(2020)) {
    throw new Error("HOLDOUT_SACRED: 2020 must remain listed");
  }
}

export const SOCCER_AUDIT_FIXTURE_REL =
  "src/domain/eval/attack-024/fixtures/soccer-audit.json";
export const SOCCER_SAMPLE_FIXTURE_REL =
  "src/domain/eval/attack-024/fixtures/soccer-odds-sample.json";

export function soccerAuditFixturePath(): string {
  return join(process.cwd(), SOCCER_AUDIT_FIXTURE_REL);
}

export function soccerSampleFixturePath(): string {
  return join(process.cwd(), SOCCER_SAMPLE_FIXTURE_REL);
}
