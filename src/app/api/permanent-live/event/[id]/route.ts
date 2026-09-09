import { NextResponse } from "next/server";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { buildEventDetail046 } from "@/domain/eval/control-046/dashboard";
import { enhanceEventDetail048 } from "@/domain/eval/factory-048/control";
import { buildLineage055 } from "@/domain/eval/catalog-055/lineage";
import { loadUniversals055 } from "@/domain/eval/catalog-055/cycle";

export const dynamic = "force-dynamic";

/** READ-ONLY event detail. Zero Odds API calls. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = loadStore044(permanentRoot044());
  const detail = buildEventDetail046(store, id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const extra = enhanceEventDetail048(store, id);
  const pred = store.predictions
    .filter((p) => p.event_id === id)
    .sort((a, b) => b.prediction_seq - a.prediction_seq)[0];
  const lock = store.locks.find((l) => l.event_id === id) ?? null;
  const set = store.settlements.find((s) => s.event_id === id) ?? null;
  const autopsy = store.autopsies.find((a) => a.event_id === id) ?? null;
  const learning = store.learning.find((l) => l.autopsy_id === autopsy?.autopsy_id) ?? null;
  const uni = loadUniversals055().find(
    (u) => u.event_id === id || u.source_event_ids.some((s) => s.id === id),
  );
  const lineage_055 = buildLineage055({
    sources: uni?.source_ids ?? ["THE_ODDS_API"],
    observation_at: detail.event.kickoff_utc,
    snapshot_at: lock?.lock_timestamp ?? null,
    prediction_id: pred?.prediction_id ?? null,
    prediction_at: pred?.timestamp ?? null,
    decision: pred ? (pred.recommended ? "BET_CANDIDATE" : "NO_BET") : null,
    lock_at: lock?.lock_timestamp ?? null,
    result_at: set?.settled_at ?? null,
    autopsy_id: autopsy?.autopsy_id ?? null,
    learning_id: learning?.candidate_id ?? null,
  });
  return NextResponse.json({
    ...detail,
    ...extra,
    lineage_055,
    universal_055: uni
      ? {
          universal_event_id: uni.universal_event_id,
          source_ids: uni.source_ids,
          match_confidence: uni.match_confidence,
          odds_status: uni.odds_status,
        }
      : null,
    api_calls_ui: 0,
  });
}
