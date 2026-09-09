import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { isCapitalClass038 } from "@/domain/eval/datalake-038/classify";
import type { Partition038, TemporalClass038 } from "@/domain/eval/datalake-038/types";

export function assertCapitalIsolation038(record: {
  partition: Partition038;
  temporalClass: TemporalClass038;
  source: string;
}): void {
  if (record.partition !== "CAPITAL_STRICT") return;
  if (!isCapitalClass038(record.temporalClass)) {
    throw new ExperimentIntegrityError("RESEARCH_IN_CAPITAL");
  }
  if (record.source === "fixture" || record.source.startsWith("research-")) {
    throw new ExperimentIntegrityError("RESEARCH_IN_CAPITAL");
  }
}

export function assertNotFixtureInProduction038(input: { production: boolean; provenance: string; source: string }): void {
  if (!input.production) return;
  const p = input.provenance.toLowerCase();
  if (p.includes("fixture") || input.source === "fixture") {
    throw new ExperimentIntegrityError("FIXTURE_IN_PRODUCTION_LEDGER");
  }
}

export function assertDecisionHasNoOutcome038(dec: object): void {
  const rec = dec as Record<string, unknown>;
  for (const key of ["outcome", "ft_home", "ft_away", "FT", "HT", "settlement", "full_time"]) {
    if (key in rec && rec[key] != null) {
      throw new ExperimentIntegrityError("OUTCOME_IN_DECISION_CONTEXT");
    }
  }
}

export function partitionForClass038(cls: TemporalClass038, capital: boolean): Partition038 {
  if (capital && (cls === "LEVEL_A_STRICT" || cls === "LEVEL_B_STRICT")) return "CAPITAL_STRICT";
  if (cls === "INVALID" || cls === "AMBIGUOUS" || cls === "POSTMATCH") return "QUARANTINE";
  return "RESEARCH_ONLY";
}
