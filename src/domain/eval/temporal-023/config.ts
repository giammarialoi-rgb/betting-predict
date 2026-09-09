import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Exp023Config } from "@/domain/eval/temporal-023/types";

export function loadExp023Config(): Exp023Config {
  const raw = JSON.parse(
    readFileSync(
      join(process.cwd(), "experiments", "exp_023_temporal_odds_breakthrough_v1.json"),
      "utf8",
    ),
  ) as Exp023Config;
  if (raw.experiment_id !== "exp_023_temporal_odds_breakthrough_v1") {
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
    raw.inplay_false_as_prematch !== false ||
    raw.interpolate_snapshots !== false ||
    raw.forward_fill_future !== false ||
    raw.auto_purchase !== false ||
    raw.use_user_credentials !== false
  ) {
    throw new Error("ExperimentIntegrityError: frozen TASK 023 flags violated");
  }
  if (raw.as_of_policy !== "STRICT_AS_OF") {
    throw new Error("ExperimentIntegrityError: STRICT_AS_OF frozen");
  }
  if (raw.frozen_model_id !== "market_only") {
    throw new Error("ExperimentIntegrityError: frozen_model_id must stay market_only");
  }
  if (raw.dataset_id !== "betfair_historic_basic_v1") {
    throw new Error("ExperimentIntegrityError: dataset_id frozen");
  }
  return raw;
}

export function assertHoldoutUntouched023(input: {
  holdoutYears: readonly number[];
  usedHoldoutForSelection: boolean;
}): void {
  if (input.usedHoldoutForSelection) {
    throw new Error("HOLDOUT_SACRED: holdout must not choose model/staking/threshold");
  }
  if (!input.holdoutYears.includes(2020)) {
    throw new Error("HOLDOUT_SACRED: 2020 (pilot holdout) must remain listed");
  }
}

export const MATCH_ODDS_FIXTURE_REL =
  "src/domain/eval/temporal-023/fixtures/epl-2017-04-30-middlesbrough-mancity-match-odds.ndjson";

export function matchOddsFixturePath(): string {
  return join(process.cwd(), MATCH_ODDS_FIXTURE_REL);
}
