import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { FROZEN_031_SHA256, FROZEN_032_FINGERPRINT, type Exp033Config } from "@/domain/eval/market-033/types";

export function loadExp033Config(): Exp033Config {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "experiments", "exp_033_definitive_market_test.json"), "utf8"),
  ) as Exp033Config;
  if (raw.experiment_id !== "exp_033_definitive_market_test") {
    throw new ExperimentIntegrityError("bad experiment_id");
  }
  if (
    raw.winner !== null ||
    raw.declared_best !== false ||
    raw.auto_promotion !== false ||
    raw.auto_promote !== false ||
    raw.real_money !== false ||
    raw.feature_selection_on_test !== false ||
    raw.holdout_for_training !== false ||
    raw.random_split !== false ||
    raw.close_in_decision !== false ||
    raw.date_only_promoted_to_strict !== false ||
    raw.invent_available_at !== false ||
    raw.invent_timestamps !== false ||
    raw.invent_timezone !== false ||
    raw.modify_frozen_031 !== false ||
    raw.retest_task_032 !== false ||
    raw.open_task_034 !== false ||
    raw.masaniello_production !== false ||
    raw.test_locked !== true ||
    raw.holdout_locked !== true ||
    raw.immutable_1x2_ref.copied !== false ||
    raw.immutable_1x2_ref.retest_1x2_models !== false
  ) {
    throw new ExperimentIntegrityError("frozen TASK 033 flags violated");
  }
  if (raw.immutable_1x2_ref.dataset_sha256 !== FROZEN_031_SHA256) {
    throw new ExperimentIntegrityError("TASK 031 SHA freeze violated");
  }
  if (raw.carry_forward_032.fingerprint !== FROZEN_032_FINGERPRINT) {
    throw new ExperimentIntegrityError("TASK 032 fingerprint freeze violated");
  }
  if (raw.baseline !== "MARKET_DEVIG") throw new ExperimentIntegrityError("baseline frozen");
  if (raw.as_of_policy !== "STRICT_AS_OF") throw new ExperimentIntegrityError("as_of_policy frozen");
  return raw;
}

export function assertTestLocked033(usedTestForSelection: boolean): void {
  if (usedTestForSelection) throw new ExperimentIntegrityError("TEST locked — no selection");
}

export function assertHoldoutLocked033(usedHoldout: boolean): void {
  if (usedHoldout) throw new ExperimentIntegrityError("HOLDOUT locked");
}

export const BASIC_SAMPLE_REL = "audit/external/task-023/football-basic-sample.json";
export const WEEKLY_CSV_REL = "audit/external/task-025/betfair-sports.csv";
export const STRICT_031_REL = "audit/external/task-027/strict-candidates.csv";
export const WEEKLY_FIXTURE_REL = "src/domain/eval/turnaround-025/fixtures/kaggle-week-sample.csv";
export const BASIC_FIXTURE_REL =
  "src/domain/eval/temporal-023/fixtures/epl-2017-04-30-middlesbrough-mancity-match-odds.ndjson";
export const OU_FIXTURE_REL = "src/domain/eval/market-033/fixtures/basic-ou-sample.ndjson";
