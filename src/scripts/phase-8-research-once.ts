/**
 * Phase 8: research 20 upcoming football events and write yield artifacts.
 * Does not lower gates. Does not invent observations.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { runEventResearchBatch } from "@/domain/eval/data-intelligence/research/run-event-research";
import { loadResearchObservationsForEvent } from "@/domain/eval/data-intelligence/research/observations-store";
import { latestResearchBySource } from "@/domain/eval/data-intelligence/research/status";
import { summarizeObservations } from "@/domain/eval/data-intelligence/research/data-yield";
import { resolveEventIdentity } from "@/domain/eval/data-intelligence/research/event-identity";
import { ANALYSIS_RUNTIME_VERSION } from "@/domain/eval/permanent-044/prediction-precedence";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

const PREFERRED = [
  "b54ded61f9dc94423dfcb089",
  "aa61ed76290f6bad175de6c1",
  "6ad3005597157baf9d6cee11",
  "7339035cbce8739a356589b4",
  "95479bab3a9bf2e349a7825d",
];

function competitionBucket(c: string | null | undefined): string {
  const s = String(c ?? "").toLowerCase();
  if (s.includes("epl") || s.includes("premier")) return "EPL";
  if (s.includes("serie")) return "SERIE_A";
  if (s.includes("liga") || s.includes("spain")) return "LA_LIGA";
  if (s.includes("bundes")) return "BUNDESLIGA";
  if (s.includes("champion") || s.includes("uefa") || s.includes("europa")) return "UCL_UEL";
  return "OTHER";
}

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const root = permanentRoot044();
  const store = loadStore044(root);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const upcoming = store.events.filter((e) => {
    const ko = e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN;
    const sport = String((e as { sport?: string }).sport ?? "soccer").toLowerCase();
    return Number.isFinite(ko) && ko >= nowMs && /soccer|football|calcio/.test(sport);
  });
  const byId = new Map(upcoming.map((e) => [e.event_id, e]));
  const picked: PermanentEvent044[] = [];
  for (const id of PREFERRED) {
    const ev = byId.get(id);
    if (ev) picked.push(ev);
  }
  const buckets = new Map<string, PermanentEvent044[]>();
  for (const e of upcoming) {
    if (PREFERRED.includes(e.event_id)) continue;
    const b = competitionBucket(e.competition);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push(e);
  }
  const order = ["EPL", "SERIE_A", "LA_LIGA", "BUNDESLIGA", "UCL_UEL", "OTHER"];
  const perBucket = 3;
  for (const b of order) {
    let n = 0;
    for (const e of buckets.get(b) ?? []) {
      if (picked.length >= 20 || n >= perBucket) break;
      if (picked.some((p) => p.event_id === e.event_id)) continue;
      picked.push(e);
      n += 1;
    }
  }
  for (const e of upcoming) {
    if (picked.length >= 20) break;
    if (!picked.some((p) => p.event_id === e.event_id)) picked.push(e);
  }

  const result = await runEventResearchBatch({
    events: picked,
    cycleNumber: null,
    nowIso,
    labBRoot: root,
    maxEvents: 20,
    allowScrapeProbes: true,
    asOf: nowIso,
  });

  const allObs = picked.flatMap((e) => loadResearchObservationsForEvent(e.event_id, root, 400));
  const yieldSum = summarizeObservations(allObs, result.research_fetches + result.research_failures);

  const events = picked.map((e) => {
    const rows = latestResearchBySource(e.event_id, root);
    const obs = loadResearchObservationsForEvent(e.event_id, root, 400);
    const identity = resolveEventIdentity({
      home: e.home_or_a,
      away: e.away_or_b,
      competition: e.competition,
      kickoff: e.kickoff_utc,
      labBRoot: root,
    });
    return {
      event_id: e.event_id,
      home: e.home_or_a,
      away: e.away_or_b,
      competition: e.competition,
      kickoff_utc: e.kickoff_utc,
      identity: {
        home: identity.home.canonical_id,
        away: identity.away.canonical_id,
        confidence: identity.match_confidence,
      },
      sources: rows.map((r) => ({
        source_id: r.source_id,
        parser_status: r.parser_status,
        ok: r.ok,
        http_status: r.http_status,
        fields: r.fields_extracted,
        reason: r.reason,
      })),
      observations: obs.length,
      real_event: obs.filter((o) => o.kind === "EVENT_RESEARCH").length,
      historical: obs.filter((o) => o.kind === "HISTORICAL_PRIOR" || o.kind === "DERIVED").length,
      model_eligible: obs.filter((o) => o.enters_independent_model).length,
      categories: {
        form: obs.some((o) => /_l(3|5|10)$/.test(o.feature_key)),
        team_stats: obs.some((o) => /shot|sot|gf|ga|corner|card/.test(o.feature_key)),
        xg: obs.some((o) => /xg/i.test(o.feature_key)),
        injuries: obs.some((o) => /injur/i.test(o.feature_key)),
        lineup: obs.some((o) => /lineup|xi/i.test(o.feature_key)),
        referee: obs.some((o) => /ref|arbit/i.test(o.feature_key)),
        weather: obs.some((o) => /temp|precip|wind|humid/.test(o.feature_key)),
      },
      sample: obs.slice(0, 12).map((o) => ({
        key: o.feature_key,
        value: o.value,
        source: o.source,
        kind: o.kind ?? null,
        available_at: o.available_at,
      })),
    };
  });

  const n = events.length || 1;
  const coverage = {
    form: events.filter((e) => e.categories.form).length / n,
    team_stats: events.filter((e) => e.categories.team_stats).length / n,
    xg: events.filter((e) => e.categories.xg).length / n,
    injuries: events.filter((e) => e.categories.injuries).length / n,
    lineup: events.filter((e) => e.categories.lineup).length / n,
    referee: events.filter((e) => e.categories.referee).length / n,
    weather: events.filter((e) => e.categories.weather).length / n,
  };

  const outDir = join(process.cwd(), "artifacts", "phase-8");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "data-yield-report.json"), JSON.stringify({ at: nowIso, runtime: ANALYSIS_RUNTIME_VERSION, research: result, yield: yieldSum, coverage, events }, null, 2));
  writeFileSync(
    join(outDir, "research-cycle-report.json"),
    JSON.stringify(
      {
        at: nowIso,
        runtime: ANALYSIS_RUNTIME_VERSION,
        events_discovered: store.events.length,
        events_researched: picked.length,
        events_with_real_data: result.events_with_real_event_data,
        total_observations: result.observations_created,
        observations_by_source: yieldSum.by_source,
        observations_by_category: yieldSum.by_category,
        data_yield: result.data_yield,
        coverage,
        samples: events.slice(0, 5).map((e) => ({
          match: `${e.home} vs ${e.away}`,
          observations: e.observations,
          categories: e.categories,
        })),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(outDir, "source-performance.json"),
    JSON.stringify({ at: nowIso, by_source: result.by_source, yield_by_source: yieldSum.by_source }, null, 2),
  );
  writeFileSync(join(outDir, "sample-event-dossiers.json"), JSON.stringify({ at: nowIso, events: events.slice(0, 10) }, null, 2));
  console.log(
    JSON.stringify(
      {
        processed: picked.length,
        observations: result.observations_created,
        real_event: result.real_event_observations,
        historical: result.historical_observations,
        derived: result.derived_observations,
        yield: result.data_yield,
        fetches: result.research_fetches,
        failures: result.research_failures,
        coverage,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
