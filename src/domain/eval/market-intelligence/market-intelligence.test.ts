import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMarketSignalsNotInModelFeatures,
  classifyTickTemporal,
  computeMarketSignals,
  filterEligibleTicks,
  quotesToTicks,
} from "@/domain/eval/market-intelligence";
import { classifyDecision048 } from "@/domain/eval/factory-048/decision";
import { triangulateMarket043 } from "@/domain/eval/live-043/triangulation";
import type { Quote039 } from "@/domain/eval/live-039/types";

function q(partial: {
  bookmaker: string;
  outcome: string;
  price: number;
  available_at: string;
}): Quote039 {
  return {
    event_id: "e1",
    market: "1X2",
    bookmaker: partial.bookmaker,
    outcome: partial.outcome,
    price: partial.price,
    source_quote_timestamp: partial.available_at,
    collected_at: partial.available_at,
    available_at: partial.available_at,
    raw_payload_hash: "h",
    temporal_class: "STRICT",
    match_status: "MATCH_EXACT",
    window: null,
    offset_seconds_from_kickoff: null,
    coverage_status: "COVERED",
  };
}

describe("market-intelligence", () => {
  it("firewall: available_at > asOf is NOT_ELIGIBLE", () => {
    const cls = classifyTickTemporal({
      available_at: "2026-09-09T12:00:00.000Z",
      asOf: "2026-09-09T11:00:00.000Z",
    });
    assert.equal(cls.status, "NOT_ELIGIBLE");
    const ticks = quotesToTicks([
      {
        event_id: "e1",
        market: "1X2",
        bookmaker: "a",
        selection: "HOME",
        price: 2.0,
        available_at: "2026-09-09T12:00:00.000Z",
        collected_at: "2026-09-09T12:00:00.000Z",
      },
      {
        event_id: "e1",
        market: "1X2",
        bookmaker: "a",
        selection: "HOME",
        price: 1.9,
        available_at: "2026-09-09T10:00:00.000Z",
        collected_at: "2026-09-09T10:00:00.000Z",
      },
    ]);
    const { eligible, blocked } = filterEligibleTicks(ticks, "2026-09-09T11:00:00.000Z");
    assert.equal(eligible.length, 1);
    assert.equal(blocked.length, 1);
  });

  it("detects steam from multi-book favorite implied rise", () => {
    const t0 = "2026-09-01T10:00:00.000Z";
    const t1 = "2026-09-01T18:00:00.000Z";
    // HOME fav: early ~2.10 (~0.476), late ~1.70 (~0.588) → large positive Δp
    const quotes = [
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "HOME", price: 2.1, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "DRAW", price: 3.4, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "AWAY", price: 3.5, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b2", selection: "HOME", price: 2.05, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b2", selection: "DRAW", price: 3.3, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b2", selection: "AWAY", price: 3.6, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "HOME", price: 1.7, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "DRAW", price: 3.8, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "AWAY", price: 5.0, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b2", selection: "HOME", price: 1.72, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b2", selection: "DRAW", price: 3.7, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b2", selection: "AWAY", price: 4.8, available_at: t1 },
    ];
    const snap = computeMarketSignals({
      eventId: "e1",
      market: "1X2",
      asOf: t1,
      quotes,
    });
    assert.equal(snap.steam_move, true);
    assert.equal(snap.movement_label, "steam");
    assert.ok((snap.delta_fav_p ?? 0) >= 0.02);
    assert.ok(snap.steam_books_aligned >= 2);
    assert.ok(snap.reason_codes.includes("STEAM_MOVE"));
    assert.equal(snap.volume, null);
    assert.equal(snap.volume_status, "UNAVAILABLE");
    assert.equal(snap.rlm_status, "UNAVAILABLE");
    assert.equal(snap.enters_independent_model, false);
  });

  it("future quotes do not change frozen as-of snapshot hash", () => {
    const t0 = "2026-09-01T10:00:00.000Z";
    const t1 = "2026-09-01T12:00:00.000Z";
    const asOf = t1;
    const base = [
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "HOME", price: 2.2, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "DRAW", price: 3.3, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "AWAY", price: 3.4, available_at: t0 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "HOME", price: 2.1, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "DRAW", price: 3.4, available_at: t1 },
      { event_id: "e1", market: "1X2", bookmaker: "b1", selection: "AWAY", price: 3.5, available_at: t1 },
    ];
    const a = computeMarketSignals({ eventId: "e1", market: "1X2", asOf, quotes: base });
    const withFuture = [
      ...base,
      {
        event_id: "e1",
        market: "1X2",
        bookmaker: "b1",
        selection: "HOME",
        price: 1.5,
        available_at: "2026-09-01T20:00:00.000Z",
      },
    ];
    const b = computeMarketSignals({ eventId: "e1", market: "1X2", asOf, quotes: withFuture });
    assert.equal(a.snapshot_hash, b.snapshot_hash);
    assert.equal(a.delta_fav_p, b.delta_fav_p);
  });

  it("volume stays UNAVAILABLE — never invented", () => {
    const snap = computeMarketSignals({
      eventId: "e1",
      market: "1X2",
      asOf: "2026-09-01T12:00:00.000Z",
      quotes: [
        {
          event_id: "e1",
          market: "1X2",
          bookmaker: "b1",
          selection: "HOME",
          price: 2.0,
          available_at: "2026-09-01T11:00:00.000Z",
        },
      ],
    });
    assert.equal(snap.volume, null);
    assert.ok(snap.reason_codes.includes("VOLUME_UNAVAILABLE"));
    assert.ok(snap.reason_codes.includes("RLM_UNAVAILABLE"));
  });

  it("assertMarketSignalsNotInModelFeatures bans drift/steam keys", () => {
    assert.throws(() => assertMarketSignalsNotInModelFeatures(["home_gf_l5", "steam_move"]));
    assert.throws(() => assertMarketSignalsNotInModelFeatures(["odds_drift_pct"]));
    assert.doesNotThrow(() => assertMarketSignalsNotInModelFeatures(["home_gf_l5", "strength_diff_pts"]));
  });

  it("triangulation movement is populated when history exists", () => {
    const t0 = "2026-09-01T10:00:00.000Z";
    const t1 = "2026-09-01T18:00:00.000Z";
    const quotes: Quote039[] = [
      q({ bookmaker: "b1", outcome: "HOME", price: 2.1, available_at: t0 }),
      q({ bookmaker: "b1", outcome: "DRAW", price: 3.4, available_at: t0 }),
      q({ bookmaker: "b1", outcome: "AWAY", price: 3.5, available_at: t0 }),
      q({ bookmaker: "b2", outcome: "HOME", price: 2.05, available_at: t0 }),
      q({ bookmaker: "b2", outcome: "DRAW", price: 3.3, available_at: t0 }),
      q({ bookmaker: "b2", outcome: "AWAY", price: 3.6, available_at: t0 }),
      q({ bookmaker: "b1", outcome: "HOME", price: 1.7, available_at: t1 }),
      q({ bookmaker: "b1", outcome: "DRAW", price: 3.8, available_at: t1 }),
      q({ bookmaker: "b1", outcome: "AWAY", price: 5.0, available_at: t1 }),
      q({ bookmaker: "b2", outcome: "HOME", price: 1.72, available_at: t1 }),
      q({ bookmaker: "b2", outcome: "DRAW", price: 3.7, available_at: t1 }),
      q({ bookmaker: "b2", outcome: "AWAY", price: 4.8, available_at: t1 }),
    ];
    const tri = triangulateMarket043({
      eventId: "e1",
      market: "1X2",
      sportKey: "soccer_epl",
      quotes,
      asOf: t1,
    });
    assert.equal(tri.status, "OK");
    assert.ok(tri.movement != null);
    assert.ok(Math.abs(tri.movement!) >= 0.02);
  });

  it("decision-048: liquidity low + weak edge → NO_BET or MODEL_UNCERTAIN", () => {
    const weak = classifyDecision048({
      edge: 0.04,
      confidence: 60,
      dataQuality: 0.5,
      dispersion: 0.05,
      hasMarket: true,
      marketOnly: false,
      liquidityProxyLow: true,
    });
    assert.ok(weak.decision === "NO_BET" || weak.decision === "MODEL_UNCERTAIN");
    assert.ok(weak.codes.includes("LIQUIDITY_PROXY_LOW"));

    const insuf = classifyDecision048({
      edge: 0.02,
      confidence: 50,
      dataQuality: 0.5,
      dispersion: null,
      hasMarket: true,
      marketOnly: false,
      marketSignalInsufficient: true,
    });
    assert.equal(insuf.decision, "NO_BET");
    assert.ok(insuf.codes.includes("MARKET_SIGNAL_INSUFFICIENT"));
  });
});
