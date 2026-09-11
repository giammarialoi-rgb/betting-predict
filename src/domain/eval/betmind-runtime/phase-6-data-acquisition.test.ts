/**
 * Phase 6 ? real extraction, honest SUCCESS, temporal/odds firewall, conflicts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractEventHtml } from "@/domain/eval/data-intelligence/research/extract-html";
import { fetchEventPage } from "@/domain/eval/data-intelligence/research/event-page-fetch";
import { classifyHumanSourceStatus } from "@/domain/eval/betmind-runtime/explain/source-status";
import { detectConflicts } from "@/domain/eval/data-intelligence/research/conflict-engine";
import { bindClubFootballEvent } from "@/domain/eval/data-intelligence/research/club-football-bind";
import { resolveTeamIdentity, resolveCompetitionIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { eventPriority, pickResearchBatch, type ResearchQueueFile } from "@/domain/eval/data-intelligence/research/queue";
import { nextFallbackSource } from "@/domain/eval/data-intelligence/research/source-engine";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { asOfAfterKickoff } from "@/domain/eval/data-intelligence/research/temporal";
import { buildHumanExplanation } from "@/domain/eval/betmind-runtime/explain/italian-explanation";
import { buildResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";

describe("Phase 6 extraction", () => {
  it("HTTP 200 homepage without both teams is NO_EVENT, never SUCCESS", () => {
    const r = extractEventHtml({
      html: "<html><body>Premier League table Arsenal Chelsea</body></html>",
      home: "Aston Villa",
      away: "Nottingham Forest",
    });
    assert.equal(r.status, "NO_EVENT");
    assert.equal(r.fields.length, 0);
  });

  it("both teams mentioned without typed stats is PARTIAL not SUCCESS", () => {
    const r = extractEventHtml({
      html: "<html><body>Aston Villa vs Nottingham Forest preview coming soon</body></html>",
      home: "Aston Villa",
      away: "Nottingham Forest",
    });
    assert.equal(r.match, "EVENT_MATCHED");
    assert.equal(r.status, "PARTIAL");
    assert.equal(r.fields.length, 0);
  });

  it("extracts typed xG from JSON-LD when event matched", () => {
    const html = "<html><body>Aston Villa Nottingham Forest<script type='application/ld+json'>{\"@type\":\"SportsEvent\",\"xg\":1.82,\"shots\":14}</script></body></html>";
    const r = extractEventHtml({ html, home: "Aston Villa", away: "Nottingham Forest" });
    assert.equal(r.status, "SUCCESS");
    assert.ok(r.fields.some((f) => f.key === "xg" && Number(f.value) === 1.82));
  });

  it("does not extract odds keys", () => {
    const html = "<html><body>Aston Villa Nottingham Forest<script type='application/ld+json'>{\"odds\":1.9,\"OddHome\":2.1,\"xg\":1.1}</script></body></html>";
    const r = extractEventHtml({ html, home: "Aston Villa", away: "Nottingham Forest" });
    assert.ok(!r.fields.some((f) => /odd/i.test(f.key)));
  });

  it("JS shell without stats is DYNAMIC_CONTENT_UNAVAILABLE", () => {
    const r = extractEventHtml({
      html: "<html><body><div id='root'></div><script>window.__NEXT=1</script></body></html>",
      home: "Aston Villa",
      away: "Nottingham Forest",
    });
    assert.equal(r.status, "DYNAMIC_CONTENT_UNAVAILABLE");
  });
});

describe("Phase 6 fetch honesty", () => {
  it("HTTP 403 is BLOCKED", async () => {
    const page = await fetchEventPage({
      sourceId: "sofascore",
      home: "Aston Villa",
      away: "Nottingham Forest",
      fetchImpl: async () => new Response("forbidden", { status: 403 }),
    });
    assert.equal(page.status, "BLOCKED");
    assert.equal(classifyHumanSourceStatus({
      source_id: "sofascore",
      adapter_kind: "TEST_PROBE",
      parser_status: page.status,
      http_status: 403,
      phase: "BLOCKED",
      fields_extracted: [],
    }), "BLOCKED");
  });

  it("HTTP 200 without event is NO_EVENT", async () => {
    const page = await fetchEventPage({
      sourceId: "fbref",
      home: "Slavia Praha",
      away: "RC Lens",
      fetchImpl: async () => new Response("<html><body>Premier League table Arsenal Chelsea</body></html>", { status: 200 }),
    });
    assert.equal(page.status, "NO_EVENT");
  });
});

describe("Phase 6 identity / scheduler / fallback", () => {
  it("strips FC and maps Nottingham Forest FC", () => {
    const id = resolveTeamIdentity("Nottingham Forest FC");
    assert.equal(id.canonical_id, "nottingham-forest");
    const comp = resolveCompetitionIdentity("Premier League");
    assert.equal(comp.canonical_id, "E0");
  });

  it("P0 is within 1h; unresearched still fills budget", () => {
    assert.equal(eventPriority("2026-09-10T00:30:00.000Z", Date.parse("2026-09-10T00:00:00.000Z")), "P0");
    const file: ResearchQueueFile = {
      updated_at: "2026-09-10T00:00:00.000Z",
      items: Array.from({ length: 80 }, (_, i) => ({
        event_id: `e${i}`,
        home: `H${i}`,
        away: `A${i}`,
        competition: "EPL",
        kickoff_utc: "2026-09-20T15:00:00.000Z",
        state: "QUEUED" as const,
        last_cycle: null,
        last_attempt_at: null,
        attempts: 0,
      })),
    };
    const batch = pickResearchBatch(file, 24, Date.parse("2026-09-10T00:00:00.000Z"));
    assert.equal(batch.length, 24);
  });

  it("fallback continues after a blocked source", () => {
    const next = nextFallbackSource("xg", "understat");
    assert.ok(next && next !== "understat");
  });
});

describe("Phase 6 firewalls", () => {
  it("odds keys cannot enter independent context", () => {
    assert.throws(() => assertNoMarketInputsInPredictionContext(["home_xg", "odds_home"]));
    assert.doesNotThrow(() => assertNoMarketInputsInPredictionContext(["home_gf_l5", "away_ga_l5"]));
  });

  it("future available_at is post-kickoff", () => {
    assert.equal(asOfAfterKickoff("2026-09-12T16:00:00Z", "2026-09-12T14:00:00Z"), true);
    assert.equal(asOfAfterKickoff("2026-09-12T12:00:00Z", "2026-09-12T14:00:00Z"), false);
  });

  it("conflicts keep both values and pick priority source", () => {
    const c = detectConflicts([
      { feature_key: "xg", source: "understat", value: 1.82 },
      { feature_key: "xg", source: "fbref", value: 1.76 },
    ]);
    assert.equal(c.length, 1);
    assert.equal(c[0]!.used_source, "understat");
    assert.equal(c[0]!.values.length, 2);
  });

  it("club-football ignores odds columns and excludes target match", () => {
    const csv = "Division,MatchDate,HomeTeam,AwayTeam,FTHome,FTAway,OddHome,OddDraw\nE0,2026-09-01,Aston Villa,Wolves,2,0,1.8,3.5\nE0,2026-09-12,Aston Villa,Nottingham Forest,1,1,2.0,3.2\n";
    const bind = bindClubFootballEvent({
      home: "Aston Villa",
      away: "Nottingham Forest",
      kickoffIso: "2026-09-12T14:00:00Z",
      csvText: csv,
    });
    assert.ok(bind.odds_columns_ignored.includes("OddHome"));
    assert.ok(bind.prior_n >= 1);
    assert.equal(bind.away_gf_l5, null);
    assert.ok(bind.home_gf_l5 != null);
  });
});

describe("Phase 6 explanation facts", () => {
  it("does not claim injuries when they were not acquired", () => {
    const summary = buildResearchSummary({
      home: "Aston Villa",
      away: "Nottingham Forest",
      features: [
        { name: "home_gf_l5", value: 1.4, source: "football-data-co-uk", status: "ELIGIBLE", entered_model: true },
      ],
      research: [
        {
          source_id: "football-data-co-uk",
          ok: true,
          fetched: true,
          phase: "OK",
          parser_status: "OK",
          fields_extracted: ["home_gf_l5"],
        },
      ],
      prediction_time: "2026-09-10T00:00:00Z",
      model_version: "INDEPENDENT_POISSON_v1",
      feature_coverage: 0.4,
      has_independent_inference: true,
    });
    const hx = buildHumanExplanation({
      home: "Aston Villa",
      away: "Nottingham Forest",
      probability: { HOME: 0.445, DRAW: 0.274, AWAY: 0.281 },
      summary,
    });
    assert.ok(hx.missing.some((m) => /infortun/i.test(m)));
    assert.ok(!/infortuni favoriscono/i.test(hx.why.join(" ")));
    assert.match(ANALYSIS_RUNTIME_VERSION, /phase-8/);
  });
});
