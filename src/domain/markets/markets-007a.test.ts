import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMarket,
  isMarketType,
  listMarkets,
  listMarketsByReadiness,
  listMarketsForSport,
  parseMarketLine,
  isHalfLine,
  isAsianQuarterLine,
  splitAsianQuarterLine,
  marketIdentityKey,
  evaluateMarketOutcome,
  discoverMarketsFromOffers,
  buildBookmakerMarketMatrix,
  findBestPrice,
  findMissingMarkets,
  marketOverroundForBook,
  selectPricePath,
  assertClosingNotUsedBeforeKickoff,
  crossBookDispersion,
  candidateFeaturesForMarket,
  computeMarketCoverageScore,
  MARKET_CORRELATION_PAIRS,
  findBestSupportedOpportunities,
} from "@/domain/markets";

describe("market taxonomy 007-A", () => {
  it("keeps market ids unique and typed", () => {
    const ids = listMarkets().map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.equal(isMarketType(id), true);
    }
  });

  it("does not treat winner as universal across sports", () => {
    const football = listMarketsForSport("football").map((item) => item.id);
    const f1 = listMarketsForSport("formula-1").map((item) => item.id);
    assert.ok(football.includes("draw"));
    assert.equal(f1.includes("draw"), false);
    assert.ok(f1.includes("race_winner"));
    assert.equal(football.includes("race_winner"), false);
    assert.equal(getMarket("winner")?.selectionKind, "n_way");
  });

  it("returns no markets for an unknown sport", () => {
    assert.deepEqual(listMarketsForSport("quidditch"), []);
  });

  it("lists football-specific catalogue capabilities", () => {
    const ids = listMarketsForSport("football").map((m) => m.id);
    for (const id of [
      "result",
      "total_goals",
      "both_teams_to_score",
      "asian_handicap",
      "corner_total",
      "card_total",
      "player_shots_on_target",
    ]) {
      assert.ok(ids.includes(id), id);
    }
  });

  it("distinguishes CATALOG_CAPABILITY from MODEL_READY", () => {
    assert.ok(listMarketsByReadiness("CATALOG_CAPABILITY").length > 0);
    assert.equal(listMarketsByReadiness("MODEL_READY").length, 0);
  });

  it("marks line markets with requiresLine", () => {
    assert.equal(getMarket("total_goals")?.requiresLine, true);
    assert.equal(getMarket("result")?.requiresLine, false);
    assert.equal(getMarket("player_goals")?.requiresPlayer, true);
  });
});

describe("line engine", () => {
  it("parses half and asian quarter lines", () => {
    assert.equal(parseMarketLine(2.5).value, 2.5);
    assert.equal(isHalfLine(2.5), true);
    assert.equal(isAsianQuarterLine(-0.25), true);
    assert.deepEqual(splitAsianQuarterLine(-0.25), [-0, -0.5]);
  });

  it("keeps market_type|selection|line identity separate from fused ids", () => {
    const key = marketIdentityKey({
      marketType: "total_goals",
      selection: "OVER",
      line: 2.5,
    });
    assert.equal(key.includes("total_goals"), true);
    assert.equal(key.includes("OVER"), true);
    assert.equal(key.includes("over_2_5"), false);
  });
});

