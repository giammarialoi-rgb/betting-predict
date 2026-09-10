import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fetchEventPage } from "@/domain/eval/data-intelligence/research/event-page-fetch";
import { nextFallbackSource, fallbackChainFor } from "@/domain/eval/data-intelligence/research/source-engine";
import { isProvisionalCanonicalId, resolveCanonicalEventIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { lookupHistoricalPriors } from "@/domain/eval/data-intelligence/research/historical-provider";
import {
  listCalendarEvents,
  todayCalendarDay,
  shiftCalendarDay,
  matchesCalendarQuery,
} from "@/domain/eval/betmind-runtime/calendar";
import { RESEARCH_BUDGET_PER_CYCLE } from "@/domain/eval/data-intelligence/research/orchestrator";
import { enqueueUpcomingEvents, pickResearchBatch, loadResearchQueue } from "@/domain/eval/data-intelligence/research/queue";
import { scrapingAllowedForSource, assertScrapingDenied } from "@/domain/sources/scraping-policy";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { hasIndependentModel } from "@/domain/eval/permanent-044/prediction-precedence";
import { readFileSync } from "node:fs";

function tmpRoot(): string {
  const dir = join(tmpdir(), `p5-cal-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Phase 5 data acquisition", () => {
  it("source fallback continues after a blocked source", () => {
    const chain = fallbackChainFor("xg");
    assert.ok(chain.includes("understat"));
    const next = nextFallbackSource("xg", "understat");
    assert.ok(next && next !== "understat");
  });

  it("HTTP 200 homepage without both teams is NO_EVENT", async () => {
    const page = await fetchEventPage({
      sourceId: "fbref",
      home: "Aston Villa",
      away: "Nottingham Forest",
      fetchImpl: async () =>
        new Response("<html><body>Premier League table Arsenal Chelsea</body></html>", { status: 200 }),
    });
    assert.equal(page.status, "NO_EVENT");
    assert.equal(page.http_status, 200);
    assert.equal(page.fields_extracted.length, 0);
  });

  it("HTTP 403 is BLOCKED and does not invent SUCCESS", async () => {
    const page = await fetchEventPage({
      sourceId: "sofascore",
      home: "Aston Villa",
      away: "Nottingham Forest",
      fetchImpl: async () => new Response("forbidden", { status: 403 }),
    });
    assert.equal(page.status, "BLOCKED");
  });

  it("live: ids are provisional", () => {
    assert.equal(isProvisionalCanonicalId("live:foo"), true);
    assert.equal(isProvisionalCanonicalId("aston-villa"), false);
    const id = resolveCanonicalEventIdentity({
      home: "Aston Villa",
      away: "Nottingham Forest",
      competition: "Premier League",
    });
    if (id.home.matched && id.away.matched) {
      assert.equal(id.home.provisional, false);
      assert.equal(id.away.provisional, false);
    } else {
      assert.equal(id.match_confidence, "PROVISIONAL");
    }
  });

  it("calendar lists every event for a date with no 8/25/120 cap", () => {
    const root = tmpRoot();
    const lines = [];
    for (let i = 0; i < 40; i += 1) {
      lines.push(
        JSON.stringify({
          event_id: `e${i}`,
          sport: "soccer",
          competition: "EPL",
          home_or_a: `Home${i}`,
          away_or_b: `Away${i}`,
          kickoff_utc: `2026-09-12T1${String(i % 8).padStart(1, "0")}:00:00.000Z`,
          status: "SCHEDULED",
        }),
      );
    }
    writeFileSync(join(root, "events.jsonl"), lines.join("\n") + "\n", "utf8");
    const cal = listCalendarEvents({ root, date: "2026-09-12", sport: "football" });
    assert.equal(cal.total, 40);
    assert.ok(cal.events.every((e) => e.home_or_a && e.away_or_b));
    assert.ok(cal.events.every((e) => !String(e.label).startsWith("e") || e.label.includes(" vs ")));
  });

  it("queue accepts all upcoming events; budget only slices the batch", () => {
    const root = tmpRoot();
    const events = Array.from({ length: 80 }, (_, i) => ({
      event_id: `q${i}`,
      canonical_event_id: `q${i}`,
      source: "odds",
      source_event_id: `q${i}`,
      sport: "soccer" as const,
      competition: "EPL",
      country: "GB",
      home_or_a: `H${i}`,
      away_or_b: `A${i}`,
      kickoff_utc: `2026-09-20T15:00:00.000Z`,
      collected_at_utc: "2026-09-10T00:00:00.000Z",
      available_at_utc: null,
      semantic_level: "RESEARCH" as const,
      data_quality: 1,
      fingerprint: `q${i}`,
      status: "SCHEDULED" as const,
    }));
    const q = enqueueUpcomingEvents({
      events,
      nowMs: Date.parse("2026-09-10T00:00:00.000Z"),
      nowIso: "2026-09-10T00:00:00.000Z",
      root,
    });
    assert.equal(q.items.length, 80);
    const batch = pickResearchBatch(q, RESEARCH_BUDGET_PER_CYCLE, Date.parse("2026-09-10T00:00:00.000Z"));
    assert.equal(batch.length, RESEARCH_BUDGET_PER_CYCLE);
    assert.equal(loadResearchQueue(root).items.length, 80);
  });

  it("odds keys cannot enter independent context; scrape bypass still denied", () => {
    assert.throws(() => assertNoMarketInputsInPredictionContext(["home_xg", "odds_home"]));
    assert.doesNotThrow(() => assertNoMarketInputsInPredictionContext(["home_gf_l5", "away_ga_l5"]));
    assert.equal(scrapingAllowedForSource("fbref"), "ALLOW");
    assert.throws(() => assertScrapingDenied("bypass_waf"));
  });

  it("placeholder prediction row is not independent inference", () => {
    assert.equal(
      hasIndependentModel({
        probability_model: null,
        model_version: "MODEL_v1|NO_INDEPENDENT",
        reason_codes: ["NO_INDEPENDENT_MODEL"],
      }),
      false,
    );
  });

  it("Football-Data missing teams is not file-level SUCCESS", () => {
    const h = lookupHistoricalPriors({
      home: "Fenerbahce",
      away: "Roma",
      competition: "UEFA Champions League",
      kickoffIso: "2026-09-17T19:00:00.000Z",
    });
    assert.notEqual(h.status, "SUCCESS");
  });

  it("model gates in predict-live remain 0.35 / 45", () => {
    const src = readFileSync(
      join(process.cwd(), "src/domain/eval/predictive-intelligence/predict-live.ts"),
      "utf8",
    );
    assert.match(src, /missing_keys\.length\s*>\s*45/);
    assert.match(src, /feature_coverage\s*<\s*0\.35/);
  });

  it("date filter uses kickoff when calendar_day is missing (Neon rows)", () => {
    const villa = {
      kickoff_utc: "2026-09-12T14:00:00.000Z",
      sport: "soccer",
      home_or_a: "Aston Villa",
      away_or_b: "Nottingham Forest",
    };
    const other = {
      kickoff_utc: "2026-09-20T18:45:00.000Z",
      sport: "soccer",
      home_or_a: "Marseille",
      away_or_b: "Paris Saint Germain",
    };
    const q = { date: "2026-09-12", sport: "football" };
    assert.equal(matchesCalendarQuery(villa, q), true);
    assert.equal(matchesCalendarQuery(other, q), false);
  });

  it("today and shift stay ISO dates", () => {
    const d = todayCalendarDay("2026-09-10T10:00:00.000Z");
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
    const n = shiftCalendarDay("2026-09-10", 1);
    assert.equal(n, "2026-09-11");
  });
});
