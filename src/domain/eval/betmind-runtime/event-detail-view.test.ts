import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EVENT_DETAIL_BOARD_ONLY_NOTICE_IT,
  boardSummaryFromBoard,
  classifyEventDetailResponse,
  isDossierNotMirroredWithBoard,
  liveViewFromRow,
  matchTitleFromBoard,
  normalizeBoardSummary,
} from "@/domain/eval/betmind-runtime/event-detail-view";

const BOARD = {
  event_id: "ev-remote-1",
  bucket: "DISCOVERED",
  label: "Alpha vs Beta",
  competition: "Serie A",
  kickoff_utc: "2026-09-12T18:00:00Z",
  model_version: "bm-1",
  decision: "NO_BET",
  prediction_status: "INSUFFICIENT_DATA",
  feature_coverage: 0.12,
  analyzed_at: "2026-09-12T10:00:00.000Z",
};

describe("event-detail board-only view", () => {
  it("splits board label into teams without inventing names", () => {
    const summary = boardSummaryFromBoard("ev-remote-1", BOARD);
    assert.equal(summary.home_or_a, "Alpha");
    assert.equal(summary.away_or_b, "Beta");
    assert.equal(matchTitleFromBoard(summary), "Alpha vs Beta");
    assert.equal(boardSummaryFromBoard("ev-x", { label: "Solo label" }).home_or_a, null);
    assert.equal(boardSummaryFromBoard("ev-x", { label: "Solo label" }).away_or_b, null);
    assert.equal(matchTitleFromBoard(boardSummaryFromBoard("ev-x", { label: "Solo label" })), "Solo label");
  });

  it("treats dossier_not_mirrored + board_summary as board_only on 200 or 404", () => {
    const json = {
      error: "dossier_not_mirrored",
      reason: "board without dossier",
      notice_it: EVENT_DETAIL_BOARD_ONLY_NOTICE_IT,
      board_summary: BOARD,
    };
    assert.equal(isDossierNotMirroredWithBoard(json), true);

    const from200 = classifyEventDetailResponse({ ok: true, status: 200 }, json);
    assert.equal(from200.kind, "board_only");
    if (from200.kind === "board_only") {
      assert.equal(from200.summary.label, "Alpha vs Beta");
      assert.equal(from200.summary.decision, "NO_BET");
      assert.match(from200.notice_it, /specchio remoto/);
      assert.doesNotMatch(from200.notice_it, /Neon/i);
    }

    const from404 = classifyEventDetailResponse({ ok: false, status: 404 }, json);
    assert.equal(from404.kind, "board_only");
    if (from404.kind === "board_only") {
      assert.equal(from404.summary.competition, "Serie A");
    }
  });

  it("keeps true not_found as a red error even on 404", () => {
    const json = {
      error: "not_found",
      reason: "NO DATA AVAILABLE — Lab B assente",
      missing: ["analysis_dossier", "board_event"],
    };
    const classified = classifyEventDetailResponse({ ok: false, status: 404 }, json);
    assert.equal(classified.kind, "not_found");
    if (classified.kind === "not_found") {
      assert.match(classified.message, /not_found/);
      assert.match(classified.message, /NO DATA AVAILABLE/);
    }
    assert.equal(isDossierNotMirroredWithBoard(json), false);
    assert.equal(normalizeBoardSummary(null), null);
  });

  it("classifies research_failed without turning it into ok", () => {
    const classified = classifyEventDetailResponse(
      { ok: true, status: 200 },
      {
        dossier_state: "research_failed",
        reason: "adapters blocked",
        board_summary: BOARD,
      },
    );
    assert.equal(classified.kind, "research_failed");
  });

  it("prefers a real dossier over dossier_not_mirrored when both are present", () => {
    const classified = classifyEventDetailResponse(
      { ok: true, status: 200 },
      {
        error: "dossier_not_mirrored",
        dossier_state: "ok",
        dossier: { event: { event_id: "ev-1" }, independent_model: { probability: null } },
        board_summary: BOARD,
      },
    );
    assert.equal(classified.kind, "ok");
  });

  it("renders a published 0-0 + minute without inventing goals", () => {
    const live = liveViewFromRow({
      status: "LIVE",
      home_goals: 0,
      away_goals: 0,
      minute: "37'",
      source: "espn",
      observed_at: "2026-09-12T19:10:00.000Z",
      finished: false,
    });
    assert.ok(live);
    assert.equal(live.home_goals, 0);
    assert.equal(live.away_goals, 0);
    assert.equal(live.minute, "37'");
    assert.equal(`${live.home_goals}–${live.away_goals}`, "0–0");
    const fromScore = liveViewFromRow({
      status: "LIVE",
      score: "0-0",
      minute: "37'",
      source: "espn",
    });
    assert.equal(fromScore?.home_goals, 0);
    assert.equal(fromScore?.away_goals, 0);
  });

  it("does not treat a naked error as board_only without board_summary", () => {
    const classified = classifyEventDetailResponse(
      { ok: false, status: 404 },
      { error: "dossier_not_mirrored", reason: "missing summary" },
    );
    assert.equal(classified.kind, "not_found");
  });
});
