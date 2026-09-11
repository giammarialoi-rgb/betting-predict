import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { favoriteClassName, favoriteTone, pickFavorite1x2 } from "@/domain/eval/light-analysis/favorite";
import {
  bttsRate,
  buildLightMarkets,
  cornersLean,
  empirical1x2,
  overRate,
  rateFromFlags,
  splitPriors,
  teamOverRate,
} from "@/domain/eval/light-analysis/frequencies";
import { computeLightAnalysis, lightHasEstimableMarket } from "@/domain/eval/light-analysis/compute";
import { shouldReplaceLightAnalysis } from "@/domain/eval/light-analysis/persist";
import { parseClubFootballHistory, parseFootballDataCoUkHistory } from "@/domain/eval/light-analysis/history";
import { proseFromMarkets } from "@/domain/eval/light-analysis/prose";
import { listMarketLeans } from "@/domain/eval/light-analysis/list-leans";
import {
  LIGHT_INSUFFICIENT_IT,
  LIGHT_MIN_N,
  LIGHT_MISSING_UI,
  type HistoricalMatchRow,
} from "@/domain/eval/light-analysis/types";
import { lightNamesMatch } from "@/domain/eval/light-analysis/aliases";
import {
  clearLightHistoryMemory,
  loadLightHistory,
  looksLikeFdoukCsv,
  parseOpenFootballHistory,
} from "@/domain/eval/light-analysis/fetch-history";
import { leagueTitleIt } from "@/domain/eval/light-analysis/league-label";

function row(
  home: string,
  away: string,
  date: string,
  hg: number,
  ag: number,
  extra?: Partial<HistoricalMatchRow>,
): HistoricalMatchRow {
  return {
    home,
    away,
    date,
    home_goals: hg,
    away_goals: ag,
    home_corners: extra?.home_corners ?? null,
    away_corners: extra?.away_corners ?? null,
    league: extra?.league ?? "E0",
    source_id: extra?.source_id ?? "football-data-co-uk",
  };
}

describe("light frequency helpers", () => {
  it("rateFromFlags returns insufficient below min N", () => {
    const r = rateFromFlags([true, true, false], LIGHT_MIN_N);
    assert.equal(r.status, "INSUFFICIENT");
    assert.equal(r.probability, null);
    assert.equal(r.n, 3);
  });

  it("rateFromFlags counts only real flags", () => {
    const flags = [true, true, true, false, false, true, true, true];
    const r = rateFromFlags(flags, 8);
    assert.equal(r.status, "OK");
    assert.equal(r.probability, 6 / 8);
  });

  it("overRate uses totals already measured", () => {
    const totals = [1, 2, 3, 4, 2, 1, 5, 3, 0, 4];
    const r = overRate(totals, 2.5, 8);
    assert.equal(r.status, "OK");
    assert.equal(r.probability, 5 / 10);
  });

  it("bttsRate and teamOverRate stay null when history is short", () => {
    assert.equal(bttsRate([{ home: 1, away: 1 }], 8).status, "INSUFFICIENT");
    assert.equal(teamOverRate([2, 1, 0], 1.5, 8).probability, null);
  });

  it("empirical1x2 blends home-home and away-away without inventing rows", () => {
    const homeHome: Array<"H" | "D" | "A"> = Array.from({ length: 10 }, (_, i) =>
      i < 6 ? "H" : i < 8 ? "D" : "A",
    );
    const awayAway: Array<"H" | "D" | "A"> = Array.from({ length: 10 }, (_, i) =>
      i < 2 ? "H" : i < 5 ? "D" : "A",
    );
    const p = empirical1x2(homeHome, awayAway, 8);
    assert.equal(p.home.status, "OK");
    assert.ok(p.home.probability != null && p.home.probability > p.away.probability!);
    assert.equal(p.home.n, 20);
  });

  it("empirical1x2 is insufficient when both sides lack sample", () => {
    const p = empirical1x2(["H", "D"], ["A"], 8);
    assert.equal(p.home.status, "INSUFFICIENT");
    assert.equal(p.home.probability, null);
  });

  it("cornersLean uses only rows with real corner counts", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      home: i < 6 ? 7 : 3,
      away: i < 6 ? 3 : 8,
    }));
    const c = cornersLean(rows, 5);
    assert.equal(c.home_more.status, "OK");
    assert.equal(c.home_more.probability, 6 / 8);
  });
});

