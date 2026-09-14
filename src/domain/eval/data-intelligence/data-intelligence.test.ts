import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import {
  buildSourceRegistry,
  clubEloCachePresent,
  parseClubEloCsvSync,
  resolveTeamEloAsOf,
  runDataIntelligenceAudit,
  synthesizePrematchFacts,
  synthesizeFeatureBag,
  mergeDiIntoFeatureVector,
  fetchOpenMeteoContext,
  observationBlockedFuture,
  toFeatureDatum,
  FEATURE_MANIFEST_P0,
  featureManifestP0Summary,
  fetchApiSportsPrematchObservations,
  probeScrapeSource,
  parseFbrefStub,
} from "@/domain/eval/data-intelligence";
import {
  assertScrapingDenied,
  isTestScrapeEnabled,
  scrapingAllowedForSource,
} from "@/domain/sources/scraping-policy";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { predictPoissonIndependent } from "@/domain/eval/predictive-intelligence/models/poisson-independent";
import { CLUBELO_FIXTURE_CSV } from "@/providers/clubelo/adapter";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";
import type { PrematchFeatureObservation } from "@/domain/eval/data-intelligence/types";

function miniMatches(): PiMatchRow[] {
  const teams = ["Arsenal", "Chelsea", "Liverpool", "Everton"];
  const out: PiMatchRow[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = new Date(Date.UTC(2022, 7, 1 + (i % 28), 15, 0));
    const iso = day.toISOString();
    const h = teams[i % teams.length]!;
    const a = teams[(i + 1) % teams.length]!;
    const hg = i % 3;
    const ag = (i + 1) % 3;
    out.push({
      canonical_id: `m${i}|${h}|${a}`,
      source: "football-data-co-uk",
      season: i < 40 ? "2122" : "2324",
      league: "E0",
      match_date: iso.slice(0, 10),
      event_time: iso,
      home_team: h,
      away_team: a,
      home_team_id: h.toLowerCase(),
      away_team_id: a.toLowerCase(),
      fthg: hg,
      ftag: ag,
      ftr: hg > ag ? "HOME" : hg < ag ? "AWAY" : "DRAW",
      hthg: 0,
      htag: 0,
      htr: "DRAW",
      hs: 10,
      as: 8,
      hst: 4,
      ast: 3,
      hc: 5,
      ac: 4,
      hy: 1,
      ay: 2,
      hr: 0,
      ar: 0,
      odds_open: {
        B365: { home: 2.1, draw: 3.4, away: 3.5 },
        PS: { home: null, draw: null, away: null },
        Avg: { home: null, draw: null, away: null },
      },
      research_odds_close: {
        B365C: { home: 2.0, draw: 3.5, away: 3.6 },
        PSC: { home: null, draw: null, away: null },
      },
      label_time: new Date(day.getTime() + 86400000).toISOString(),
      result_available_at: new Date(day.getTime() + 86400000).toISOString(),
    });
  }
  return out;
}

