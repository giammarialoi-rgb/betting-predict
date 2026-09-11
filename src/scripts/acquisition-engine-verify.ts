/**
 * Live verify of the free acquisition engine. Continue-on-fail. No WAF bypass.
 * Writes artifacts/acquisition-engine/verify-report.json
 *
 *   pnpm acquire:engine:verify
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runAcquisitionEngineCycle } from "@/domain/eval/acquisition-engine/engine";
import { FREE_SOURCE_CATALOG, BLOCKED_PROTECTED_SOURCES } from "@/domain/eval/acquisition-engine/catalog";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const nowIso = new Date().toISOString();
  const cwd = process.cwd();
  const persistNeon = Boolean(process.env.DATABASE_URL);
  const result = await runAcquisitionEngineCycle({
    nowIso,
    cwd,
    persistNeon,
  });

  const clubeloCsv = join(cwd, "data", "clubelo", `${nowIso.slice(0, 10)}.csv`);
  const report = {
    at: nowIso,
    neon_enabled: persistNeon,
    how_to_run: {
      once: "pnpm acquire:engine",
      verify: "pnpm acquire:engine:verify",
      worker: "pnpm brain:worker  # engine runs each brain cycle",
    },
    neon_rows_to_expect: persistNeon
      ? {
          data_sources_slugs: FREE_SOURCE_CATALOG.map((s) => s.source_id),
          elo_snapshots: "ClubElo ratings (bounded, provenance official_clubelo) when CSV parsed — never invented",
          feature_observations: "only when an event UUID is supplied — this verify does not invent events",
          sql: "SELECT slug, name, license_class FROM data_sources WHERE slug IN ('clubelo','openligadb','thesportsdb','statsbomb','espn','openfootball','bbc-sport');",
        }
      : { note: "DATABASE_URL not set — disk cache only. Set DATABASE_URL to register data_sources." },
    coverage: result.coverage,
    rate_limits: FREE_SOURCE_CATALOG.map((s) => ({
      source_id: s.source_id,
      min_interval_ms: s.rate_limit_ms,
      notes: s.notes,
    })),
    blocked_protected: BLOCKED_PROTECTED_SOURCES.map((s) => ({
      source_id: s.source_id,
      reason_it: s.reason_it,
    })),
    clubelo_csv_present: existsSync(clubeloCsv),
    clubelo_csv_path: clubeloCsv,
    cycle: {
      sources_ok: result.sources_ok,
      sources_failed: result.sources_failed,
      sources_blocked: result.sources_blocked,
      records: result.records,
      neon_sources: result.neon_sources,
    },
    lanes: result.lanes.map((l) => ({
      source_id: l.source_id,
      ok: l.ok,
      status: l.status,
      http_status: l.http_status,
      fields_extracted: l.fields_extracted,
      reason: l.reason,
      reason_it: l.reason_it,
      cache_path: l.cache_path,
      neon: l.neon,
      record_count: l.records.length,
      coverage: l.coverage ?? null,
    })),
  };

  const outDir = join(cwd, "artifacts", "acquisition-engine");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "verify-report.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: result.sources_ok >= 2, outPath, ...report.cycle }, null, 2));
  if (result.sources_ok < 2) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