describe("favorite 1X2 highlight", () => {
  it("picks the highest probability and greens only that side", () => {
    const fav = pickFavorite1x2({ home: 0.48, draw: 0.27, away: 0.25 });
    assert.equal(fav, "home");
    assert.equal(favoriteTone("home", fav), "favorite");
    assert.equal(favoriteTone("draw", fav), "muted");
    assert.equal(favoriteTone("away", fav), "muted");
    assert.equal(favoriteClassName("favorite"), "bm-fav");
    assert.equal(favoriteClassName("muted"), "bm-muted-pct");
  });

  it("breaks ties toward home then draw", () => {
    assert.equal(pickFavorite1x2({ home: 0.4, draw: 0.4, away: 0.2 }), "home");
    assert.equal(pickFavorite1x2({ home: 0.2, draw: 0.4, away: 0.4 }), "draw");
  });

  it("refuses incomplete or out-of-range probs", () => {
    assert.equal(pickFavorite1x2({ home: 1.2, draw: 0.1, away: 0.1 }), null);
    assert.equal(favoriteTone("home", null), "muted");
  });
});

describe("history parsers ignore odds columns", () => {
  it("parses club-football sample goals and never reads OddHome as a score", () => {
    const csv = readFileSync(
      join(process.cwd(), "src/audit/club-football-match-data/fixtures/matches_sample.csv"),
      "utf8",
    );
    const rows = parseClubFootballHistory(csv);
    assert.ok(rows.length >= 3);
    const m = rows.find((r) => r.home === "Marseille" && r.away === "Troyes");
    assert.ok(m);
    assert.equal(m!.home_goals, 3);
    assert.equal(m!.away_goals, 1);
    assert.equal(m!.source_id, "club-football-match-data");
  });

  it("parses football-data.co.uk results and corners, skipping B365*", () => {
    const csv = [
      "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HC,AC,B365H,B365D,B365A",
      "E0,10/08/2024,Arsenal,Wolves,2,0,H,8,2,1.4,4.5,8.0",
      "E0,11/08/2024,Arsenal,Everton,1,1,D,6,4,1.6,4.0,6.0",
    ].join("\n");
    const rows = parseFootballDataCoUkHistory(csv, "E0");
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.home_goals, 2);
    assert.equal(rows[0]!.home_corners, 8);
    assert.equal(rows[0]!.date, "2024-08-10");
    assert.ok(!JSON.stringify(rows).includes("1.4"));
  });
});

