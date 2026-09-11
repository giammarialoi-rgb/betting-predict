import { NextResponse } from "next/server";
import { listConclusiFromNeon, listLiveStatesFromNeon } from "@/domain/eval/mega-pipeline/neon-runtime";
import { loadPredictionCases } from "@/domain/eval/mega-pipeline/prediction-cases";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

export const dynamic = "force-dynamic";

/** Settled prediction cases — disk first, Neon mirror for Vercel. */
export async function GET() {
  const root = permanentRoot044();
  let cases = loadPredictionCases(root).filter((c) =>
    ["WON", "LOST", "VOID", "PUSH", "CANCELLED"].includes(c.status),
  );
  let source: "disk" | "neon" | "empty" = cases.length ? "disk" : "empty";

  if (!cases.length) {
    try {
      const neonCases = await listConclusiFromNeon(150);
      cases = neonCases.map((r) => ({
        prediction_id: String(r.prediction_id),
        event_id: String(r.event_id),
        market: String(r.market),
        selection: String(r.selection),
        prediction_probability:
          r.prediction_probability != null ? Number(r.prediction_probability) : null,
        odds_at_prediction: r.odds_at_prediction != null ? Number(r.odds_at_prediction) : null,
        model_version: r.model_version != null ? String(r.model_version) : null,
        prediction_timestamp: String(r.prediction_timestamp),
        as_of: r.as_of != null ? String(r.as_of) : null,
        status: String(r.status) as
          | "WON"
          | "LOST"
          | "VOID"
          | "PUSH"
          | "CANCELLED"
          | "OPEN"
          | "LIVE",
        result: r.result != null ? String(r.result) : null,
        settled_at: r.settled_at != null ? String(r.settled_at) : null,
        pnl_simulated: r.pnl_simulated != null ? Number(r.pnl_simulated) : null,
        data_quality: r.data_quality != null ? Number(r.data_quality) : null,
      }));
      if (cases.length) source = "neon";
    } catch {
      /* optional */
    }
  }

  let labels = new Map<string, string>();
  try {
    const store = loadStore044(root);
    for (const e of store.events) {
      labels.set(e.event_id, `${e.home_or_a} vs ${e.away_or_b}`);
    }
  } catch {
    labels = new Map();
  }

  let live: Array<Record<string, unknown>> = [];
  try {
    live = await listLiveStatesFromNeon();
  } catch {
    live = [];
  }

  const rows = cases.map((c) => ({
    ...c,
    label: labels.get(c.event_id) ?? c.event_id,
  }));

  return NextResponse.json({
    ok: true,
    source,
    total: rows.length,
    cases: rows,
    live_states: live.slice(0, 50),
    note:
      rows.length === 0
        ? "Nessun caso concluso ancora. I settlement reali popolano questa lista — niente mock."
        : undefined,
  });
}
