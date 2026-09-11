import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractEventHtml } from "@/domain/eval/data-intelligence/research/extract-html";
import { fetchEventPage } from "@/domain/eval/data-intelligence/research/event-page-fetch";
import { resolveTeamIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { extractFootballDataObservations } from "@/domain/eval/data-intelligence/research/extract-archive-observations";
import { rssItemMentionsBoth, matchRssToEvent } from "@/domain/eval/data-intelligence/research/rss-news";
import {
  classifyModelInput,
  isEligibleForIndependentModel,
} from "@/domain/eval/data-intelligence/research/model-input-policy";
import { fetchOpenMeteoContext } from "@/domain/eval/data-intelligence/open-meteo";
import { nextFallbackSource } from "@/domain/eval/data-intelligence/research/source-engine";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";
import { buildFoundFacts } from "@/domain/eval/betmind-runtime/explain/found-facts";

describe("Phase 7 acquisition", () => {
  it("runtime is phase-8", () => {
    assert.match(ANALYSIS_RUNTIME_VERSION, /phase-8/);
  });

  it("homepage HTTP 200 without both teams is NO_EVENT", () => {
    const r = extractEventHtml({
      html: "<html><body>Premier League table Arsenal Chelsea</body></html>",
      home: "Aston Villa",
      away: "Nottingham Forest",
    });
    assert.equal(r.status, "NO_EVENT");
    assert.equal(r.fields.length, 0);
  });

  it("Man Utd aliases share canonical id", () => {
    const a = resolveTeamIdentity("Man Utd");
    const b = resolveTeamIdentity("Manchester United");
    const c = resolveTeamIdentity("Manchester United FC");
    assert.equal(a.canonical_id, b.canonical_id);
    assert.equal(b.canonical_id, c.canonical_id);
    assert.equal(a.canonical_id, "manchester-united");
  });

  it("Roma aliases share canonical id", () => {
    const a = resolveTeamIdentity("Roma");
    const b = resolveTeamIdentity("AS Roma");
    const c = resolveTeamIdentity("AS Roma FC");
    assert.equal(a.canonical_id, b.canonical_id);
    assert.equal(b.canonical_id, c.canonical_id);
    assert.equal(a.canonical_id, "roma");
  });

  it("Football-Data observations exclude odds keys", () => {
    const obs = extractFootballDataObservations({
      eventId: "test-villa-forest",
      home: "Aston Villa",
      away: "Nottingham Forest",
      competition: "EPL",
      kickoffIso: "2026-09-13T14:00:00.000Z",
      nowIso: "2026-09-11T00:00:00.000Z",
    });
    assert.ok(!obs.some((o) => /odd|price|implied/i.test(o.feature_key)));
    if (obs.length > 0) {
      assert.ok(obs.some((o) => o.enters_independent_model === true));
    }
  });

  it("HTTP 403 is BLOCKED and fallback continues", async () => {
    const page = await fetchEventPage({
      sourceId: "sofascore",
      home: "Aston Villa",
      away: "Nottingham Forest",
      fetchImpl: async () => new Response("forbidden", { status: 403 }),
    });
    assert.equal(page.status, "BLOCKED");
    const next = nextFallbackSource("xg", "understat");
    assert.ok(next && next !== "understat");
  });

  it("market keys cannot enter independent context", () => {
    assert.throws(() => assertNoMarketInputsInPredictionContext(["home_xg", "odds_home"]));
    assert.doesNotThrow(() => assertNoMarketInputsInPredictionContext(["home_gf_l5", "away_ga_l5"]));
  });

  it("forecast weather available_at is retrieved_at not kickoff", async () => {
    const json = JSON.stringify({
      hourly: {
        time: ["2026-09-13T14:00"],
        temperature_2m: [18.2],
        precipitation: [0.1],
        precipitation_probability: [20],
        relativehumidity_2m: [61],
        windspeed_10m: [12],
      },
    });
    const rows = await fetchOpenMeteoContext({
      eventId: "wx-test",
      homeTeam: "Aston Villa",
      eventTimeIso: "2026-09-13T14:00:00.000Z",
      asOf: "2026-09-11T00:00:00.000Z",
      deps: { jsonText: json },
    });
    const temp = rows.find((r) => r.key === "temp_c");
    assert.ok(temp);
    assert.equal(temp!.value, 18.2);
    assert.equal(temp!.status, "ELIGIBLE");
    assert.equal(temp!.available_at, "2026-09-11T00:00:00.000Z");
    assert.ok(Date.parse(String(temp!.available_at)) < Date.parse("2026-09-13T14:00:00.000Z"));
  });

  it("RSS matches only when both teams appear", async () => {
    assert.equal(
      rssItemMentionsBoth("Aston Villa faces Nottingham Forest tonight", "Aston Villa", "Nottingham Forest"),
      true,
    );
    assert.equal(rssItemMentionsBoth("Aston Villa win again", "Aston Villa", "Nottingham Forest"), false);
    const xml =
      "<rss><channel><item><title>Aston Villa vs Nottingham Forest preview</title><link>https://example.test/v</link><pubDate>Thu, 10 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>";
    const hit = await matchRssToEvent({
      sourceId: "ansa",
      home: "Aston Villa",
      away: "Nottingham Forest",
      deps: { xmlText: xml },
    });
    assert.equal(hit.status, "PARTIAL");
    assert.ok(hit.matched_title?.includes("Villa"));
  });

  it("model policy keeps market and post-kickoff out", () => {
    assert.equal(isEligibleForIndependentModel(classifyModelInput({ kind: "MARKET", source: "the-odds-api" })), false);
    assert.equal(
      isEligibleForIndependentModel(
        classifyModelInput({
          kind: "HISTORICAL_PRIOR",
          asOf: "2026-09-13T16:00:00Z",
          kickoff: "2026-09-13T14:00:00Z",
        }),
      ),
      false,
    );
    assert.equal(
      isEligibleForIndependentModel(classifyModelInput({ kind: "HISTORICAL_PRIOR", source: "football-data-co-uk" })),
      true,
    );
  });

  it("found facts come from observations only", () => {
    const lines = buildFoundFacts({
      home: "Aston Villa",
      away: "Nottingham Forest",
      observations: [
        {
          event_id: "e",
          feature_key: "home_gf_l5",
          value: 1.4,
          source: "football-data-co-uk",
          source_url: null,
          observed_at: "2026-09-11T00:00:00Z",
          available_at: null,
          extraction_method: "pi",
          confidence: null,
          status: "REAL",
          kind: "HISTORICAL_PRIOR",
          enters_independent_model: true,
        },
      ],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /1\.4/);
    assert.match(lines[0]!, /archivio storico/);
  });
});