describe("outcome engine", () => {
  const facts = {
    ftHome: 2,
    ftAway: 1,
    htHome: 1,
    htAway: 0,
    homeCorners: 5,
    awayCorners: 2,
    homeYellow: 2,
    awayYellow: 1,
    homeRed: 0,
    awayRed: 0,
  };

  it("settles 1X2 result", () => {
    assert.equal(evaluateMarketOutcome({ marketId: "result", facts }).selection, "HOME");
  });

  it("settles total goals over/under 2.5", () => {
    assert.equal(
      evaluateMarketOutcome({ marketId: "total_goals", line: 2.5, facts }).selection,
      "OVER",
    );
  });

  it("settles BTTS", () => {
    assert.equal(
      evaluateMarketOutcome({ marketId: "both_teams_to_score", facts }).selection,
      "YES",
    );
  });

  it("settles corner totals", () => {
    assert.equal(
      evaluateMarketOutcome({ marketId: "corner_total", line: 5.5, facts }).selection,
      "OVER",
    );
  });

  it("settles card totals", () => {
    assert.equal(
      evaluateMarketOutcome({ marketId: "card_total", line: 2.5, facts }).selection,
      "OVER",
    );
  });

  it("settles player threshold", () => {
    assert.equal(
      evaluateMarketOutcome({
        marketId: "player_shots_on_target",
        line: 1.5,
        facts,
        playerStat: 2,
      }).selection,
      "OVER",
    );
  });

  it("voids draw-no-bet on draw", () => {
    const r = evaluateMarketOutcome({
      marketId: "draw_no_bet",
      facts: { ...facts, ftHome: 1, ftAway: 1 },
    });
    assert.equal(r.status, "void");
  });

  it("returns unavailable when corners missing", () => {
    const r = evaluateMarketOutcome({
      marketId: "corner_total",
      line: 5.5,
      facts: { ftHome: 1, ftAway: 0 },
    });
    assert.equal(r.status, "unavailable");
  });
});

describe("market discovery and matrix", () => {
  const t0 = new Date("2024-01-01T12:00:00.000Z");
  const t1 = new Date("2024-01-01T15:00:00.000Z");
  const offers = [
    {
      eventId: "e1",
      sportId: "football",
      bookmakerSlug: "bet365",
      providerSlug: "mock-odds",
      marketId: "result",
      line: null,
      selection: "HOME",
      observedAt: t0,
      availableAt: t0,
      oddsDecimal: 1.9,
    },
    {
      eventId: "e1",
      sportId: "football",
      bookmakerSlug: "bet365",
      providerSlug: "mock-odds",
      marketId: "result",
      line: null,
      selection: "DRAW",
      observedAt: t0,
      availableAt: t0,
      oddsDecimal: 3.4,
    },
    {
      eventId: "e1",
      sportId: "football",
      bookmakerSlug: "bet365",
      providerSlug: "mock-odds",
      marketId: "total_goals",
      line: 2.5,
      selection: "OVER",
      observedAt: t0,
      availableAt: t0,
      oddsDecimal: 1.85,
    },
    {
      eventId: "e1",
      sportId: "football",
      bookmakerSlug: "pinnacle",
      providerSlug: "mock-odds",
      marketId: "result",
      line: null,
      selection: "HOME",
      observedAt: t1,
      availableAt: t1,
      oddsDecimal: 2.05,
    },
  ];

  it("discovers per-bookmaker market sets without assuming equality", () => {
    const records = discoverMarketsFromOffers(offers);
    assert.ok(records.some((r) => r.bookmakerSlug === "bet365" && r.marketId === "total_goals"));
    assert.equal(
      records.some((r) => r.bookmakerSlug === "pinnacle" && r.marketId === "total_goals"),
      false,
    );
  });

  it("builds as-of matrix and finds best price without recommending bets", () => {
    const matrix = buildBookmakerMarketMatrix(offers, t1);
    const best = findBestPrice(matrix, {
      eventId: "e1",
      marketId: "result",
      selection: "HOME",
    });
    assert.equal(best?.bookmakerSlug, "pinnacle");
    assert.equal(best?.oddsDecimal, 2.05);
  });

  it("detects missing markets per bookmaker", () => {
    const matrix = buildBookmakerMarketMatrix(offers, t1);
    const missing = findMissingMarkets({
      eventId: "e1",
      expectedMarketIds: ["result", "total_goals", "both_teams_to_score"],
      cells: matrix,
      bookmakerSlug: "pinnacle",
    });
    assert.deepEqual(missing.sort(), ["both_teams_to_score", "total_goals"]);
  });

  it("computes market-specific binary overround", () => {
    const r = marketOverroundForBook({
      marketId: "total_goals",
      oddsBySelection: { OVER: 1.9, UNDER: 1.9 },
    });
    assert.equal(r.selectionCount, 2);
    assert.ok(r.overround > 1);
    assert.equal(r.method, "binary_sum_implied");
  });

  it("computes ternary overround for result", () => {
    const r = marketOverroundForBook({
      marketId: "result",
      oddsBySelection: { HOME: 2, DRAW: 3.5, AWAY: 3.5 },
    });
    assert.equal(r.selectionCount, 3);
  });
});

