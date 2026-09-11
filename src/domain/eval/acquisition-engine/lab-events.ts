/**
 * Lab B events for compare-only quote persist. Never invents fixtures.
 */
import { localLabStorePresent } from "@/domain/eval/betmind-runtime/production-mirror";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import type { AcquisitionCycleInput } from "@/domain/eval/acquisition-engine/types";

export function labEventsForAcquisition(limit = 80): {
  persistLabB: boolean;
  labBRoot?: string;
  labEvents?: AcquisitionCycleInput["labEvents"];
} {
  const labBRoot = permanentRoot044();
  if (!localLabStorePresent(labBRoot)) {
    return { persistLabB: false };
  }
  const store = loadStore044(labBRoot);
  return {
    persistLabB: true,
    labBRoot,
    labEvents: store.events.slice(-limit).map((e) => ({
      event_id: e.event_id,
      home: e.home_or_a,
      away: e.away_or_b,
      kickoff_utc: e.kickoff_utc,
      competition: e.competition,
    })),
  };
}
