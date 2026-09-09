import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import {
  synthesizePrematchFacts,
  applySynthesisConfidenceAdjust,
  type SynthesisInputFact,
} from "@/domain/eval/data-intelligence/synthesis";
import type { SynthesisResult } from "@/domain/eval/data-intelligence/types";

function diRoot(labBRoot?: string): string {
  return join(piRoot(labBRoot), "data-intelligence");
}

export type EventDiContext = {
  synthesis: SynthesisResult;
  reason_codes: string[];
  confidence_adjust: ReturnType<typeof applySynthesisConfidenceAdjust>;
};

/** Load latest coverage summary from disk (no live calls). */
export function readDataIntelligenceCoverageSummary(labBRoot?: string): {
  DATA_COVERAGE: number | null;
  SOURCE_COUNT: number | null;
  SOURCE_AGREEMENT: number | null;
  TIMESTAMP_QUALITY: number | null;
  test_scrape_enabled: boolean;
} | null {
  const p = join(diRoot(labBRoot), "coverage-report.json");
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    return {
      DATA_COVERAGE: typeof j.avg_feature_coverage === "number" ? j.avg_feature_coverage : null,
      SOURCE_COUNT: typeof j.SOURCE_COUNT === "number" ? j.SOURCE_COUNT : null,
      SOURCE_AGREEMENT: typeof j.SOURCE_AGREEMENT === "number" ? j.SOURCE_AGREEMENT : null,
      TIMESTAMP_QUALITY: typeof j.TIMESTAMP_QUALITY === "number" ? j.TIMESTAMP_QUALITY : null,
      test_scrape_enabled: Boolean(j.test_scrape_enabled),
    };
  } catch {
    return null;
  }
}

/**
 * Build per-event DI context from known disk facts (home/away ids, kickoff day).
 * Does not fetch network; scrape observations passed in optionally.
 */
export function buildEventDiContext(input: {
  eventId: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  kickoffUtc?: string | null;
  featureCoverage?: number | null;
  confidence: number;
  dataQuality: number;
  extraFacts?: SynthesisInputFact[];
}): EventDiContext {
  const facts: SynthesisInputFact[] = [...(input.extraFacts ?? [])];
  if (input.homeTeam) {
    facts.push({
      source_id: "lab_b_event",
      field: "home_team",
      value: input.homeTeam.toLowerCase().replace(/\s+/g, ""),
    });
  }
  if (input.awayTeam) {
    facts.push({
      source_id: "lab_b_event",
      field: "away_team",
      value: input.awayTeam.toLowerCase().replace(/\s+/g, ""),
    });
  }
  if (input.kickoffUtc) {
    facts.push({
      source_id: "lab_b_event",
      field: "kickoff_day",
      value: input.kickoffUtc.slice(0, 10),
    });
  }

  const covSummary = readDataIntelligenceCoverageSummary();
  const synthesis = synthesizePrematchFacts({
    eventId: input.eventId,
    facts,
    dataCoverage: input.featureCoverage ?? covSummary?.DATA_COVERAGE ?? null,
    timestampQuality: covSummary?.TIMESTAMP_QUALITY ?? 0.5,
  });

  const codes = [...synthesis.reason_codes];
  if (covSummary?.test_scrape_enabled) codes.push("TEST_SCRAPE_CONTEXT");
  if (covSummary?.DATA_COVERAGE != null && covSummary.DATA_COVERAGE < 0.4) {
    codes.push("DATA_COVERAGE_LOW");
  }

  const confidence_adjust = applySynthesisConfidenceAdjust({
    confidence: input.confidence,
    dataQuality: input.dataQuality,
    synthesis: { ...synthesis, reason_codes: codes },
  });

  return {
    synthesis: { ...synthesis, reason_codes: [...new Set(codes)] },
    reason_codes: [...new Set([...codes, ...confidence_adjust.codes])],
    confidence_adjust,
  };
}

export function ensureDataIntelligenceContext(labBRoot?: string): {
  ok: boolean;
  coverage: ReturnType<typeof readDataIntelligenceCoverageSummary>;
} {
  const coverage = readDataIntelligenceCoverageSummary(labBRoot);
  return { ok: coverage != null, coverage };
}
