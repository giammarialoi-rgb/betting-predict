import { join } from "node:path";
import { pullSportScores042 } from "@/domain/eval/collector-042/api";
import { loadCreditState042, remainingCredits042, saveCreditState042, canAffordRun042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { labAStore044, permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  appendSettlement044,
  appendAutopsy044,
  appendLearning044,
  appendJournal044,
  loadStore044,
  loadModelRegistry044,
} from "@/domain/eval/permanent-044/store";
import type { PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import { expandedAutopsy044, learningCaseFromExpanded044, appendLearningCase044, learningFromAutopsy044 } from "@/domain/eval/permanent-044/learning-expanded";
import {
  bumpApiCalls045,
  loadDiscoveryState045,
  saveDiscoveryState045,
} from "@/domain/eval/factory-045/config";
import {
  appendLearningCasePi,
  createLearningCasePi,
} from "@/domain/eval/predictive-intelligence/learning/loop";
import { mapBetOutcome053 } from "@/domain/eval/predictive-intelligence/settlement/outcome-map";
import { loadOpenVirtualByEvent053 } from "@/domain/eval/bankroll-053/ledger";

/**
 * Settle Lab B events with past kickoff using Odds API scores.
 * Does NOT write Lab A settlements/decisions.
 */
export async function runSettle045(input: {
  labBRoot?: string;
  labARoot?: string;
  fetchImpl?: typeof fetch;
  nowIso?: string;
}): Promise<{ settled: number; api_calls: number; credits_remaining: number | null; sports: string[] }> {
  const labB = input.labBRoot ?? permanentRoot044();
  const labA = input.labARoot ?? labAStore044();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const store = loadStore044(labB);
  const cfg = loadGovernorConfig042();
  let credit = loadCreditState042(labA);
  let state = loadDiscoveryState045(labB);

  const needSettle = store.events.filter((e) => {
    if (!e.kickoff_utc) return false;
    if (store.settlementEventIds.has(e.event_id)) return false;
    const k = parseExactUtcMs(e.kickoff_utc);
    return k != null && k < nowMs;
  });
  const sports = [...new Set(needSettle.map((e) => e.competition))];
  let settled = 0;
  let apiCalls = 0;
  const reg = loadModelRegistry044(labB);

  for (const sport of sports.slice(0, 12)) {
    if (!canAffordRun042(credit, cfg.estimatedScoresCreditsPerSport + 1, cfg).ok) break;
    const pull = await pullSportScores042({
      sport,
      fetchImpl: input.fetchImpl,
      creditState: credit,
    });
    credit = pull.creditState;
    apiCalls += 1;
    state = bumpApiCalls045(state, 1);
    if (pull.error) continue;

    for (const ev of needSettle.filter((e) => e.competition === sport)) {
      const hit = pull.scores.find((s) => s.source_event_id === ev.source_event_id && s.completed);
      if (!hit || hit.home_score == null || hit.away_score == null) continue;
      const resultLabel = `${hit.home_score}-${hit.away_score}`;
      const oneX2 = hit.home_score > hit.away_score ? "HOME" : hit.home_score < hit.away_score ? "AWAY" : "DRAW";
      // outcome left UNSETTLED at event level — paper ledger maps won/lost per selection vs result
      const sett: PermanentSettlement044 = {
        event_id: ev.event_id,
        result: `${resultLabel}|${oneX2}`,
        market: "1X2",
        selection: oneX2,
        outcome: "UNSETTLED",
        settled_at: nowIso,
        source: "the-odds-api-scores",
        source_confidence: 0.85,
      };

      if (appendSettlement044(store, sett) === "ok") {
        settled += 1;
        const latestPred = [...store.predictions]
          .filter((p) => p.event_id === ev.event_id)
          .sort((a, b) => b.prediction_seq - a.prediction_seq)[0];
        if (latestPred) {
          const fakeSettlement039 = {
            event_id: ev.event_id,
            result_source: "the-odds-api-scores",
            settled_at: nowIso,
            home_score: hit.home_score,
            away_score: hit.away_score,
            outcome: oneX2 as "HOME" | "DRAW" | "AWAY",
          };
          const lock = store.locks.find((l) => l.event_id === ev.event_id) ?? null;
          const expanded = expandedAutopsy044({
            prediction: latestPred,
            settlement: fakeSettlement039,
            lockTime: lock?.lock_timestamp ?? null,
          });
          if (appendAutopsy044(store, expanded as never) === "ok") {
            const learn = learningFromAutopsy044(expanded);
            if (learn) appendLearning044(store, learn);
            appendLearningCase044(labB, learningCaseFromExpanded044(expanded, reg.current_version));
            // PI learning loop — observation only; never auto-applies
            const opens = loadOpenVirtualByEvent053(labB, ev.event_id);
            const stakeOutcome =
              opens[0] != null
                ? mapBetOutcome053({ result: sett.result, selection: opens[0].selection })
                : null;
            appendLearningCasePi(
              labB,
              createLearningCasePi({
                event_id: ev.event_id,
                prediction: latestPred.probability_model,
                actual: oneX2,
                market_prob: latestPred.probability_market,
                decision: latestPred.reason_codes.includes("INSUFFICIENT_DATA")
                  ? "INSUFFICIENT_DATA"
                  : latestPred.recommended
                    ? "BET_CANDIDATE"
                    : "NO_BET",
                stake_result: stakeOutcome,
                nowIso,
              }),
            );
          }
        }
      }
    }
  }

  state.last_settlement_at = nowIso;
  saveDiscoveryState045(labB, state);
  saveCreditState042(credit, labA);
  appendJournal044(labB, { kind: "settle_045", settled, apiCalls, sports: sports.length });
  return {
    settled,
    api_calls: apiCalls,
    credits_remaining: remainingCredits042(credit),
    sports,
  };
}

void join;
