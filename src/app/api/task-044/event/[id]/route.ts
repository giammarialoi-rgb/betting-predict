import { NextResponse } from "next/server";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { whyThisPrediction044 } from "@/domain/eval/permanent-044/why-prediction";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const root = permanentRoot044();
  const store = loadStore044(root);
  const ev = store.events.find((e) => e.event_id === id || e.canonical_event_id === id);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const preds = store.predictions.filter((p) => p.event_id === ev.event_id).sort((a, b) => a.prediction_seq - b.prediction_seq);
  const lock = store.locks.find((l) => l.event_id === ev.event_id) ?? null;
  const settlement = store.settlements.find((s) => s.event_id === ev.event_id) ?? null;
  const autopsy = store.autopsies.filter((a) => a.event_id === ev.event_id);
  const snapPath = join(root, "snapshots.jsonl");
  const snapshots = existsSync(snapPath)
    ? readFileSync(snapPath, "utf8")
        .split(/\n/)
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { event_id: string })
        .filter((s) => s.event_id === ev.event_id)
    : [];
  const latest = preds.at(-1) ?? null;
  return NextResponse.json({
    event: ev,
    predictions: preds,
    locked_prediction: lock ? preds.find((p) => p.prediction_id && lock.prediction_hash) ?? preds[0] ?? null : null,
    lock,
    settlement,
    autopsies: autopsy,
    snapshots,
    why: latest ? whyThisPrediction044(latest) : null,
    lab_a_decision_id: lock?.lab_a_decision_id ?? null,
  });
}