describe("compute light analysis", () => {
  it("excludes the target day and fail-closed identity (Villa ≠ Aston Villa short bind is already namesEqual)", () => {
    const history: HistoricalMatchRow[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        row("Arsenal", "Burnley", `2024-01-${String(i + 1).padStart(2, "0")}`, 2, 1, {
          home_corners: 7,
          away_corners: 3,
        }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        row("Brentford", "Chelsea", `2024-02-${String(i + 1).padStart(2, "0")}`, 0, 2, {
          home_corners: 2,
          away_corners: 6,
        }),
      ),
      row("Arsenal", "Chelsea", "2024-03-10", 9, 9),
    ];
    const priors = splitPriors(history, "Arsenal", "Chelsea", "2024-03-10");
    assert.equal(priors.homeHome.length, 10);
    assert.equal(priors.awayAway.length, 10);
    assert.ok(!priors.homeHome.some((r) => r.date >= "2024-03-10"));

    const analysis = computeLightAnalysis({
      event_id: "e1",
      home: "Arsenal",
      away: "Chelsea",
      kickoff_utc: "2024-03-10T15:00:00Z",
      history,
      skipAttach: true,
      strong_available: false,
    });
    assert.equal(analysis.mode_label_it, "Light");
    assert.equal(analysis.odds_entered_model, false);
    assert.equal(analysis.identity_fail_closed, true);
    assert.ok(lightHasEstimableMarket(analysis));
    const over = analysis.markets.find((m) => m.market === "over_under" && m.selection === "OVER" && m.line === 2.5);
    assert.equal(over?.status, "OK");
    assert.ok(over?.probability != null);
    const fav = analysis.markets.filter((m) => m.market === "1x2");
    assert.equal(fav.length, 3);
    assert.equal(analysis.favorite_1x2, "home");
    assert.ok(analysis.prose.some((l) => /over 2\.5|1X2|gol|angolo/i.test(l)));
    assert.match(analysis.strong_unavailable_it ?? "", /Forte non disponibile/);
  });

  it("shows dato insufficiente when history cannot estimate a market", () => {
    const analysis = computeLightAnalysis({
      event_id: "e2",
      home: "Unknown FC",
      away: "Other FC",
      kickoff_utc: "2024-03-10T15:00:00Z",
      history: [row("Arsenal", "Chelsea", "2024-01-01", 1, 0)],
      skipAttach: true,
    });
    assert.equal(lightHasEstimableMarket(analysis), false);
    for (const m of analysis.markets) {
      assert.equal(m.status, "INSUFFICIENT");
      assert.equal(m.probability, null);
      assert.equal(m.insufficient_it, LIGHT_INSUFFICIENT_IT);
    }
  });

  it("does not attach a colliding short name as history", () => {
    const history = [
      ...Array.from({ length: 10 }, (_, i) => row("Villa", "Burnley", `2024-01-${String(i + 1).padStart(2, "0")}`, 3, 0)),
    ];
    const analysis = computeLightAnalysis({
      event_id: "e3",
      home: "Aston Villa",
      away: "Chelsea",
      kickoff_utc: "2024-03-10T15:00:00Z",
      history,
      skipAttach: true,
    });
    assert.equal(analysis.history_n.home_home, 0);
    assert.equal(lightHasEstimableMarket(analysis), false);
  });

  it("prose stays grounded in computed frequencies", () => {
    const markets = buildLightMarkets({
      homeHome: Array.from({ length: 10 }, () =>
        row("A", "B", "2024-01-01", 2, 1, { home_corners: 8, away_corners: 2 }),
      ),
      awayAway: Array.from({ length: 10 }, () =>
        row("C", "D", "2024-01-02", 0, 2, { home_corners: 2, away_corners: 7 }),
      ),
      source_ids: ["football-data-co-uk"],
    });
    const lines = proseFromMarkets(markets);
    assert.ok(lines.some((l) => l.includes("over 2.5") || l.includes("1X2") || l.includes("gol")));
    assert.ok(lines.some((l) => /Favorito 1X2|over 2\.5|gol/i.test(l)));
  });
});

