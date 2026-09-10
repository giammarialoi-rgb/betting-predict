/**
 * Phase 6: research 10 upcoming football events through the existing research batch.
 * Writes artifacts/phase-6/ten-event-run.json. Does not lower gates.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { runEventResearchBatch } from "@/domain/eval/data-intelligence/research/run-event-research";
import { loadResearchObservationsForEvent } from "@/domain/eval/data-intelligence/research/observations-store";
import { latestResearchBySource } from "@/domain/eval/data-intelligence/research/status";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

async function main() {
  const root = permanentRoot044();
  const store = loadStore044(root);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const upcoming = store.events.filter((e) => {
    const ko = e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN;
    return Number.isFinite(ko) && ko >= nowMs;
  });
  const preferred = [
    "b54ded61f9dc94423dfcb089",
    "aa61ed76290f6bad175de6c1",
    "6ad3005597157baf9d6cee11",
    "7339035cbce8739a356589b4",
    "95479bab3a9bf2e349a7825d",
    "b125036643aab594cfc12125",
    "b394c96ef1080986b753eefa",
  ];
  const byId = new Map(upcoming.map((e) => [e.event_id, e]));
  const picked: PermanentEvent044[] = [];
  for (const id of preferred) {
    const ev = byId.get(id);
    if (ev) picked.push(ev);
  }
  for (const e of upcoming) {
    if (picked.length >= 10) break;
    if (!preferred.includes(e.event_id)) picked.push(e);
  }
  const result = await runEventResearchBatch({
    events: picked,
    cycleNumber: null,
    nowIso,
    labBRoot: root,
    maxEvents: 10,
    allowScrapeProbes: true,
    asOf: nowIso,
  });
  const per = picked.map((e) => {
    const rows = latestResearchBySource(e.event_id, root);
    const obs = loadResearchObservationsForEvent(e.event_id, root);
    return {
      event_id: e.event_id,
      home: e.home_or_a,
      away: e.away_or_b,
      competition: e.competition,
      kickoff_utc: e.kickoff_utc,
      sources: rows.map((r) => ({
        source_id: r.source_id,
        parser_status: r.parser_status,
        ok: r.ok,
        http_status: r.http_status,
        fields: r.fields_extracted,
      })),
      observations: obs.length,
    };
  });
  const outDir = join(process.cwd(), "artifacts", "phase-6");
  mkdirSync(outDir, { recursive: true });
  const payload = {
    at: nowIso,
    research: { ...result, processed_ids: picked.map((e) => e.event_id), budget: 10 },
    events: per,
  };
  writeFileSync(join(outDir, "ten-event-run.json"), JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        processed: picked.length,
        fetches: result.research_fetches,
        failures: result.research_failures,
        missing_adapters: result.missing_adapters,
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
