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
import { labEventsForAcquisition } from "@/domain/eval/acquisition-engine/lab-events";
import { FREE_SOURCE_CATALOG, BLOCKED_PROTECTED_SOURCES } from "@/domain/eval/acquisition-engine/catalog";
import { listCalendarEvents, todayCalendarDay } from "@/domain/eval/betmind-runtime/calendar";
import { probeCachedOddsAttach, summarizeMarketAttach } from "@/domain/eval/betmind-runtime/market-attach";
import { localLabStorePresent } from "@/domain/eval/betmind-runtime/production-mirror";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const nowIso = new Date().toISOString();
  const cwd = process.cwd();
  const persistNeon = Boolean(process.env.DATABASE_URL);
  const lab = labEventsForAcquisition();
  const result = await runAcquisitionEngineCycle({
    nowIso,
    cwd,
    persistNeon,
    ...lab,
  });

  const labBRoot = permanentRoot044();
  const today = todayCalendarDay(nowIso);
  const calendar = localLabStorePresent(labBRoot)
    ? listCalendarEvents({ root: labBRoot, from: today, sport: "ALL", cwd })
    : { day: today, total: 0, events: [] };
  const oddsAttach = summarizeMarketAttach({
    events: calendar.events.map((e) => ({
      event_id: String(e.event_id),
      home: e.home_or_a != null ? String(e.home_or_a) : null,
      away: e.away_or_b != null ? String(e.away_or_b) : null,
      kickoff_utc: e.kickoff_utc != null ? String(e.kickoff_utc) : null,
      odds_home: typeof e.odds_home === "number" ? e.odds_home : null,
      odds_draw: typeof e.odds_draw === "number" ? e.odds_draw : null,
      odds_away: typeof e.odds_away === "number" ? e.odds_away : null,
    })),
  });
  const sampleAttached = calendar.events
    .filter((e) => e.odds_status === "BOOK")
    .slice(0, 8)
    .map((e) => ({
      event_id: e.event_id,
      label: e.label,
      bookmaker: e.bookmaker,
      odds_home: e.odds_home,
      odds_draw: e.odds_draw,
      odds_away: e.odds_away,
      odds_source: e.odds_source,
      odds_compare_only: e.odds_compare_only,
    }));
  const sampleMissing = calendar.events
    .filter((e) => e.odds_status !== "BOOK")
    .slice(0, 8)
    .map((e) => ({
      event_id: e.event_id,
      label: e.label,
      odds_status: "MISSING",
      note: "Quote non disponibili. Niente di inventato.",
    }));

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
          sql: "SELECT slug, name, license_class FROM data_sources WHERE slug IN ('openligadb','thesportsdb','statsbomb','espn','openfootball','bbc-sport','understat','open-meteo','sky-sports');",
        }
      : { note: "DATABASE_URL not set — disk cache only. Set DATABASE_URL to register data_sources." },
    coverage: result.coverage,
    odds_ui: {
      note: "Compare-only book 1X2 on calendar/board. Never MODEL. Missing stays honest — no mock prices.",
      calendar: oddsAttach,
      cache_probe: probeCachedOddsAttach(cwd),
      sample_attached: sampleAttached,
      sample_missing: sampleMissing,
    },
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
    source_table: result.lanes.map((l) => ({
      source_id: l.source_id,
      adapter: l.source_id,
      status: l.status,
      ok: l.ok,
      outcome:
        l.status === "OK" || l.status === "PARTIAL"
          ? "ok"
          : l.status === "BLOCKED"
            ? "blocked"
            : l.status === "AUTH_REQUIRED"
              ? "auth"
              : "failed",
      reason_it: l.reason_it,
    })),
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
