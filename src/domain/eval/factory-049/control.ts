import { buildControlCenter048 } from "@/domain/eval/factory-048/control";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { computeMassiveStats049 } from "@/domain/eval/factory-049/stats";
import { loadSportCoverage049 } from "@/domain/eval/factory-049/config";
import { SPORT_FAMILY_ADAPTERS_049 } from "@/domain/eval/factory-049/adapters";

/** Disk-only Control Center for massive multi-sport lab. */
export function buildControlCenter049(nowIso = new Date().toISOString()) {
  const base = buildControlCenter048(nowIso);
  const root = permanentRoot044();
  const store = loadStore044(root);
  const stats = computeMassiveStats049(store, nowIso);
  const coverage = loadSportCoverage049(root);

  return {
    ...base,
    massive_049: {
      title: "MASSIVE LIVE LAB",
      artificial_cap: false as const,
      catalog_note: stats.catalog_note,
      adapters: SPORT_FAMILY_ADAPTERS_049.map((a) => a.family),
      stats: {
        TOTAL_EVENTS_ANALYZED: stats.EVENTS_ANALYZED,
        NEXT_24H: stats.EVENTS_NEXT_24H,
        NEXT_72H: stats.EVENTS_NEXT_72H,
        NEXT_7D: stats.EVENTS_NEXT_7D,
        TODAY: stats.EVENTS_TODAY,
        SOCCER: stats.SOCCER,
        TENNIS: stats.TENNIS,
        BASKETBALL: stats.BASKETBALL,
        VOLLEYBALL: stats.VOLLEYBALL,
        HOCKEY: stats.HOCKEY,
        OTHER: stats.OTHER,
        MARKETS_OBSERVED: stats.MARKETS_OBSERVED,
        MARKETS_ANALYZED: stats.MARKETS_ANALYZED,
        TOTAL_PREDICTIONS: stats.TOTAL_PREDICTIONS,
        BET_CANDIDATES: stats.BET_CANDIDATE,
        STRONG: stats.STRONG_CANDIDATE,
        NO_BET: stats.NO_BET,
        LOCKED: stats.LOCKED,
        SETTLED: stats.SETTLED,
        AUTOPSIED: stats.AUTOPSIED,
        LEARNING_CASES: stats.LEARNING_CASES,
      },
      sport_coverage: coverage.sports.length
        ? coverage.sports
        : [
            { family: "soccer", status: "UNKNOWN", keys_active: 0, keys_pulled: 0, events_in_lab: stats.SOCCER, note: null },
            { family: "tennis", status: "UNKNOWN", keys_active: 0, keys_pulled: 0, events_in_lab: stats.TENNIS, note: null },
            {
              family: "basketball",
              status: "UNKNOWN",
              keys_active: 0,
              keys_pulled: 0,
              events_in_lab: stats.BASKETBALL,
              note: null,
            },
            {
              family: "volleyball",
              status: "UNKNOWN",
              keys_active: 0,
              keys_pulled: 0,
              events_in_lab: stats.VOLLEYBALL,
              note: null,
            },
            { family: "hockey", status: "UNKNOWN", keys_active: 0, keys_pulled: 0, events_in_lab: stats.HOCKEY, note: null },
          ],
      readiness: {
        DATA_COLLECTION: stats.EVENTS_ANALYZED > 0 ? "READY" : "PENDING",
        MODEL_READINESS: "PARTIAL",
        STATISTICAL_READINESS: stats.SETTLED < 100 ? "INSUFFICIENT_SETTLED" : "PENDING_GATES",
        SETTLEMENT_READINESS: "READY",
        LEARNING_READINESS: stats.SETTLED > 0 ? "ACTIVE" : "WAITING_SETTLEMENTS",
        CAPITAL_STATUS: "CLOSED",
      },
    },
  };
}

export type ControlCenter049 = ReturnType<typeof buildControlCenter049>;
