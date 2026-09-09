import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { Store044 } from "@/domain/eval/permanent-044/store";
import type { PermanentEvent044, PermanentPrediction044 } from "@/domain/eval/permanent-044/types";
import { TIMELINE_WINDOWS_044 } from "@/domain/eval/permanent-044/timeline";
import { top20Next3Days044 } from "@/domain/eval/permanent-044/top20";
import { whyThisPrediction044 } from "@/domain/eval/permanent-044/why-prediction";

export type PipelinePhase046 = {
  phase: string;
  completed: number;
  pending: number;
  last_at: string | null;
  error: string | null;
};

export type FeedItem046 = {
  at: string;
  kind: string;
  summary: string;
  event_id?: string;
};

export type EventRow046 = {
  event_id: string;
  kickoff_utc: string | null;
  sport: string;
  competition: string;
  label: string;
  origin: string;
  minutes_to_kickoff: number | null;
  minutes_to_t1h: number | null;
  near_t1h: boolean;
  status: string;
  markets: string[];
  prediction_status: string;
  lock_status: string;
  settlement_status: string;
  selection: string | null;
  confidence: number | null;
};

function readJsonlTail(file: string, n: number): Record<string, unknown>[] {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const slice = lines.slice(-n);
  const out: Record<string, unknown>[] = [];
  for (const l of slice) {
    try {
      out.push(JSON.parse(l) as Record<string, unknown>);
    } catch {
      /* skip */
    }
  }
  return out;
}

function latestPred(store: Store044, eventId: string): PermanentPrediction044 | null {
  const preds = store.predictions.filter((p) => p.event_id === eventId);
  if (!preds.length) return null;
  return preds.sort((a, b) => b.prediction_seq - a.prediction_seq)[0]!;
}

export function eventLifecycleStatus046(
  store: Store044,
  ev: PermanentEvent044,
  nowMs: number,
): string {
  if (store.autopsies.some((a) => a.event_id === ev.event_id)) return "AUTOPSIED";
  if (store.settlements.some((s) => s.event_id === ev.event_id && s.outcome !== "UNSETTLED")) return "SETTLED";
  const kick = ev.kickoff_utc ? parseExactUtcMs(ev.kickoff_utc) : null;
  if (kick != null && nowMs >= kick) {
    if (store.lockEventIds.has(ev.event_id)) return "AWAITING_SETTLEMENT";
    return "LIVE/IN_PROGRESS";
  }
  if (store.lockEventIds.has(ev.event_id)) return "LOCKED";
  if (kick != null) {
    const cut = t1hCutoffMs039(ev.kickoff_utc!);
    if (cut != null && nowMs >= cut - 30 * 60_000 && nowMs < cut) return "LOCK_PENDING";
  }
  if (store.predictions.some((p) => p.event_id === ev.event_id)) return "ANALYZED";
  if (store.quotes.some((q) => q.event_id === ev.event_id)) return "MONITORING";
  return "DISCOVERED";
}

export function buildPipeline046(store: Store044, nowMs: number): PipelinePhase046[] {
  const total = store.events.length;
  const withQuotes = new Set(store.quotes.map((q) => q.event_id)).size;
  const analyzed = new Set(store.predictions.map((p) => p.event_id)).size;
  const locked = store.locks.length;
  const pastKick = store.events.filter((e) => {
    const k = e.kickoff_utc ? parseExactUtcMs(e.kickoff_utc) : null;
    return k != null && k <= nowMs;
  }).length;
  const settled = store.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  const autopsied = store.autopsies.length;
  const learning = store.learning.length;

  const journal = readJsonlTail(join(store.root, "journal.jsonl"), 50);
  const lastOf = (kind: string) => {
    const hit = [...journal].reverse().find((j) => j.kind === kind);
    return typeof hit?.at === "string" ? hit.at : null;
  };

  return [
    { phase: "DISCOVER", completed: total, pending: 0, last_at: lastOf("discover_045"), error: null },
    {
      phase: "COLLECT MARKETS",
      completed: withQuotes,
      pending: Math.max(0, total - withQuotes),
      last_at: lastOf("discover_045"),
      error: null,
    },
    {
      phase: "ANALYZE",
      completed: analyzed,
      pending: Math.max(0, total - analyzed),
      last_at: lastOf("analyze_all_045"),
      error: null,
    },
    {
      phase: "MONITOR",
      completed: analyzed,
      pending: Math.max(0, total - locked),
      last_at: lastOf("cycle_complete"),
      error: null,
    },
    {
      phase: "T−1H LOCK",
      completed: locked,
      pending: Math.max(0, analyzed - locked),
      last_at: null,
      error: null,
    },
    { phase: "EVENT", completed: pastKick, pending: Math.max(0, total - pastKick), last_at: null, error: null },
    {
      phase: "SETTLE",
      completed: settled,
      pending: Math.max(0, pastKick - settled),
      last_at: lastOf("settle_045"),
      error: null,
    },
    {
      phase: "AUTOPSY",
      completed: autopsied,
      pending: Math.max(0, settled - autopsied),
      last_at: null,
      error: null,
    },
    {
      phase: "LEARN",
      completed: learning,
      pending: 0,
      last_at: null,
      error: null,
    },
  ];
}

