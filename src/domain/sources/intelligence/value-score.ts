/**
 * Decomposable source value score — components may be UNKNOWN.
 * NEVER emits a reliability percentage.
 */

import type { ScoreComponent, SourceIntelligence, SourceValueScore } from "./types";

function known(n: number): ScoreComponent {
  return Math.min(1, Math.max(0, n));
}

export function computeSourceValueScore(s: SourceIntelligence): SourceValueScore {
  const notes: string[] = [
    "NOT a reliability percentage",
    "UNKNOWN components stay UNKNOWN — never invent",
  ];

  const caps = s.capabilities.length;
  const coverage_score = known(Math.min(1, caps / 8));

  const temporal_score: ScoreComponent =
    s.temporalPrecision === "unknown" ? "UNKNOWN" : known(
      s.temporalPrecision === "exact" || s.temporalPrecision === "minute"
        ? 1
        : s.temporalPrecision === "date"
          ? 0.6
          : 0.4,
    );

  const granularity_score = known(
    (s.playerStats ? 0.25 : 0) +
      (s.eventStats ? 0.25 : 0) +
      (s.tracking ? 0.25 : 0) +
      (s.lineups ? 0.15 : 0) +
      (s.injuries ? 0.1 : 0),
  );

  const historical_score: ScoreComponent = s.historicalDepth
    ? known(
        s.historicalDepth.includes("20") || s.historicalDepth.includes("decade")
          ? 1
          : s.historicalDepth.includes("season")
            ? 0.5
            : 0.3,
      )
    : "UNKNOWN";

  const provenance_score: ScoreComponent =
    s.reliability === "unknown"
      ? "UNKNOWN"
      : s.role === "SOURCE" || s.role === "UPSTREAM"
        ? known(0.8)
        : s.role === "PROVIDER"
          ? known(0.5)
          : known(0.3);

  const independence_score: ScoreComponent = s.independenceCluster
    ? known(s.role === "AGGREGATOR" || s.role === "BOOKMAKER" ? 0.2 : 0.7)
    : "UNKNOWN";

  const access_score = known(
    s.access === "dataset" || s.access === "public_api" || s.access === "official_api"
      ? s.licensing === "open" || s.licensing === "free_api"
        ? 1
        : 0.5
      : s.access === "licensed_feed" || s.access === "bookmaker"
        ? 0.2
        : 0.35,
  );

  const parts = [
    coverage_score,
    temporal_score,
    granularity_score,
    historical_score,
    provenance_score,
    independence_score,
    access_score,
  ];
  const numeric = parts.filter((p): p is number => typeof p === "number");
  const composite: ScoreComponent =
    numeric.length < 3
      ? "UNKNOWN"
      : known(numeric.reduce((a, b) => a + b, 0) / numeric.length);

  if (composite === "UNKNOWN") {
    notes.push("composite UNKNOWN — insufficient verified components");
  }

  return {
    sourceId: s.id,
    coverage_score,
    temporal_score,
    granularity_score,
    historical_score,
    provenance_score,
    independence_score,
    access_score,
    composite,
    notes,
  };
}