function mkdtempLab(): string {
  const dir = join(tmpdir(), `di-audit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("data-intelligence", () => {
  it("registry marks FBRef RESEARCH_TEST even if callers pass testScrapeEnabled=false", () => {
    const off = buildSourceRegistry({
      footballDataRows: 9000,
      clubeloCachePresent: false,
      testScrapeEnabled: false,
    });
    assert.equal(off.find((s) => s.id === "fbref")!.status, "RESEARCH_TEST");
    assert.equal(off.find((s) => s.id === "fbref")!.enters_independent_model, false);
    const on = buildSourceRegistry({
      footballDataRows: 9000,
      testScrapeEnabled: true,
    });
    assert.equal(on.find((s) => s.id === "fbref")!.status, "RESEARCH_TEST");
    assert.equal(on.find((s) => s.id === "directa")!.status, "RESEARCH_TEST");
    assert.ok(on.find((s) => s.id === "open-meteo"));
  });

  it("scrape lane always ALLOW; bypass actions still denied", () => {
    const env = { ...process.env };
    delete env.BETMIND_TEST_SCRAPE;
    assert.equal(isTestScrapeEnabled(env), true);
    assert.equal(scrapingAllowedForSource("fbref", env), "ALLOW");
    assert.throws(() => assertScrapingDenied("bypass_cloudflare"));
    assert.throws(() => assertScrapingDenied("bypass_captcha"));
    assert.throws(() => assertScrapingDenied("bypass_waf"));
  });

  it("Open-Meteo mock respects asOf firewall", async () => {
    const json = JSON.stringify({
      hourly: {
        time: ["2022-08-15T12:00", "2022-08-15T15:00", "2022-08-15T18:00"],
        temperature_2m: [18, 20, 17],
        precipitation: [0, 0.2, 0],
        windspeed_10m: [10, 12, 8],
      },
    });
    const ok = await fetchOpenMeteoContext({
      eventId: "e1",
      homeTeam: "Arsenal",
      eventTimeIso: "2022-08-15T15:00:00.000Z",
      asOf: "2022-08-15T16:00:00.000Z",
      deps: { jsonText: json },
    });
    assert.ok(ok.some((o) => o.key === "temp_c" && o.status === "ELIGIBLE"));
    const forecast = await fetchOpenMeteoContext({
      eventId: "e1",
      homeTeam: "Arsenal",
      eventTimeIso: "2022-08-15T15:00:00.000Z",
      asOf: "2022-08-15T10:00:00.000Z",
      deps: { jsonText: json },
    });
    assert.ok(forecast.some((o) => o.key === "temp_c" && o.status === "ELIGIBLE"));
    const blocked = await fetchOpenMeteoContext({
      eventId: "e1",
      homeTeam: "Arsenal",
      eventTimeIso: "2022-08-15T12:00:00.000Z",
      asOf: "2022-08-15T13:00:00.000Z",
      deps: {
        jsonText: JSON.stringify({
          hourly: {
            time: ["2022-08-15T15:00", "2022-08-15T18:00"],
            temperature_2m: [20, 17],
            precipitation: [0.2, 0],
            windspeed_10m: [12, 8],
          },
        }),
      },
    });
    assert.ok(blocked.every((o) => o.status !== "ELIGIBLE" || o.key === "weather"));
    assert.equal(observationBlockedFuture("2022-08-15T18:00:00.000Z", "2022-08-15T12:00:00.000Z"), true);
  });

  it("conflict synthesis sets FEATURE_QUALITY_LOW", () => {
    const s = synthesizePrematchFacts({
      eventId: "e1",
      facts: [
        { source_id: "a", field: "kickoff_day", value: "2026-09-09" },
        { source_id: "b", field: "kickoff_day", value: "2026-09-10" },
      ],
    });
    assert.equal(s.status, "CONFLICT");
    assert.equal(s.feature_quality, "LOW");
    assert.ok(s.reason_codes.includes("FEATURE_QUALITY_LOW"));
  });

  it("single source no false conflict", () => {
    const s = synthesizePrematchFacts({
      eventId: "e1",
      facts: [{ source_id: "a", field: "kickoff_day", value: "2026-09-09" }],
    });
    assert.equal(s.status, "SINGLE_SOURCE");
  });

  it("TEST_SCRAPE probe with injected HTML stays CONTEXT / NOT_ELIGIBLE", async () => {
    const prev = process.env.BETMIND_TEST_SCRAPE;
    process.env.BETMIND_TEST_SCRAPE = "true";
    try {
      const r = await probeScrapeSource({
        sourceId: "fbref",
        url: "https://fbref.com/en/",
        eventId: "e1",
        deps: { bodyText: "<html>xG 1.45 stats</html>", httpStatus: 200 },
        parse: parseFbrefStub,
      });
      assert.equal(r.status, "OK");
      assert.equal(r.enters_independent_model, false);
      assert.ok(r.observations.every((o) => o.status === "NOT_ELIGIBLE"));
      assert.ok(r.observations.every((o) => o.enters_independent_model === false));
    } finally {
      if (prev == null) delete process.env.BETMIND_TEST_SCRAPE;
      else process.env.BETMIND_TEST_SCRAPE = prev;
    }
  });

  it("feature without available_at is NOT_ELIGIBLE or UNAVAILABLE", () => {
    const matches = miniMatches();
    const feat = buildFeatureVectorPi(matches[50]!, matches);
    assert.ok(feat.feature_data.some((d) => d.status === "UNAVAILABLE"));
    for (const d of feat.feature_data) {
      if (d.status === "ELIGIBLE") assert.ok(d.available_at, d.key);
    }
    assertNoMarketInputsInPredictionContext(Object.keys(feat.values));
  });

  it("ClubElo rating on/after match date is excluded", () => {
    const obs = parseClubEloCsvSync(CLUBELO_FIXTURE_CSV, "2019-08-01");
    assert.equal(
      resolveTeamEloAsOf({ observations: obs, teamName: "Arsenal", matchDateIso: "2019-07-01" }),
      null,
    );
    assert.ok(
      resolveTeamEloAsOf({ observations: obs, teamName: "Arsenal", matchDateIso: "2019-08-15" }),
    );
  });

  it("audit reports real_money=false", async () => {
    const dir = mkdtempLab();
    mkdirSync(join(dir, "predictive-intelligence", "datasets"), { recursive: true });
    writeFileSync(
      join(dir, "predictive-intelligence", "datasets", "matches.jsonl"),
      miniMatches()
        .map((m) => JSON.stringify(m))
        .join("\n") + "\n",
    );
    const result = await runDataIntelligenceAudit({
      labBRoot: dir,
      cwd: dir,
      sampleLimit: 5,
      nowIso: "2026-09-09T12:00:00.000Z",
    });
    assert.equal(result.real_money, false);
    assert.equal(result.scrape_enters_model, false);
    const reg = JSON.parse(
      readFileSync(
        join(dir, "predictive-intelligence", "data-intelligence", "source-registry.json"),
        "utf8",
      ),
    );
    assert.equal(reg.real_money, false);
    assert.equal(reg.scrape_enters_model, false);
  });

  it("clubEloCachePresent false without csv", () => {
    assert.equal(clubEloCachePresent(mkdtempLab()), false);
  });

  it("FEATURE_MANIFEST_P0 lists injuries ACTIVE and weather CONTEXT_ONLY", () => {
    const sum = featureManifestP0Summary();
    assert.ok(FEATURE_MANIFEST_P0.length >= 10);
    assert.ok(sum.by_readiness.ACTIVE.includes("home_injuries_n"));
    assert.ok(sum.by_readiness.CONTEXT_ONLY.includes("weather_temp_c"));
    assert.ok(sum.by_readiness.CONTEXT_ONLY.includes("home_xg_prematch"));
    assert.ok(!sum.stub_or_missing_families.includes("xg"));
  });

  it("toFeatureDatum blocks available_at after decisionTime", () => {
    const obs: PrematchFeatureObservation = {
      event_id: "e1",
      event_time: "2022-08-15T15:00:00.000Z",
      source_id: "api-sports",
      feature_name: "home_injuries_n",
      feature_value: 3,
      source_published_at: "2022-08-15T14:00:00.000Z",
      retrieved_at: "2022-08-15T14:01:00.000Z",
      available_at: "2022-08-15T14:00:00.000Z",
      feature_time: "2022-08-15T14:00:00.000Z",
      quality: "confirmed",
      timestamp_precision: "datetime",
      enters_independent_model: true,
    };
    const ok = toFeatureDatum(obs, "2022-08-15T14:30:00.000Z");
    assert.equal(ok.status, "ELIGIBLE");
    assert.equal(ok.value, 3);
    const late = toFeatureDatum(obs, "2022-08-15T13:00:00.000Z");
    assert.equal(late.status, "NOT_ELIGIBLE");
  });

  it("API-Sports obs without clock stay NOT_ELIGIBLE; with clock merge into bag", async () => {
    const body = {
      response: [
        { team: { name: "Arsenal" }, player: { name: "X", type: "Missing Fixture" } },
        { team: { name: "Chelsea" }, player: { name: "Y", type: "Missing Fixture" } },
      ],
    };
    const noClock = await fetchApiSportsPrematchObservations({
      eventId: "e1",
      eventTime: "2022-08-15T15:00:00.000Z",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      decisionTime: "2022-08-15T14:00:00.000Z",
      deps: { injuriesBody: body, sourcePublishedAt: null },
    });
    assert.ok(noClock.some((o) => o.feature_name === "home_injuries_n"));
    assert.ok(noClock.every((o) => !o.available_at || o.feature_name.includes("list")));

    const clocked = await fetchApiSportsPrematchObservations({
      eventId: "e1",
      eventTime: "2022-08-15T15:00:00.000Z",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      decisionTime: "2022-08-15T14:00:00.000Z",
      deps: {
        injuriesBody: body,
        sourcePublishedAt: "2022-08-15T12:00:00.000Z",
      },
    });
    const bag = synthesizeFeatureBag({
      eventId: "e1",
      decisionTime: "2022-08-15T14:00:00.000Z",
      observations: clocked,
    });
    assert.equal(bag.features.get("home_injuries_n")?.status, "ELIGIBLE");
    assert.equal(bag.features.get("home_injuries_n")?.value, 1);

    const matches = miniMatches();
    const base = buildFeatureVectorPi(matches[50]!, matches);
    const merged = mergeDiIntoFeatureVector(base, bag.features);
    assert.equal(merged.values.home_injuries_n, 1);
    assertNoMarketInputsInPredictionContext(Object.keys(merged.values));

    const p0 = predictPoissonIndependent({ features: base });
    const p1 = predictPoissonIndependent({ features: merged });
    assert.notEqual(p0.HOME, p1.HOME);
  });

  it("future injuries do not change feature bag values", () => {
    const matches = miniMatches();
    const base = buildFeatureVectorPi(matches[50]!, matches);
    const future: PrematchFeatureObservation = {
      event_id: matches[50]!.canonical_id,
      event_time: matches[50]!.event_time,
      source_id: "api-sports",
      feature_name: "home_injuries_n",
      feature_value: 9,
      source_published_at: "2099-01-01T00:00:00.000Z",
      retrieved_at: "2099-01-01T00:00:00.000Z",
      available_at: "2099-01-01T00:00:00.000Z",
      feature_time: "2099-01-01T00:00:00.000Z",
      quality: "confirmed",
      timestamp_precision: "datetime",
      enters_independent_model: true,
    };
    const bag = synthesizeFeatureBag({
      eventId: matches[50]!.canonical_id,
      decisionTime: matches[50]!.event_time,
      observations: [future],
    });
    assert.equal(bag.features.get("home_injuries_n")?.status, "NOT_ELIGIBLE");
    const merged = mergeDiIntoFeatureVector(base, bag.features);
    assert.equal(merged.values.home_injuries_n ?? null, null);
  });

  it("conflict injuries set FEATURE_QUALITY_LOW; scrape never merges", () => {
    const obs: PrematchFeatureObservation[] = [
      {
        event_id: "e1",
        event_time: "2022-08-15T15:00:00.000Z",
        source_id: "api-sports",
        feature_name: "home_injuries_n",
        feature_value: 1,
        source_published_at: "2022-08-15T12:00:00.000Z",
        retrieved_at: "2022-08-15T12:00:00.000Z",
        available_at: "2022-08-15T12:00:00.000Z",
        feature_time: "2022-08-15T12:00:00.000Z",
        quality: "confirmed",
        timestamp_precision: "datetime",
        enters_independent_model: true,
      },
      {
        event_id: "e1",
        event_time: "2022-08-15T15:00:00.000Z",
        source_id: "api-sports-alt",
        feature_name: "home_injuries_n",
        feature_value: 4,
        source_published_at: "2022-08-15T12:00:00.000Z",
        retrieved_at: "2022-08-15T12:00:00.000Z",
        available_at: "2022-08-15T12:00:00.000Z",
        feature_time: "2022-08-15T12:00:00.000Z",
        quality: "confirmed",
        timestamp_precision: "datetime",
        enters_independent_model: true,
      },
      {
        event_id: "e1",
        event_time: "2022-08-15T15:00:00.000Z",
        source_id: "fbref",
        feature_name: "home_injuries_n",
        feature_value: 99,
        source_published_at: "2022-08-15T12:00:00.000Z",
        retrieved_at: "2022-08-15T12:00:00.000Z",
        available_at: "2022-08-15T12:00:00.000Z",
        feature_time: "2022-08-15T12:00:00.000Z",
        quality: "ok",
        timestamp_precision: "datetime",
        enters_independent_model: true,
      },
    ];
    const bag = synthesizeFeatureBag({
      eventId: "e1",
      decisionTime: "2022-08-15T14:00:00.000Z",
      observations: obs,
    });
    assert.ok(bag.reason_codes.includes("FEATURE_QUALITY_LOW"));
    assert.equal(bag.features.get("home_injuries_n")?.value, 1);
  });

  it("production still allows ordinary GET scrape; bypass remains forbidden", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BETMIND_TEST_SCRAPE: "true",
      NODE_ENV: "production",
    };
    delete env.BETMIND_ALLOW_TEST_SCRAPE_IN_CI;
    assert.equal(isTestScrapeEnabled(env), true);
    assert.equal(scrapingAllowedForSource("sofascore", env), "ALLOW");
  });

  it("audit writes feature-manifest-p0 and FINAL_VERDICT block", async () => {
    const dir = mkdtempLab();
    mkdirSync(join(dir, "predictive-intelligence", "datasets"), { recursive: true });
    writeFileSync(
      join(dir, "predictive-intelligence", "datasets", "matches.jsonl"),
      miniMatches()
        .map((m) => JSON.stringify(m))
        .join("\n") + "\n",
    );
    await runDataIntelligenceAudit({
      labBRoot: dir,
      cwd: dir,
      sampleLimit: 5,
      nowIso: "2026-09-09T12:00:00.000Z",
    });
    const manif = JSON.parse(
      readFileSync(
        join(dir, "predictive-intelligence", "data-intelligence", "feature-manifest-p0.json"),
        "utf8",
      ),
    );
    assert.ok(Array.isArray(manif.entries));
    const fv = JSON.parse(
      readFileSync(
        join(dir, "predictive-intelligence", "data-intelligence", "final-verdict.json"),
        "utf8",
      ),
    );
    assert.equal(fv.REAL_MONEY, false);
    assert.equal(fv.LAB_A, "untouched");
    assert.ok(fv.FEATURES_ACTIVE);
  });
});
