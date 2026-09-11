/**
 * Always-on free acquisition engine: discover → queue → fetch continue-on-fail
 * → identity fail-closed → disk cache → optional Neon data_sources.
 *
 * Unlimited means resilient retry/failover — not hammering protected sites.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverFreeSourceJobs } from "@/domain/eval/acquisition-engine/catalog";
import { blockedProtectedAudit } from "@/domain/eval/acquisition-engine/blocked-audit";
import { runClubEloLane } from "@/domain/eval/acquisition-engine/sources/clubelo";
import { runOpenLigaDbLane } from "@/domain/eval/acquisition-engine/sources/openligadb";
import { runTheSportsDbLane } from "@/domain/eval/acquisition-engine/sources/thesportsdb";
import { runStatsBombLane } from "@/domain/eval/acquisition-engine/sources/statsbomb";
import { runFootballDataOrgLane } from "@/domain/eval/acquisition-engine/sources/football-data-org";
import { runFootballDataCoUkLane } from "@/domain/eval/acquisition-engine/sources/football-data-co-uk";
import { isRssEngineSource, runPublicRssLane } from "@/domain/eval/acquisition-engine/sources/rss";
import { runEspnLane } from "@/domain/eval/acquisition-engine/sources/espn";
import { runOpenFootballLane } from "@/domain/eval/acquisition-engine/sources/openfootball";
import { runApiFootballLane } from "@/domain/eval/acquisition-engine/sources/api-football";
import { runOddsApiLane } from "@/domain/eval/acquisition-engine/sources/odds-api";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import type {
  AcquisitionCycleInput,
  AcquisitionCycleResult,
  AcquisitionJob,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

export async function runAcquisitionJob(
  job: AcquisitionJob,
  input: AcquisitionCycleInput,
): Promise<SourceLaneResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const cwd = input.cwd ?? process.cwd();
  const persistNeon = input.persistNeon === true && Boolean(process.env.DATABASE_URL);
  const persistLabB = input.persistLabB === true;
  const labBRoot = input.labBRoot;
  const fixtures = input.fixtures ?? {};

  try {
    switch (job.source_id) {
      case "clubelo":
        return await runClubEloLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          csvText: fixtures.clubeloCsv,
          labEvents: input.labEvents,
          fetchImpl: input.fetchImpl,
          maxRetries: input.maxRetries,
        });
      case "openligadb":
        return await runOpenLigaDbLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          jsonText: fixtures.openligaJson,
          fetchImpl: input.fetchImpl,
          labEvents: input.labEvents,
          maxRetries: input.maxRetries,
        });
      case "thesportsdb":
        return await runTheSportsDbLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          jsonText: fixtures.theSportsDbJson,
          fetchImpl: input.fetchImpl,
          labEvents: input.labEvents,
          maxRetries: input.maxRetries,
        });
      case "statsbomb":
        return await runStatsBombLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          jsonText: fixtures.statsbombJson,
          fetchImpl: input.fetchImpl,
          maxRetries: input.maxRetries,
        });
      case "football-data-org":
        return await runFootballDataOrgLane({
          url: job.url,
          nowIso,
          persistNeon,
          fetchImpl: input.fetchImpl,
          maxRetries: input.maxRetries,
        });
      case "football-data-co-uk":
        return await runFootballDataCoUkLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          persistLabB,
          labBRoot,
          csvText: fixtures.footballDataCoUkCsv,
          fetchImpl: input.fetchImpl,
          maxRetries: input.maxRetries,
          labEvents: input.labEvents,
        });
      case "espn":
        return await runEspnLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          persistLabB,
          labBRoot,
          jsonText: fixtures.espnJson,
          fetchImpl: input.fetchImpl,
          labEvents: input.labEvents,
          maxRetries: input.maxRetries,
        });
      case "openfootball":
        return await runOpenFootballLane({
          url: job.url,
          nowIso,
          cwd,
          persistNeon,
          jsonText: fixtures.openFootballJson,
          fetchImpl: input.fetchImpl,
          maxRetries: input.maxRetries,
        });
      case "api-football":
        return await runApiFootballLane({
          url: job.url,
          nowIso,
          persistNeon,
          persistLabB,
          labBRoot,
          jsonText: fixtures.apiFootballJson,
          oddsJson: fixtures.apiFootballOddsJson,
          fetchImpl: input.fetchImpl,
          labEvents: input.labEvents,
        });
      case "the-odds-api":
        return await runOddsApiLane({
          url: job.url,
          nowIso,
          persistNeon,
          persistLabB,
          labBRoot,
          jsonText: fixtures.oddsApiJson,
          fetchImpl: input.fetchImpl,
          labEvents: input.labEvents,
          maxRetries: input.maxRetries,
        });
      default:
        if (isRssEngineSource(job.source_id)) {
          return await runPublicRssLane({
            sourceId: job.source_id,
            url: job.url,
            nowIso,
            persistNeon,
            xmlText: fixtures.rssXml,
            fetchImpl: input.fetchImpl,
          });
        }
        return emptyLane({
          source_id: job.source_id,
          url: job.url,
          status: "SKIPPED",
          reason: "UNKNOWN_SOURCE",
          reason_it: `Fonte ${job.source_id} non e nella coda dell'engine. Nessun fetch.`,
        });
    }
  } catch (e) {
    return emptyLane({
      source_id: job.source_id,
      url: job.url,
      status: "NETWORK_ERROR",
      reason: e instanceof Error ? e.message : String(e),
      reason_it: `${job.source_id} ha lanciato un errore. Il ciclo continua con le altre fonti.`,
    });
  }
}

export async function runAcquisitionEngineCycle(
  input: AcquisitionCycleInput = {},
): Promise<AcquisitionCycleResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const cwd = input.cwd ?? process.cwd();
  const jobs = discoverFreeSourceJobs(nowIso);
  const lanes: SourceLaneResult[] = [];

  for (const job of jobs) {
    const lane = await runAcquisitionJob(job, { ...input, nowIso, cwd });
    lanes.push(lane);
  }

  const blocked_audit = blockedProtectedAudit();
  const sources_ok = lanes.filter((l) => l.ok).length;
  const sources_blocked = lanes.filter((l) => l.status === "BLOCKED").length + blocked_audit.length;
  const sources_failed = lanes.filter((l) => !l.ok).length;
  const records = lanes.reduce((n, l) => n + l.records.length, 0);
  const neon_sources = [
    ...new Set(
      lanes.filter((l) => l.neon.source_registered).map((l) => l.source_id),
    ),
  ];
  const leagues = [...new Set(lanes.flatMap((l) => l.coverage?.leagues ?? []))];
  const sports = [...new Set(lanes.flatMap((l) => l.coverage?.sports ?? []))];
  const market_quotes = lanes.reduce((n, l) => n + (l.coverage?.market_quotes ?? 0), 0);

  const result: AcquisitionCycleResult = {
    at: nowIso,
    sources_ok,
    sources_failed,
    sources_blocked,
    records,
    neon_sources,
    lanes,
    blocked_audit,
    coverage: {
      sources_ok: lanes.filter((l) => l.ok).map((l) => l.source_id),
      sources_failed: lanes.filter((l) => !l.ok).map((l) => l.source_id),
      sources_auth_required: lanes.filter((l) => l.status === "AUTH_REQUIRED").map((l) => l.source_id),
      sources_blocked: [
        ...lanes.filter((l) => l.status === "BLOCKED").map((l) => l.source_id),
        ...blocked_audit.map((b) => b.source_id),
      ],
      leagues,
      sports,
      market_quotes,
    },
  };

  try {
    const outDir = join(cwd, "artifacts", "acquisition-engine");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "last-cycle.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  } catch {
    /* disk report optional */
  }

  return result;
}