describe("list market leans", () => {
  it("exposes 1X2 + O/U + BTTS + team goals + corners without inventing missing %", () => {
    const markets = buildLightMarkets({
      homeHome: Array.from({ length: 10 }, () =>
        row("A", "B", "2024-01-01", 2, 1, { home_corners: 8, away_corners: 2 }),
      ),
      awayAway: Array.from({ length: 10 }, () =>
        row("C", "D", "2024-01-02", 0, 2, { home_corners: 2, away_corners: 7 }),
      ),
      source_ids: ["football-data-co-uk"],
    });
    const leans = listMarketLeans(markets, "home");
    assert.equal(leans.find((l) => l.key === "1")?.favorite, true);
    assert.equal(leans.find((l) => l.key === "x")?.favorite, false);
    assert.match(leans.find((l) => l.key === "o15")?.text ?? "", /\d/);
    assert.match(leans.find((l) => l.key === "o25")?.text ?? "", /\d/);
    assert.match(leans.find((l) => l.key === "o35")?.text ?? "", /\d/);
    assert.match(leans.find((l) => l.key === "btts")?.text ?? "", /\d/);
    assert.match(leans.find((l) => l.key === "hg15")?.text ?? "", /\d/);
    assert.match(leans.find((l) => l.key === "ag15")?.text ?? "", /\d/);
    assert.match(leans.find((l) => l.key === "cor")?.text ?? "", /\d/);
    assert.equal(leans.find((l) => l.key === "1")?.group, "1x2");
    assert.equal(leans.find((l) => l.key === "o25")?.group, "ou");
  });

  it("prints an em-dash when a lean has no sample, never dato insufficiente", () => {
    const leans = listMarketLeans([], null);
    assert.ok(leans.every((l) => l.text === LIGHT_MISSING_UI));
    assert.ok(leans.filter((l) => l.group !== "1x2").every((l) => l.hidden === true));
    assert.ok(leans.every((l) => l.favorite === false));
    assert.ok(!leans.some((l) => l.text === LIGHT_INSUFFICIENT_IT));
  });
});

describe("persist replace policy", () => {
  it("does not overwrite a measured light row with an empty recompute", () => {
    const good = computeLightAnalysis({
      event_id: "keep",
      home: "Arsenal",
      away: "Chelsea",
      kickoff_utc: "2024-03-10T15:00:00Z",
      history: [
        ...Array.from({ length: 10 }, (_, i) =>
          row("Arsenal", "Burnley", `2024-01-${String(i + 1).padStart(2, "0")}`, 2, 0),
        ),
        ...Array.from({ length: 10 }, (_, i) =>
          row("Fulham", "Chelsea", `2024-02-${String(i + 1).padStart(2, "0")}`, 0, 1),
        ),
      ],
      skipAttach: true,
    });
    const empty = computeLightAnalysis({
      event_id: "keep",
      home: "Arsenal",
      away: "Chelsea",
      kickoff_utc: "2024-03-10T15:00:00Z",
      history: [],
      skipAttach: true,
    });
    assert.equal(shouldReplaceLightAnalysis(empty, good), false);
    assert.equal(shouldReplaceLightAnalysis(good, empty), true);
    assert.equal(shouldReplaceLightAnalysis(empty, null), true);
  });
});

describe("strong gates stay untouched", () => {
  it("does not edit predict-live coverage / missing_keys thresholds", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/eval/predictive-intelligence/predict-live.ts"), "utf8");
    assert.match(src, /missing_keys\.length > 45/);
    assert.match(src, /feature_coverage < 0\.35/);
  });
});

describe("light-only aliases (strong identity stays fail-closed)", () => {
  it("matches common ESPN / board vs football-data.co.uk labels", () => {
    assert.equal(lightNamesMatch("Man United", "Manchester United"), true);
    assert.equal(lightNamesMatch("Inter", "Internazionale"), true);
    assert.equal(lightNamesMatch("Stade Rennais", "Rennes"), true);
    assert.equal(lightNamesMatch("Olympique Marseille", "Marseille"), true);
    assert.equal(lightNamesMatch("Ein Frankfurt", "Eintracht Frankfurt"), true);
    assert.equal(lightNamesMatch("Schalke 04", "FC Schalke 04"), true);
    assert.equal(lightNamesMatch("1. FC Union Berlin", "Union Berlin"), true);
    assert.equal(lightNamesMatch("AZ Alkmaar", "Alkmaar"), true);
  });

  it("still blocks collision stems used by strong identity", () => {
    assert.equal(lightNamesMatch("Villa", "Aston Villa"), false);
    assert.equal(lightNamesMatch("United", "Manchester United"), false);
    assert.equal(lightNamesMatch("City", "Manchester City"), false);
    assert.equal(lightNamesMatch("Real", "Real Madrid"), false);
  });
});

