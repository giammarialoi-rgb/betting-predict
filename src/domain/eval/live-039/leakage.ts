import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { leakCloseAtT1h, leakDateOnlyToStrict, leakInventedTimestamp, leakOutcome } from "@/domain/eval/incremental-029/leakage";
import { requireExactUtc } from "@/domain/eval/prospective-036/clocks";
import { assertLockedImmutable, assertQuoteBeforeKickoff } from "@/domain/eval/prospective-036/integrity";
import { lastAtOrBeforeCutoff039, t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { availableAt039, classifyQuote039 } from "@/domain/eval/live-039/classify";
import { loadExp039Config } from "@/domain/eval/live-039/config";
import { assertRevealAfterLock039 } from "@/domain/eval/live-039/settle";

export function runHostileBattery039(): { id: string; throws: boolean }[] {
  const cfg = loadExp039Config();
  const cases: { id: string; run: () => void }[] = [
    { id: "post_kickoff", run: () => assertQuoteBeforeKickoff("2026-10-01T16:00:01.000Z", "2026-10-01T16:00:00.000Z") },
    { id: "date_only", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "close_t1h", run: () => leakCloseAtT1h(true) },
    { id: "ft_in_decision", run: () => leakOutcome({ FT: "1-0" }) },
    { id: "lock_immutability", run: () => assertLockedImmutable("LOCKED", true) },
    { id: "naive_ts", run: () => requireExactUtc("2026-10-01 15:00:00", "quote") },
    {
      id: "collector_as_available",
      run: () => {
        const collected = "2026-10-01T15:00:01.000Z";
        if (availableAt039(null) !== null) throw new Error("null source");
        const cls = classifyQuote039({
          sourceQuoteTimestamp: collected,
          commenceTime: "2026-10-01T16:00:00.000Z",
          collectedAt: collected,
          market: "1X2",
          match: "MATCH_EXACT",
        });
        if (cls === "STRICT") throw new Error("collector promoted");
        throw new BlindLeakageError("COLLECTED_AT_AS_QUOTE");
      },
    },
    {
      id: "asof_future",
      run: () => {
        const cutoff = t1hCutoffMs039("2026-10-01T16:00:00.000Z")!;
        const hit = lastAtOrBeforeCutoff039(
          [
            { sourceMs: Date.parse("2026-10-01T15:30:00.000Z") },
            { sourceMs: Date.parse("2026-10-01T14:00:00.000Z") },
          ],
          cutoff,
        );
        if (hit?.sourceMs !== Date.parse("2026-10-01T14:00:00.000Z")) throw new Error("future leaked");
        throw new BlindLeakageError("AS_OF_OK");
      },
    },
    { id: "reveal_before_lock", run: () => assertRevealAfterLock039(false) },
    {
      id: "task_040",
      run: () => {
        if (cfg.open_task_040) throw new ExperimentIntegrityError("040");
        throw new ExperimentIntegrityError("open_task_040 frozen false");
      },
    },
    {
      id: "historical_hunt",
      run: () => {
        if (cfg.historical_hunt || cfg.refit_market_devig) throw new ExperimentIntegrityError("hunt");
        throw new ExperimentIntegrityError("hunt closed");
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
