import type { PermanentEvent044, PermanentPrediction044 } from "@/domain/eval/permanent-044/types";
import type { Store044 } from "@/domain/eval/permanent-044/store";

export type Top20Row044 = {
  rank: number;
  event_id: string;
  sport: string;
  market: string;
  prediction: string | null;
  probability: number | null;
  market_probability: number | null;
  edge: number | null;
  confidence: number;
  reliability: number;
  data_quality: number;
  time_to_event_hours: number | null;
  main_reason: string;
  main_risk: string;
  status: string;
};

export function top20Next3Days044(store: Store044, nowIso = new Date().toISOString()): Top20Row044[] {
  const now = Date.parse(nowIso);
  const horizon = now + 3 * 24 * 3600 * 1000;
  const latest = new Map<string, PermanentPrediction044>();
  for (const p of store.predictions) {
    const prev = latest.get(p.event_id);
    if (!prev || p.prediction_seq >= prev.prediction_seq) latest.set(p.event_id, p);
  }
  const rows: Top20Row044[] = [];
  for (const [eventId, p] of latest) {
    const ev = store.events.find((e) => e.event_id === eventId) as PermanentEvent044 | undefined;
    if (!ev?.kickoff_utc) continue;
    const k = Date.parse(ev.kickoff_utc);
    if (!Number.isFinite(k) || k < now || k > horizon) continue;
    const sel = p.selection;
    rows.push({
      rank: 0,
      event_id: eventId,
      sport: ev.sport,
      market: p.market,
      prediction: sel,
      probability: sel && p.probability_model ? p.probability_model[sel] ?? null : null,
      market_probability: sel && p.probability_market ? p.probability_market[sel] ?? null : null,
      edge: p.edge_absolute,
      confidence: p.confidence_score,
      reliability: p.data_quality_score,
      data_quality: p.data_quality_score,
      time_to_event_hours: (k - now) / 3600_000,
      main_reason: p.reason_codes[0] ?? "NO_BET",
      main_risk: p.risk_flags[0] ?? "RESEARCH_ONLY",
      status: p.recommended ? "CANDIDATE" : "NO_BET",
    });
  }
  rows.sort((a, b) => b.confidence - a.confidence || (a.time_to_event_hours ?? 99) - (b.time_to_event_hours ?? 99));
  return rows.slice(0, 20).map((r, i) => ({ ...r, rank: i + 1 }));
}