describe("light min-n floors", () => {
  it("estimates 1X2 from 4 home-home rows", () => {
    const homeHome = Array.from({ length: 4 }, () => row("Arsenal", "Burnley", "2024-01-01", 2, 0));
    const markets = buildLightMarkets({
      homeHome,
      awayAway: [],
      source_ids: ["football-data-co-uk"],
    });
    const home = markets.find((m) => m.market === "1x2" && m.selection === "HOME");
    assert.equal(home?.status, "OK");
    assert.equal(home?.probability, 1);
    assert.equal(LIGHT_MIN_N, 4);
  });

  it("stays insufficient below 4", () => {
    const r = rateFromFlags([true, true, false], LIGHT_MIN_N);
    assert.equal(r.status, "INSUFFICIENT");
    assert.equal(r.probability, null);
  });
});

describe("history fetch / parse (mocked HTTP)", () => {
  it("rejects HTML and accepts a real FDouk header", () => {
    assert.equal(looksLikeFdoukCsv("<html><title>503</title></html>"), false);
    assert.equal(
      looksLikeFdoukCsv("Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HC,AC\n"),
      true,
    );
  });

  it("parses openfootball finished scores only", () => {
    const json = JSON.stringify({
      name: "Premier League",
      matches: [
        { date: "2025-08-15", team1: "Arsenal", team2: "Wolves", score: { ft: [2, 0] } },
        { date: "2025-08-16", team1: "Chelsea", team2: "Fulham" },
      ],
    });
    const rows = parseOpenFootballHistory(json, "E0");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.home_goals, 2);
    assert.equal(rows[0]!.source_id, "openfootball");
  });

  it("fetches CSVs over HTTP when disk history is empty", async () => {
    clearLightHistoryMemory();
    const csv = [
      "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HC,AC,B365H",
      "E0,10/08/2024,Arsenal,Wolves,2,0,H,8,2,1.40",
      "E0,17/08/2024,Arsenal,Everton,1,0,H,7,3,1.55",
      "E0,24/08/2024,Arsenal,Brighton,3,1,H,6,4,1.60",
      "E0,31/08/2024,Arsenal,Spurs,2,1,H,5,5,1.70",
    ].join("\n");
    const fetchImpl: typeof fetch = async (url) => {
      const href = String(url);
      if (href.includes("E0.csv")) {
        return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
      }
      if (href.includes("github")) {
        return new Response(JSON.stringify({ name: "x", matches: [] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };
    const tmp = join(process.cwd(), "data", "light-analysis", `test-empty-${Date.now()}`);
    const report = await loadLightHistory({
      cwd: tmp,
      force: true,
      dayIso: "2026-09-11",
      fetchImpl,
      includeOpenFootball: false,
      persistNeon: false,
    });
    assert.ok(report.rows.length >= 4);
    assert.equal(report.cache, "http");
    assert.ok(!JSON.stringify(report.rows).includes("1.40"));
    const analysis = computeLightAnalysis({
      event_id: "e-http",
      home: "Arsenal",
      away: "Chelsea",
      kickoff_utc: "2026-09-11T15:00:00Z",
      history: report.rows,
      skipAttach: true,
    });
    assert.equal(lightHasEstimableMarket(analysis), true);
    assert.equal(analysis.favorite_1x2, "home");
  });
});

describe("league titles and favorite green helper", () => {
  it("renders compact Italian league headers", () => {
    assert.equal(leagueTitleIt("SOCCER_GERMANY_BUNDESLIGA"), "Germania: Bundesliga");
    assert.equal(leagueTitleIt("soccer_france_ligue_one"), "Francia: Ligue 1");
    assert.equal(leagueTitleIt("I1"), "Italia: Serie A");
  });

  it("keeps favoriteClassName green for the 1X2 lean", () => {
    assert.equal(favoriteClassName("favorite"), "bm-fav");
    assert.equal(favoriteClassName("muted"), "bm-muted-pct");
  });
});