export function buildFeed046(store: Store044, limit = 40): FeedItem046[] {
  const items: FeedItem046[] = [];
  for (const j of readJsonlTail(join(store.root, "journal.jsonl"), 80)) {
    const at = typeof j.at === "string" ? j.at : "";
    const kind = typeof j.kind === "string" ? j.kind : "JOURNAL";
    items.push({
      at,
      kind,
      summary: JSON.stringify(j).slice(0, 180),
    });
  }
  for (const e of store.events.slice(-30)) {
    items.push({
      at: e.first_seen_at ?? e.collected_at_utc,
      kind: "EVENT",
      summary: `${e.home_or_a} — ${e.away_or_b} · ${e.origin ?? "UNKNOWN"} · DISCOVERED`,
      event_id: e.event_id,
    });
  }
  for (const p of store.predictions.slice(-30)) {
    const ev = store.events.find((e) => e.event_id === p.event_id);
    items.push({
      at: p.timestamp,
      kind: "ANALYZED",
      summary: `${ev ? `${ev.home_or_a} — ${ev.away_or_b}` : p.event_id} · pred v${p.prediction_seq} · ${p.recommended ? "CANDIDATE" : "NO_BET"}`,
      event_id: p.event_id,
    });
  }
  for (const l of store.locks.slice(-20)) {
    const ev = store.events.find((e) => e.event_id === l.event_id);
    items.push({
      at: l.lock_timestamp,
      kind: "LOCKED",
      summary: `${ev ? `${ev.home_or_a} — ${ev.away_or_b}` : l.event_id} · LOCK T−1h`,
      event_id: l.event_id,
    });
  }
  for (const s of store.settlements.slice(-20)) {
    items.push({
      at: s.settled_at,
      kind: "SETTLED",
      summary: `${s.event_id} · ${s.result}`,
      event_id: s.event_id,
    });
  }
  for (const a of store.autopsies.slice(-20)) {
    items.push({
      at: a.created_at,
      kind: "AUTOPSY",
      summary: `${a.event_id} · ${a.result_class} · ${a.error_type ?? "—"}`,
      event_id: a.event_id,
    });
  }
  return items
    .filter((i) => i.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}

export function buildNextEvents046(store: Store044, nowMs: number, limit = 40): EventRow046[] {
  // Lab B may contain accidental duplicate event_id lines (same fingerprint written
  // by concurrent appenders). event_id remains canonical — keep last occurrence only
  // for this dashboard row (does not rewrite events.jsonl).
  const byId = new Map<string, PermanentEvent044>();
  for (const ev of store.events) {
    byId.set(ev.event_id, ev);
  }
  const rows: EventRow046[] = [];
  for (const ev of byId.values()) {
    const kick = ev.kickoff_utc ? parseExactUtcMs(ev.kickoff_utc) : null;
    if (kick == null) continue;
    const mins = (kick - nowMs) / 60_000;
    const cut = ev.kickoff_utc ? t1hCutoffMs039(ev.kickoff_utc) : null;
    const minsT1h = cut != null ? (cut - nowMs) / 60_000 : null;
    const markets = [...new Set(store.quotes.filter((q) => q.event_id === ev.event_id).map((q) => q.market))];
    const pred = latestPred(store, ev.event_id);
    const locked = store.lockEventIds.has(ev.event_id);
    const settled = store.settlements.find((s) => s.event_id === ev.event_id);
    rows.push({
      event_id: ev.event_id,
      kickoff_utc: ev.kickoff_utc,
      sport: ev.sport,
      competition: ev.competition,
      label: `${ev.home_or_a} — ${ev.away_or_b}`,
      origin: ev.origin ?? "UNKNOWN",
      minutes_to_kickoff: mins,
      minutes_to_t1h: minsT1h,
      near_t1h: minsT1h != null && minsT1h >= 0 && minsT1h <= 180,
      status: eventLifecycleStatus046(store, ev, nowMs),
      markets,
      prediction_status: pred ? (pred.recommended ? "CANDIDATE" : "NO_BET") : "NO_ANALYSIS_YET",
      lock_status: locked ? "LOCKED" : "OPEN",
      settlement_status: settled ? settled.outcome : "UNSETTLED",
      selection: pred?.selection ?? null,
      confidence: pred?.confidence_score ?? null,
    });
  }
  return rows.sort((a, b) => Date.parse(a.kickoff_utc!) - Date.parse(b.kickoff_utc!)).slice(0, limit);
}

export function snapshotWindowsForEvent046(
  store: Store044,
  eventId: string,
): { window: string; status: "OBSERVED" | "NOT_OBSERVED" | "LOCKED" | "NOT_AVAILABLE"; missing_reason: string | null }[] {
  const snapPath = join(store.root, "snapshots.jsonl");
  const snaps = readJsonlTail(snapPath, 200_000).filter((s) => s.event_id === eventId);
  const byWin = new Map<string, Record<string, unknown>>();
  for (const s of snaps) {
    const w = String(s.window ?? "");
    if (!w) continue;
    const prev = byWin.get(w);
    if (!prev || String(s.status) === "OBSERVED") byWin.set(w, s);
  }
  const locked = store.lockEventIds.has(eventId);
  return TIMELINE_WINDOWS_044.map((window) => {
    const s = byWin.get(window);
    if (window === "T-1h" && locked && s?.status === "OBSERVED") {
      return { window, status: "LOCKED" as const, missing_reason: null };
    }
    if (!s) return { window, status: "NOT_OBSERVED" as const, missing_reason: "NO SNAPSHOT" };
    if (s.status === "OBSERVED") return { window, status: "OBSERVED" as const, missing_reason: null };
    return {
      window,
      status: "NOT_AVAILABLE" as const,
      missing_reason: typeof s.missing_reason === "string" ? s.missing_reason : "NO SNAPSHOT",
    };
  });
}

export function buildRanking046(store: Store044) {
  const top20 = top20Next3Days044(store);
  const analyzed = new Set(store.predictions.map((p) => p.event_id)).size;
  const noBet = store.predictions.filter((p) => !p.recommended).length;
  const candidates = store.predictions.filter((p) => p.recommended).length;
  return {
    analyzed_events: analyzed,
    candidates,
    strong_candidates: 0,
    no_bet_records: noBet,
    note: "NO_BET ≠ NO_ANALYSIS. Ranking is observational — not bets.",
    top20,
  };
}

export function buildIntelligence046(store: Store044) {
  const settled = store.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  const correct = store.autopsies.filter((a) => a.result_class === "CORRECT").length;
  const incorrect = store.autopsies.filter((a) => a.result_class === "INCORRECT").length;
  const patternsPath = join(store.root, "error-patterns.jsonl");
  const patterns = existsSync(patternsPath)
    ? readFileSync(patternsPath, "utf8").split(/\n/).filter(Boolean).length
    : 0;
  return {
    settled,
    correct,
    incorrect,
    autopsied: store.autopsies.length,
    learning_cases: store.learning.length,
    error_patterns: patterns,
    recent_autopsies: store.autopsies.slice(-15).reverse(),
  };
}

export function buildEventDetail046(store: Store044, id: string) {
  const ev = store.events.find((e) => e.event_id === id || e.canonical_event_id === id);
  if (!ev) return null;
  const preds = store.predictions
    .filter((p) => p.event_id === ev.event_id)
    .sort((a, b) => a.prediction_seq - b.prediction_seq);
  const latest = preds.at(-1) ?? null;
  const lock = store.locks.find((l) => l.event_id === ev.event_id) ?? null;
  const settlement = store.settlements.find((s) => s.event_id === ev.event_id) ?? null;
  const autopsies = store.autopsies.filter((a) => a.event_id === ev.event_id);
  const quotes = store.quotes.filter((q) => q.event_id === ev.event_id);
  const markets = [...new Set(quotes.map((q) => q.market))];
  const why = latest ? whyThisPrediction044(latest) : null;
  const windows = snapshotWindowsForEvent046(store, ev.event_id);
  const updatesPath = join(store.root, "updates.jsonl");
  const postLock = readJsonlTail(updatesPath, 5000).filter(
    (u) =>
      u.event_id === ev.event_id &&
      (u.kind === "POST_LOCK_OBSERVATION" ||
        u.kind === "POST_LOCK_UPDATE_SUMMARY" ||
        u.kind === "POST_LOCK_SNAPSHOT"),
  );
  return {
    event: ev,
    markets,
    quote_count: quotes.length,
    predictions: preds,
    locked_prediction: lock
      ? preds.find((p) => !p.reason_codes.includes("PRE_KICKOFF_UPDATED_VIEW")) ?? preds[0] ?? null
      : null,
    pre_kickoff_updated_view: preds.filter((p) => p.reason_codes.includes("PRE_KICKOFF_UPDATED_VIEW")),
    lock,
    settlement,
    autopsies,
    windows,
    why,
    why_available: Boolean(why),
    structured_explanation: why
      ? {
          WHY_SELECTED: why.MAIN_REASONS,
          WHY_NOT_SELECTED: why.NEGATIVE_FACTORS,
          FINAL: why.final_motivation,
        }
      : { message: "NO STRUCTURED EXPLANATION AVAILABLE" },
    post_lock_changes: postLock,
    model_version: latest?.model_version ?? null,
  };
}
