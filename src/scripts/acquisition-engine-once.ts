/**
 * One acquisition cycle: discover → fetch continue-on-fail → cache → optional Neon.
 *
 *   pnpm acquire:engine
 */
import { config } from "dotenv";
import { runAcquisitionEngineCycle } from "@/domain/eval/acquisition-engine/engine";
import { labEventsForAcquisition } from "@/domain/eval/acquisition-engine/lab-events";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const persistNeon = false;
  const lab = labEventsForAcquisition();
  const result = await runAcquisitionEngineCycle({ persistNeon, ...lab });
  console.log(
    JSON.stringify(
      {
        ok: result.sources_ok > 0,
        at: result.at,
        sources_ok: result.sources_ok,
        sources_failed: result.sources_failed,
        records: result.records,
        coverage: result.coverage,
        neon_sources: result.neon_sources,
        lanes: result.lanes.map((l) => ({
          source_id: l.source_id,
          status: l.status,
          http_status: l.http_status,
          ok: l.ok,
          reason_it: l.reason_it,
        })),
        blocked_audit: result.blocked_audit,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
