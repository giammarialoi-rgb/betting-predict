import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot, PI_HOLDOUT_SEASON } from "@/domain/eval/predictive-intelligence/config";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import {
  buildSourceRegistry,
  clubEloCachePresent,
} from "@/domain/eval/data-intelligence/registry";
import { loadClubEloCacheSync } from "@/domain/eval/data-intelligence/clubelo-cache";
import { synthesizePrematchFacts } from "@/domain/eval/data-intelligence/synthesis";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { runTestScrapeProbes } from "@/domain/eval/data-intelligence/scrape/probe";
import {
  FEATURE_MANIFEST_P0,
  featureManifestP0Summary,
} from "@/domain/eval/data-intelligence/feature-manifest";
import { synthesizeFeatureBag } from "@/domain/eval/data-intelligence/feature-bag";
import type { DataIntelligenceAuditResult } from "@/domain/eval/data-intelligence/types";
import type { FeatureDatum } from "@/domain/eval/predictive-intelligence/types";
import type { PrematchFeatureObservation } from "@/domain/eval/data-intelligence/types";

export function dataIntelligenceRoot(labBRoot?: string): string {
  return join(piRoot(labBRoot), "data-intelligence");
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

/** Full Data Intelligence audit — disk primary; optional TEST_SCRAPE probes. */
export async function runDataIntelligenceAudit(input?: {
  labBRoot?: string;
  nowIso?: string;
  sampleLimit?: number;
  cwd?: string;
  runScrapeProbes?: boolean;
}): Promise<DataIntelligenceAuditResult> {
  const labB = input?.labBRoot ?? permanentRoot044();
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const cwd = input?.cwd ?? process.cwd();
  const sampleLimit = input?.sampleLimit ?? 40;
  const root = dataIntelligenceRoot(labB);
  mkdirSync(root, { recursive: true });

  const matches = loadPiMatches(labB);
  const clubeloPresent = clubEloCachePresent(cwd);
  const clubElo = clubeloPresent ? loadClubEloCacheSync(cwd) : [];
  const testScrape = isTestScrapeEnabled();

  const registry = buildSourceRegistry({
    footballDataRows: matches.length,
    clubeloCachePresent: clubeloPresent,
    testScrapeEnabled: testScrape,
  });
  writeJson(join(root, "source-registry.json"), {
    at: nowIso,
    real_money: false,
    test_scrape_enabled: testScrape,
    scrape_enters_model: false,
    sources: registry,
  });

  const manifestSummary = featureManifestP0Summary();
  writeJson(join(root, "feature-manifest-p0.json"), {
    at: nowIso,
    entries: FEATURE_MANIFEST_P0,
    summary: manifestSummary,
    real_money: false,
  });

  const holdout = matches.filter((m) => m.season === PI_HOLDOUT_SEASON);
  const sample = (holdout.length >= 10 ? holdout : matches).slice(0, sampleLimit);

  const availabilityRows: Array<{
    event_id: string;
    features: FeatureDatum[];
    feature_coverage: number;
    data_quality: number;
  }> = [];
  const snapshots: Array<{
    event_id: string;
    values: Record<string, number | null>;
    feature_data: FeatureDatum[];
    closing_odds_used: false;
  }> = [];

  let marketSeparationOk = true;
  const marketSeparationFailures: string[] = [];
  let eligibleTotal = 0;
  let notEligibleTotal = 0;
  let unavailableTotal = 0;
  let dateOnlyCount = 0;
  let strictCount = 0;
  let unknownCount = 0;
  const allConflicts: Array<{ event_id: string; field: string; sources: string[]; detail: string }> =
    [];
  let agreementSum = 0;
  let agreementN = 0;

  for (const m of sample) {
    const feat = buildFeatureVectorPi(m, matches, { clubElo });
    try {
      assertNoMarketInputsInPredictionContext(Object.keys(feat.values));
    } catch (e) {
      marketSeparationOk = false;
      marketSeparationFailures.push(`${m.canonical_id}: ${(e as Error).message}`);
    }
    if (feat.closing_odds_used) {
      marketSeparationOk = false;
      marketSeparationFailures.push(`${m.canonical_id}: closing_odds_used`);
    }
    for (const d of feat.feature_data) {
      if (d.status === "ELIGIBLE") eligibleTotal += 1;
      else if (d.status === "NOT_ELIGIBLE") notEligibleTotal += 1;
      else unavailableTotal += 1;
      if (d.temporal_precision === "DATE_ONLY") dateOnlyCount += 1;
      if (d.temporal_precision === "STRICT_AS_OF") strictCount += 1;
      if (d.temporal_precision === "UNKNOWN") unknownCount += 1;
      if (d.status === "ELIGIBLE" && !d.available_at) {
        marketSeparationOk = false;
        marketSeparationFailures.push(`${m.canonical_id}/${d.key}: ELIGIBLE without available_at`);
      }
    }

    const synth = synthesizePrematchFacts({
      eventId: m.canonical_id,
      facts: [
        { source_id: "football-data", field: "home_team", value: m.home_team_id },
        {
          source_id: "pi_row",
          field: "home_team",
          value: m.home_team.toLowerCase().replace(/\s+/g, ""),
        },
        { source_id: "football-data", field: "kickoff_day", value: m.match_date },
        { source_id: "pi_row", field: "kickoff_day", value: m.event_time.slice(0, 10) },
      ],
      dataCoverage: feat.feature_coverage,
    });
    agreementSum += synth.source_agreement;
    agreementN += 1;
    for (const c of synth.conflicts) {
      allConflicts.push({ event_id: m.canonical_id, ...c });
    }

    availabilityRows.push({
      event_id: m.canonical_id,
      features: feat.feature_data,
      feature_coverage: feat.feature_coverage,
      data_quality: feat.data_quality,
    });
    snapshots.push({
      event_id: m.canonical_id,
      values: feat.values,
      feature_data: feat.feature_data,
      closing_odds_used: false,
    });
  }

  const covN = availabilityRows.length || 1;
  const avgCoverage =
    availabilityRows.reduce((s, r) => s + r.feature_coverage, 0) / covN;
  const SOURCE_AGREEMENT = agreementN
    ? Math.round((agreementSum / agreementN) * 1000) / 1000
    : null;
  const temporalTotal = dateOnlyCount + strictCount + unknownCount || 1;
  const TIMESTAMP_QUALITY =
    Math.round(((dateOnlyCount * 0.5 + strictCount * 1) / temporalTotal) * 1000) / 1000;

  writeJson(join(root, "feature-availability.json"), {
    at: nowIso,
    sample_n: sample.length,
    events: availabilityRows.map((r) => ({
      event_id: r.event_id,
      feature_coverage: r.feature_coverage,
      by_status: {
        ELIGIBLE: r.features.filter((f) => f.status === "ELIGIBLE").length,
        NOT_ELIGIBLE: r.features.filter((f) => f.status === "NOT_ELIGIBLE").length,
        UNAVAILABLE: r.features.filter((f) => f.status === "UNAVAILABLE").length,
      },
      features: r.features.map((f) => ({
        key: f.key,
        status: f.status,
        available_at: f.available_at,
        source: f.source,
        temporal_precision: f.temporal_precision,
      })),
    })),
    real_money: false,
  });

  writeJson(join(root, "coverage-report.json"), {
    at: nowIso,
    sample_n: sample.length,
    avg_feature_coverage: Math.round(avgCoverage * 1000) / 1000,
    DATA_COVERAGE: Math.round(avgCoverage * 1000) / 1000,
    SOURCE_COUNT: registry.filter((s) => s.status !== "DISABLED_BY_POLICY").length,
    SOURCE_AGREEMENT,
    TIMESTAMP_QUALITY,
    totals: {
      ELIGIBLE: eligibleTotal,
      NOT_ELIGIBLE: notEligibleTotal,
      UNAVAILABLE: unavailableTotal,
      DATE_ONLY: dateOnlyCount,
      STRICT_AS_OF: strictCount,
      UNKNOWN: unknownCount,
    },
    clubelo_cache_present: clubeloPresent,
    test_scrape_enabled: testScrape,
    unavailable_families: manifestSummary.stub_or_missing_families,
    FEATURES_ACTIVE: manifestSummary.by_readiness.ACTIVE,
    FEATURES_STUB: manifestSummary.by_readiness.STUB,
    FEATURES_CONTEXT_ONLY: manifestSummary.by_readiness.CONTEXT_ONLY,
    FEATURES_MISSING: manifestSummary.by_readiness.MISSING,
    real_money: false,
  });

  writeJson(join(root, "feature-snapshot-report.json"), {
    at: nowIso,
    sample_n: snapshots.length,
    snapshots: snapshots.slice(0, 20),
    real_money: false,
    enters_independent_model_keys_only: true,
  });

  writeJson(join(root, "market-separation-report.json"), {
    at: nowIso,
    ok: marketSeparationOk,
    failures: marketSeparationFailures,
    note: "MODEL feature bags must not contain odds/market keys; scrape/meteo are CONTEXT only",
    odds_independence_regression: "see predictive-intelligence.test CRITICAL",
    independent_markets: "1X2_ONLY",
    scrape_enters_model: false,
    real_money: false,
  });

  writeJson(join(root, "data-quality-report.json"), {
    at: nowIso,
    warnings: [
      "Football-Data temporal_precision=DATE_ONLY — not EXACT available_at",
      ...(clubeloPresent ? [] : ["ClubElo cache absent — elo features UNAVAILABLE"]),
      testScrape
        ? "TEST_SCRAPE enabled — RESEARCH_TEST sources CONTEXT only"
        : "FBRef/Understat/UEFA/SofaScore DISABLED_BY_POLICY (set BETMIND_TEST_SCRAPE=true for research probes)",
      "API-Sports injuries/lineups enter MODEL only with demonstrable available_at",
      "Open-Meteo weather is CONTEXT not MODEL in this phase",
    ],
    conflicts: allConflicts.slice(0, 50),
    coverage_gaps: {
      unavailable_total: unavailableTotal,
      not_eligible_total: notEligibleTotal,
    },
    SOURCE_AGREEMENT,
    FEATURES_ACTIVE: manifestSummary.by_readiness.ACTIVE,
    real_money: false,
  });

  // Smoke: DI feature bag synthesis with clocked injuries (no network)
  const smokeObs: PrematchFeatureObservation[] = [
    {
      event_id: "audit-smoke",
      event_time: nowIso,
      source_id: "api-sports",
      feature_name: "home_injuries_n",
      feature_value: 2,
      source_published_at: "2022-08-01T12:00:00.000Z",
      retrieved_at: nowIso,
      available_at: "2022-08-01T12:00:00.000Z",
      feature_time: "2022-08-01T12:00:00.000Z",
      quality: "confirmed",
      timestamp_precision: "datetime",
      enters_independent_model: true,
      legal_status: "licensed",
    },
  ];
  const smokeBag = synthesizeFeatureBag({
    eventId: "audit-smoke",
    decisionTime: "2022-08-15T15:00:00.000Z",
    observations: smokeObs,
  });
  writeJson(join(root, "feature-bag-smoke.json"), {
    at: nowIso,
    home_injuries_n: smokeBag.features.get("home_injuries_n") ?? null,
    reason_codes: smokeBag.reason_codes,
    real_money: false,
  });

  let scrapeProbeReport: unknown = { enabled: false, probes: [] };
  if (testScrape && input?.runScrapeProbes && sample[0]) {
    const probes = await runTestScrapeProbes({
      eventId: sample[0]!.canonical_id,
      eventTime: sample[0]!.event_time,
      labBRoot: labB,
    });
    scrapeProbeReport = {
      enabled: true,
      at: nowIso,
      probes: probes.map((p) => ({
        source_id: p.source_id,
        status: p.status,
        http_status: p.http_status,
        bytes: p.bytes,
        reason: p.reason,
        enters_independent_model: false,
      })),
    };
  }
  writeJson(join(root, "scrape-probe-report.json"), scrapeProbeReport);

  const diVerdict = {
    at: nowIso,
    verdict: marketSeparationOk && matches.length >= 100 ? "PARTIAL" : "BLOCKED",
    data_intelligence: "PARTIAL",
    FINAL_VERDICT: marketSeparationOk && matches.length >= 100 ? "PARTIAL" : "BLOCKED",
    FILES_CHANGED: "data-intelligence Phase2 feature-bag + api-sports-prematch + manifest",
    DATA_SOURCES: registry.map((s) => `${s.id}:${s.status}`),
    DATA_COVERAGE: Math.round(avgCoverage * 1000) / 1000,
    FEATURES_ACTIVE: manifestSummary.by_readiness.ACTIVE,
    FEATURES_STUB_OR_MISSING: manifestSummary.stub_or_missing_families,
    MARKET_SEPARATION: marketSeparationOk,
    MODEL: "INDEPENDENT_POISSON + DI ELIGIBLE injuries/lineups/elo",
    MULTI_MARKET: "1X2_ONLY",
    REASONING: "feature-derived why + conflict flags",
    LEARNING: "walk-forward unchanged",
    TESTS: "see data-intelligence.test + predictive-intelligence CRITICAL",
    LAB_A: "untouched",
    REAL_MONEY: false,
    REMAINING_BLOCKER: [
      ...(clubeloPresent ? [] : ["ClubElo CSV cache absent"]),
      "xG/referee/coach still STUB/MISSING",
      "API-Sports MODEL requires demonstrable available_at",
    ],
    independent_markets: "1X2_ONLY",
    test_scrape_enabled: testScrape,
    scrape_enters_model: false,
    scraping_sources_disabled: !testScrape,
    market_as_model_forbidden: true,
    clubelo_cache_present: clubeloPresent,
    real_money: false,
    lab_a_mutated: false,
    note:
      "Phase2: synthesis→FeatureDatum bag for API-Sports/ClubElo. Open-Meteo/scrape=CONTEXT. Odds never in MODEL.",
  };
  writeJson(join(root, "final-verdict.json"), diVerdict);

  const piFvPath = join(piRoot(labB), "final-verdict.json");
  if (existsSync(piFvPath)) {
    try {
      const fv = JSON.parse(readFileSync(piFvPath, "utf8")) as Record<string, unknown>;
      fv.data_intelligence = "PARTIAL";
      fv.independent_markets = "1X2_ONLY";
      fv.test_scrape_enabled = testScrape;
      fv.scrape_enters_model = false;
      fv.scraping_sources_disabled = !testScrape;
      fv.data_intelligence_at = nowIso;
      writeFileSync(piFvPath, JSON.stringify(fv, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }

  const auditDi = join(
    process.cwd(),
    "audit",
    "external",
    "task-044",
    "predictive-intelligence",
    "data-intelligence",
  );
  const permanent = permanentRoot044();
  if (labB === permanent || root.startsWith(join(permanent, "predictive-intelligence"))) {
    mkdirSync(auditDi, { recursive: true });
    for (const name of [
      "source-registry.json",
      "coverage-report.json",
      "feature-availability.json",
      "data-quality-report.json",
      "feature-snapshot-report.json",
      "market-separation-report.json",
      "scrape-probe-report.json",
      "feature-manifest-p0.json",
      "feature-bag-smoke.json",
      "final-verdict.json",
    ]) {
      const src = join(root, name);
      if (existsSync(src) && src !== join(auditDi, name)) {
        writeFileSync(join(auditDi, name), readFileSync(src, "utf8"), "utf8");
      }
    }
  }

  return {
    at: nowIso,
    labBRoot: labB,
    sample_n: sample.length,
    clubelo_cache_present: clubeloPresent,
    test_scrape_enabled: testScrape,
    scrape_enters_model: false,
    real_money: false,
    independent_markets: "1X2_ONLY",
    scraping_disabled: !testScrape,
    paths: {
      root,
      audit: auditDi,
    },
  };
}
