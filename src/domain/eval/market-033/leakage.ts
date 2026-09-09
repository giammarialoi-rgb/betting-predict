import {
  BlindLeakageError,
  ExperimentIntegrityError,
} from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal } from "@/domain/eval/capital-020/lock";
import { leakFutureMarket } from "@/domain/eval/final-feature-reconstruction";
import {
  leakCloseAtT1h,
  leakDateOnlyToStrict,
  leakFeatureSelectOnTest,
  leakHoldoutTrain,
  leakInventedTimestamp,
  leakMatchAmbiguous,
  leakOutcome,
} from "@/domain/eval/incremental-029/leakage";
import { assertHoldoutLocked033, assertTestLocked033, loadExp033Config } from "@/domain/eval/market-033/config";
import { refuseNaiveAsUtc } from "@/domain/eval/market-033/markets";

export function leakFtHt(payload: Record<string, unknown>): void {
  leakOutcome(payload);
  if (payload.HT != null || payload.ht != null || payload.HTHG != null) {
    throw new BlindLeakageError("HT in DecisionContext");
  }
}

export function leakFutureOdds(quoteMs: number, asOfMs: number): void {
  leakFutureMarket(quoteMs, asOfMs);
}

export function leakPostMatchOdds(inPlay: boolean, kickoffMs: number, quoteMs: number): void {
  if (quoteMs >= kickoffMs) throw new BlindLeakageError("post-match or kickoff quote");
  if (inPlay) throw new BlindLeakageError("in-play quote in prematch DecisionContext");
}

export function leakCloseQuote(usedClose: boolean): void {
  leakCloseAtT1h(usedClose);
}

export function leakNaiveTimezoneAsUtc(naive: string, usedAsUtc: boolean): void {
  refuseNaiveAsUtc(naive);
  if (usedAsUtc) throw new BlindLeakageError("naive timestamp treated as UTC");
}

export function leakFutureLineup(used: boolean): void {
  if (used) throw new BlindLeakageError("future lineup");
}

export function leakFutureNews(used: boolean): void {
  if (used) throw new BlindLeakageError("future news");
}

export function leakAggregateAsBook(used: boolean): void {
  if (used) throw new BlindLeakageError("aggregate Max/Avg used as a bookmaker quote");
}

export function leakCrossEvent(used: boolean): void {
  if (used) throw new BlindLeakageError("cross-event leakage");
}

export function leakAutoPromote033(auto: boolean): void {
  if (auto) throw new ExperimentIntegrityError("challenger cannot auto-promote");
}

export function leakMasanielloProduction(policy: string): void {
  if (policy === "masaniello" || policy === "masaniello_challenger") {
    throw new ExperimentIntegrityError("Masaniello cannot become production staking");
  }
}

export function leakOpenTask034(open: boolean): void {
  if (open) throw new ExperimentIntegrityError("TASK 034 must not be auto-opened");
}

export function runHostileBattery033(): { id: string; throws: boolean }[] {
  const cfg = loadExp033Config();
  const asOf = Date.parse("2016-06-01T12:00:00.000Z");
  const cases: { id: string; run: () => void }[] = [
    { id: "future_timestamp", run: () => leakFutureOdds(asOf + 1, asOf) },
    { id: "kickoff_leakage", run: () => leakPostMatchOdds(false, asOf, asOf) },
    { id: "FT", run: () => leakFtHt({ FT: "2-1" }) },
    { id: "HT", run: () => leakFtHt({ HT: "1-0" }) },
    { id: "outcome", run: () => leakOutcome({ outcome: "HOME" }) },
    { id: "closing_odds", run: () => leakCloseQuote(true) },
    { id: "post_match_odds", run: () => leakPostMatchOdds(false, asOf, asOf + 60_000) },
    { id: "ambiguous_match", run: () => leakMatchAmbiguous("MATCH_AMBIGUOUS") },
    { id: "future_bookmaker_quote", run: () => leakFutureOdds(asOf + 5, asOf) },
    { id: "future_lineup", run: () => leakFutureLineup(true) },
    { id: "future_news", run: () => leakFutureNews(true) },
    { id: "aggregate_leakage", run: () => leakAggregateAsBook(true) },
    { id: "cross_event_leakage", run: () => leakCrossEvent(true) },
    { id: "date_only_to_strict", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "naive_as_utc", run: () => leakNaiveTimezoneAsUtc("04-09-2014 15:30", true) },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "test_lock", run: () => assertTestLocked033(true) },
    { id: "holdout_lock", run: () => assertHoldoutLocked033(true) },
    { id: "feature_test", run: () => leakFeatureSelectOnTest(true) },
    { id: "holdout_train", run: () => leakHoldoutTrain(true) },
    { id: "lock", run: () => assertLockedBeforeReveal(false) },
    { id: "auto_promote", run: () => leakAutoPromote033(true) },
    { id: "masaniello", run: () => leakMasanielloProduction("masaniello") },
    { id: "task_034", run: () => leakOpenTask034(true) },
    {
      id: "frozen_flags",
      run: () => {
        if (cfg.retest_task_032) throw new ExperimentIntegrityError("retest 032");
        throw new ExperimentIntegrityError("frozen flags ok");
      },
    },
  ];
  return cases.map((c) => {
    try {
      c.run();
      return { id: c.id, throws: false };
    } catch {
      return { id: c.id, throws: true };
    }
  });
}
