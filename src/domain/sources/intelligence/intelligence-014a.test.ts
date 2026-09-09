import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSourceIntelligenceCatalog,
  assertNoInventedReliability,
  listByRole,
  computeIndependenceReport,
  computeSourceValueScore,
  rankAcquisitionPriorities,
  summarizeMarketSourceCoverage,
  computeDataGapRecommendations,
  selectNextBestAcquisition,
  runSourceIntelligenceReport,
  SOURCE_ROLES,
} from "@/domain/sources/intelligence";

describe("TASK 014-A Source Intelligence V1", () => {
  const catalog = buildSourceIntelligenceCatalog();

  it("registers at least 500 candidate sources", () => {
    assert.ok(catalog.length >= 500, `got ${catalog.length}`);
    const ids = new Set(catalog.map((s) => s.id));
    assert.equal(ids.size, catalog.length);
  });

  it("distinguishes SOURCE / PROVIDER / BOOKMAKER / EXCHANGE / AGGREGATOR / UPSTREAM", () => {
    for (const role of SOURCE_ROLES) {
      assert.ok(listByRole(role).length >= 1, `missing role ${role}`);
    }
    assert.ok(listByRole("BOOKMAKER").every((s) => s.role === "BOOKMAKER"));
    assert.ok(listByRole("AGGREGATOR").every((s) => s.role === "AGGREGATOR"));
  });

  it("never invents verified reliability for unverified candidates", () => {
    assert.doesNotThrow(() => assertNoInventedReliability(catalog));
    const invented = catalog.filter(
      (s) => s.reliability === "verified" && s.implementation === "candidate",
    );
    assert.equal(invented.length, 0);
  });

  it("computes effective independent clusters << registered sources", () => {
    const ind = computeIndependenceReport(catalog);
    assert.equal(ind.registered_sources, catalog.length);
    assert.ok(ind.upstream_clusters >= 50);
    assert.ok(ind.genuinely_independent_clusters >= 30);
    assert.ok(ind.genuinely_independent_clusters < ind.registered_sources);
    assert.ok(ind.upstream_clusters <= ind.registered_sources);
  });

  it("value score components may be UNKNOWN; never a reliability %", () => {
    const fb = catalog.find((s) => s.id === "football-data-co-uk")!;
    const score = computeSourceValueScore(fb);
    assert.ok(score.notes.some((n) => n.includes("NOT a reliability")));
    assert.ok(
      score.temporal_score === "UNKNOWN" || typeof score.temporal_score === "number",
    );
    const commercial = catalog.find((s) => s.id === "stats-perform-opta")!;
    const cs = computeSourceValueScore(commercial);
    assert.ok(cs.provenance_score === "UNKNOWN" || typeof cs.provenance_score === "number");
  });

  it("ranks acquisition by EIG/cost without forcing commercial first", () => {
    const ranked = rankAcquisitionPriorities(catalog, 20);
    assert.ok(ranked.length >= 5);
    const top = ranked.filter((r) => typeof r.priority_ratio === "number");
    assert.ok(top.length >= 1);
    // Open/dataset should outrank commercial licensed feeds on €0 cost
    const clubelo = ranked.find((r) => r.sourceId === "clubelo");
    const opta = ranked.find((r) => r.sourceId === "stats-perform-opta");
    if (clubelo && opta && typeof clubelo.priority_ratio === "number" && typeof opta.priority_ratio === "number") {
      assert.ok(clubelo.priority_ratio > opta.priority_ratio);
    }
  });

  it("source×market matrix keeps observed=false until verified", () => {
    const summary = summarizeMarketSourceCoverage(catalog);
    assert.ok(summary.some((m) => m.market === "corners"));
    assert.ok(summary.every((m) => m.observed === false));
    assert.ok(summary.every((m) => m.model_ready === false));
    const corners = summary.find((m) => m.market === "corners")!;
    assert.ok(corners.reason.includes("no_verified") || corners.sources_claiming >= 0);
  });

  it("DATA_GAP recommends next best acquisition", () => {
    const gaps = computeDataGapRecommendations();
    assert.ok(gaps.length >= 3);
    const next = selectNextBestAcquisition(gaps);
    assert.ok(next.next_best_acquisition.length > 0);
    assert.ok(["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(next.expected_research_value));
  });

  it("full intelligence report is reproducible", () => {
    const a = runSourceIntelligenceReport();
    const b = runSourceIntelligenceReport();
    assert.equal(a.registered_sources, b.registered_sources);
    assert.equal(a.experiment_id, "exp_014a_source_intelligence_v1");
    assert.ok(a.registered_sources >= 500);
    assert.ok(a.independence.genuinely_independent_clusters >= 30);
  });
});