describe("microstructure and coverage", () => {
  it("blocks closing usage before kickoff", () => {
    assert.throws(
      () =>
        assertClosingNotUsedBeforeKickoff(
          new Date("2024-01-01T11:00:00.000Z"),
          new Date("2024-01-01T15:00:00.000Z"),
          true,
        ),
      /LEAKAGE/,
    );
  });

  it("summarizes cross-book dispersion", () => {
    const d = crossBookDispersion([1.9, 2.0, 2.1]);
    assert.ok(d);
    assert.equal(d.count, 3);
    assert.equal(d.min, 1.9);
    assert.equal(d.max, 2.1);
  });

  it("selects opening/current and hides closing before kickoff", () => {
    const kickoff = new Date("2024-01-01T18:00:00.000Z");
    const cells = [
      {
        eventId: "e1",
        bookmakerSlug: "bet365",
        marketId: "result",
        line: null,
        selection: "HOME",
        availableAt: new Date("2024-01-01T10:00:00.000Z"),
        oddsDecimal: 2.0,
        providerSlug: "mock",
      },
      {
        eventId: "e1",
        bookmakerSlug: "bet365",
        marketId: "result",
        line: null,
        selection: "HOME",
        availableAt: new Date("2024-01-01T14:00:00.000Z"),
        oddsDecimal: 1.95,
        providerSlug: "mock",
      },
    ];
    const path = selectPricePath(cells, {
      eventId: "e1",
      bookmakerSlug: "bet365",
      marketId: "result",
      selection: "HOME",
      scheduledStartAt: kickoff,
      asOf: new Date("2024-01-01T15:00:00.000Z"),
    });
    assert.equal(path.opening?.oddsDecimal, 2.0);
    assert.equal(path.current?.oddsDecimal, 1.95);
    assert.equal(path.closing, null);
  });

  it("maps candidate features per market without auto-approval", () => {
    assert.ok(candidateFeaturesForMarket("result").includes("elo_difference"));
    assert.ok(candidateFeaturesForMarket("corner_total").length > 0);
  });

  it("computes observable coverage score without invented reliability", () => {
    const s = computeMarketCoverageScore({
      marketId: "result",
      expectedFields: 10,
      presentFields: 8,
      bookmakerCount: 3,
      historicalSampleSize: 1000,
      exactPrecisionCount: 900,
      precisionSampleSize: 1000,
      featureExpected: 5,
      featurePresent: 4,
      outcomesKnown: 950,
      outcomesTotal: 1000,
    });
    assert.equal(s.bookmakerCount, 3);
    assert.ok(s.marketDataCompleteness !== null);
  });

  it("declares correlation pairs for study only", () => {
    assert.ok(MARKET_CORRELATION_PAIRS.length >= 4);
    assert.ok(
      MARKET_CORRELATION_PAIRS.every((p) => p.status === "DECLARED_FOR_STUDY"),
    );
  });

  it("findBestSupportedOpportunities never invents confidence", () => {
    const out = findBestSupportedOpportunities({
      sportId: "football",
      asOf: new Date(),
      candidates: [
        {
          eventId: "e1",
          marketId: "total_goals",
          line: 2.5,
          selection: "UNDER",
          modelProbability: null,
          marketProbability: 0.55,
          differencePp: null,
          uncertainty: null,
          dataCompleteness: 0.9,
          temporalIntegrity: "STRICT",
          evidence: [],
          contradictingEvidence: [],
          confidence: null,
        },
      ],
    });
    assert.equal(out[0]?.confidence, null);
    assert.equal(out[0]?.marketId, "total_goals");
  });
});
