import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRealAnalysisDossier } from "@/domain/eval/betmind-runtime/remote-mirror";
import { classifyEventDetailResponse } from "@/domain/eval/betmind-runtime/event-detail-view";
import { pickGoldenEvent } from "@/domain/eval/betmind-runtime/golden-e2e/discover";
import { decidePrediction, runPredictionGates } from "@/domain/eval/betmind-runtime/golden-e2e/prediction";
import { NEON_IN_USE } from "@/domain/storage";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { DiscoveredCandidate } from "@/domain/eval/betmind-runtime/golden-e2e/discover";

function event(partial: Partial<PermanentEvent044> = {}): PermanentEvent044 {
  return {
    event_id: "ev-1",
    canonical_event_id: "ev-1",
    source: "openligadb",
    source_event_id: "1",
    sport: "soccer",
    competition: "Bundesliga",
    country: null,
    home_or_a: "Alpha",
    away_or_b: "Beta",
    kickoff_utc: "2026-09-12T14:30:00.000Z",
    collected_at_utc: "2026-09-12T10:00:00.000Z",
    available_at_utc: "2026-09-12T10:00:00.000Z",
    semantic_level: "RESEARCH",
    data_quality: 0.4,
    fingerprint: "fp-1",
    status: "UPCOMING",
    ...partial,
  };
}

describe("golden e2e integrity", () => {
  it("never uses Neon", () => {
    assert.equal(NEON_IN_USE, false);
  });

  it("picks upcoming over finished when both exist", () => {
    const finished: DiscoveredCandidate = {
      event: event({ event_id: "fin", status: "FINISHED", fingerprint: "f" }),
      source: "openligadb",
      finished: true,
      live: false,
      score: { home: 2, away: 1 },
      score_source: "openligadb",
      discovery_probes: [],
    };
    const upcoming: DiscoveredCandidate = {
      event: event({ event_id: "up", status: "UPCOMING", fingerprint: "u" }),
      source: "openligadb",
      finished: false,
      live: false,
      score: null,
      score_source: null,
      discovery_probes: [],
    };
    const pick = pickGoldenEvent([finished, upcoming]);
    assert.equal(pick?.event.event_id, "up");
  });

  it("does not emit PREDICTION when gates fail", () => {
    const { allowed, gates } = runPredictionGates({
      event: event(),
      dossier: null,
      predictOk: false,
      probability: null,
      modelVersion: "NO_PREDICTION",
      reasonCodes: ["INSUFFICIENT_DATA"],
      featureCoverage: 0.05,
    });
    assert.equal(allowed, false);
    assert.ok(gates.some((g) => g.name === "independent_model" && !g.passed));

    const outcome = decidePrediction({ event: event(), dossier: null, labBRoot: "/tmp/no-lab" });
    assert.equal(outcome.kind, "NO_PREDICTION");
    if (outcome.kind === "NO_PREDICTION") {
      assert.ok(outcome.failed_gates.length > 0);
      assert.doesNotMatch(outcome.reason, /analisi completata/i);
    }
  });

  it("does not treat board_summary as analysis_dossier", () => {
    assert.equal(
      isRealAnalysisDossier({
        event_id: "ev",
        bucket: "ANALYZED",
        label: "A vs B",
        feature_coverage: 0.9,
      }),
      false,
    );
  });

  it("classifies research_running and local_only without faking a dossier", () => {
    const running = classifyEventDetailResponse(
      { ok: true, status: 200 },
      {
        dossier_state: "research_running",
        notice_it: "Ricerca in corso",
        board_summary: { event_id: "ev-1", label: "A vs B" },
      },
    );
    assert.equal(running.kind, "research_running");

    const local = classifyEventDetailResponse(
      { ok: true, status: 200 },
      {
        dossier_state: "local_only",
        dossier: { event: { event_id: "ev-1" }, features: [] },
        notice_it: "locale",
      },
    );
    assert.equal(local.kind, "local_only");
  });
});
