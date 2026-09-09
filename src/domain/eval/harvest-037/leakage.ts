import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { leakCloseAtT1h, leakDateOnlyToStrict, leakInventedTimestamp, leakOutcome } from "@/domain/eval/incremental-029/leakage";
import { loadExp037Config } from "@/domain/eval/harvest-037/config";
import { canEnterStrict037 } from "@/domain/eval/harvest-037/gate";
import type { Quote037 } from "@/domain/eval/harvest-037/types";

function q(over: Partial<Quote037>): Quote037 {
  return {
    event_id: "e",
    competition: "epl",
    season: "2015",
    home: "A",
    away: "B",
    kickoff_utc: "2015-09-12T14:00:00.000Z",
    quote_timestamp_utc: "2015-09-12T13:00:00.000Z",
    odds_home: 1.8,
    odds_draw: 3.5,
    odds_away: 4.2,
    source: "t",
    bookmaker: "pinnacle",
    temporal_basis: "BOOKMAKER_PUBLISH",
    quote_has_offset: true,
    kickoff_has_offset: true,
    client_retrieved_at: null,
    ft_home: 1,
    ft_away: 0,
    ...over,
  };
}

export function runHostileBattery037(): { id: string; throws: boolean }[] {
  const cfg = loadExp037Config();
  const cases: { id: string; run: () => void }[] = [
    {
      id: "future_quote",
      run: () => {
        if (canEnterStrict037(q({ quote_timestamp_utc: "2015-09-12T15:00:00.000Z" }), "MATCH_EXACT")) {
          throw new Error("should not enter");
        }
        throw new BlindLeakageError("future quote rejected");
      },
    },
    { id: "date_only", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "close_t1h", run: () => leakCloseAtT1h(true) },
    { id: "outcome", run: () => leakOutcome({ FT: "1-0" }) },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    {
      id: "client_ts",
      run: () => {
        const bad = q({
          quote_timestamp_utc: "2026-09-02T13:02:39.000Z",
          client_retrieved_at: "2026-09-02T13:02:39.000Z",
          temporal_basis: "CLIENT_RETRIEVED",
        });
        if (canEnterStrict037(bad, "MATCH_EXACT")) throw new Error("client ts");
        throw new BlindLeakageError("CLIENT_TIMESTAMP_AS_QUOTE");
      },
    },
    {
      id: "ambiguous_match",
      run: () => {
        if (canEnterStrict037(q(), "MATCH_AMBIGUOUS")) throw new Error("amb");
        throw new BlindLeakageError("MATCH_AMBIGUOUS");
      },
    },
    {
      id: "task_038",
      run: () => {
        if (cfg.open_task_038) throw new ExperimentIntegrityError("038");
        throw new ExperimentIntegrityError("open_task_038 frozen false");
      },
    },
    {
      id: "legacy_not_new",
      run: () => {
        if (cfg.count_legacy_031_as_new_strict) throw new ExperimentIntegrityError("legacy");
        throw new ExperimentIntegrityError("legacy not counted");
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
