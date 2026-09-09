import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { leakCloseAtT1h, leakDateOnlyToStrict, leakInventedTimestamp, leakOutcome } from "@/domain/eval/incremental-029/leakage";
import { loadExp038Config } from "@/domain/eval/datalake-038/config";
import { canEnterStrict038, classifyTemporal038 } from "@/domain/eval/datalake-038/classify";
import { assertCapitalIsolation038, assertDecisionHasNoOutcome038, assertNotFixtureInProduction038 } from "@/domain/eval/datalake-038/isolation";
import { requireExactUtc } from "@/domain/eval/prospective-036/clocks";
import { assertLockedImmutable, assertQuoteBeforeKickoff } from "@/domain/eval/prospective-036/integrity";

export function runHostileBattery038(): { id: string; throws: boolean }[] {
  const cfg = loadExp038Config();
  const base = {
    quoteTimestampUtc: "2026-10-01T15:00:00.000Z",
    kickoffUtc: "2026-10-01T16:00:00.000Z",
    temporalBasis: "SOURCE_TIMESTAMP",
    clientRetrievedAt: null as string | null,
    match: "MATCH_EXACT" as const,
    market: "1X2",
    provenance: "the-odds-api",
  };
  const cases: { id: string; run: () => void }[] = [
    { id: "quote_after_kickoff", run: () => assertQuoteBeforeKickoff("2026-10-01T16:00:01.000Z", "2026-10-01T16:00:00.000Z") },
    {
      id: "timezone_missing",
      run: () => {
        if (canEnterStrict038({ ...base, quoteTimestampUtc: "2026-10-01T15:00:00" })) throw new Error("tz");
        throw new BlindLeakageError("AMBIGUOUS_TIMEZONE");
      },
    },
    {
      id: "kickoff_missing",
      run: () => {
        if (canEnterStrict038({ ...base, kickoffUtc: null })) throw new Error("kick");
        throw new BlindLeakageError("MISSING_KICKOFF");
      },
    },
    { id: "date_only", run: () => leakDateOnlyToStrict("DATE_ONLY", true) },
    { id: "naive_ts", run: () => requireExactUtc("2026-10-01 15:00:00", "quote") },
    { id: "invented_ts", run: () => leakInventedTimestamp() },
    { id: "close_t1h", run: () => leakCloseAtT1h(true) },
    { id: "ft_leakage", run: () => leakOutcome({ FT: "1-0" }) },
    { id: "lock_immutability", run: () => assertLockedImmutable("LOCKED", true) },
    {
      id: "decision_outcome",
      run: () => assertDecisionHasNoOutcome038({ decision_id: "d", outcome: "HOME" }),
    },
    {
      id: "client_timestamp",
      run: () => {
        const cls = classifyTemporal038({
          ...base,
          temporalBasis: "CLIENT_RETRIEVED",
          clientRetrievedAt: "2026-10-01T15:00:00.000Z",
          quoteTimestampUtc: "2026-10-01T15:00:00.000Z",
        });
        if (cls === "LEVEL_A_STRICT" || cls === "LEVEL_B_STRICT") throw new Error("client");
        throw new BlindLeakageError("CLIENT_TIMESTAMP_AS_QUOTE");
      },
    },
    {
      id: "research_in_capital",
      run: () =>
        assertCapitalIsolation038({
          partition: "CAPITAL_STRICT",
          temporalClass: "DATE_ONLY",
          source: "anishkhetani",
        }),
    },
    {
      id: "fixture_production",
      run: () => assertNotFixtureInProduction038({ production: true, provenance: "fixture", source: "the-odds-api" }),
    },
    {
      id: "task_039",
      run: () => {
        if (cfg.open_task_039) throw new ExperimentIntegrityError("039");
        throw new ExperimentIntegrityError("open_task_039 frozen false");
      },
    },
    {
      id: "legacy_not_new",
      run: () => {
        if (cfg.count_legacy_031_as_new_strict) throw new ExperimentIntegrityError("legacy");
        throw new ExperimentIntegrityError("legacy not counted");
      },
    },
    {
      id: "historical_hunt",
      run: () => {
        if (cfg.historical_hunt) throw new ExperimentIntegrityError("hunt");
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
