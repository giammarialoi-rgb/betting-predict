/**
 * Decision-board lite rows from Lab B JSONL.
 * Odds/market fields are compare-only — never fed into independent MODEL.
 */
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { expectedValue056, fairOdds056, mirrorsMarket056 } from "@/domain/eval/audit-056/math";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { indexLatestCompleteBook1x2 } from "@/domain/eval/betmind-runtime/compare-odds";
import {
  loadCachedMarketCandidates,
  quoteSlotFromBook,
  resolveCompareBook,
} from "@/domain/eval/betmind-runtime/market-attach";

function readJsonIfExists(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function readJsonlTail(path: string, limit: number): unknown[] {
  if (!existsSync(path)) return [];
  const size = statSync(path).size;
  const maxBytes = Math.min(size, Math.max(256_000, limit * 4_000));
  const fd = openSync(path, "r");
  try {
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    let text = buf.toString("utf8");
    if (start > 0) {
      const nl = text.indexOf("\n");
      if (nl >= 0) text = text.slice(nl + 1);
    }
    const lines = text.split(/\n/).filter(Boolean);
    const slice = lines.slice(Math.max(0, lines.length - limit));
    const out: unknown[] = [];
    for (const line of slice) {
      try {
        out.push(JSON.parse(line.replace(/^\uFEFF/, "")));
      } catch {
        /* skip */
      }
    }
    return out.reverse();
  } finally {
    closeSync(fd);
  }
}

export function readJsonlAllSmall(path: string, maxBytes = 2_000_000): unknown[] {
  if (!existsSync(path)) return [];
  const size = statSync(path).size;
  if (size > maxBytes) return readJsonlTail(path, 2000);
  return readFileSync(path, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l.replace(/^\uFEFF/, ""));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as unknown[];
}

/** Gate MODEL_EDGE unknown from final-verdict — never force true unconditionally. */
export function isModelEdgeUnknown(root: string): boolean {
  const v = readJsonIfExists(join(root, "predictive-intelligence", "final-verdict.json"));
  if (!v) return true;
  const gate = asRec(v.promotion_gate);
  if (gate?.model_edge === "UNKNOWN") return true;
  const blockers = (v.blockers as string[] | undefined) ?? [];
  return (
    blockers.includes("INDEPENDENT_DOES_NOT_BEAT_BENCHMARKS") ||
    blockers.includes("MODEL_EDGE_UNKNOWN")
  );
}

export type BoardEventRow = Record<string, unknown>;

export type EventBucket =
  | "DISCOVERED"
  | "ELIGIBLE_FOR_MODEL"
  | "ANALYZED"
  | "SKIPPED"
  | "UNAVAILABLE";

export function classifyBoardEvent(row: BoardEventRow): EventBucket {
  const decision = String(row.decision ?? row.prediction_status ?? "");
  const modelPct = row.model_pct;
  if (/INSUFFICIENT|UNAVAILABLE|TEMPORAL/i.test(decision) || row.why_skip) {
    if (/INSUFFICIENT|UNAVAILABLE/i.test(decision)) return "UNAVAILABLE";
    return "SKIPPED";
  }
  if (modelPct != null && Number.isFinite(Number(modelPct))) return "ANALYZED";
  if (/NO_BET|SKIP|HOLD/i.test(decision)) return "SKIPPED";
  if (row.event_id) return "DISCOVERED";
  return "UNAVAILABLE";
}

/** Lite next_events from decisions + events. Quote slot is compare-only (quotes.jsonl / free cache). */
export function buildLiteNextEvents(
  root: string,
  nowMs: number,
  limit = 120,
  cwd = process.cwd(),
): BoardEventRow[] {
  const edgeUnknown = isModelEdgeUnknown(root);

  const events = readJsonlAllSmall(join(root, "events.jsonl"), 2_000_000);
  const byId = new Map<string, Record<string, unknown>>();
  for (const e of events) {
    const r = asRec(e);
    if (r?.event_id) byId.set(String(r.event_id), r);
  }

  const decisions = readJsonlTail(join(root, "decisions.jsonl"), 400);
  const latest = new Map<string, Record<string, unknown>>();
  for (const d of decisions) {
    const r = asRec(d);
    if (!r?.event_id) continue;
    const id = String(r.event_id);
    if (!latest.has(id)) latest.set(id, r);
  }

  const quoteTail = readJsonlTail(join(root, "quotes.jsonl"), 30_000);
  const bookByEvent = indexLatestCompleteBook1x2(quoteTail as Array<Record<string, unknown>>);
  const marketCandidates = loadCachedMarketCandidates(cwd);

  const predTail = readJsonlTail(join(root, "predictions.jsonl"), 800);
  const latestPred = new Map<string, Record<string, unknown>>();
  for (const p of predTail) {
    const r = asRec(p);
    if (!r?.event_id) continue;
    const id = String(r.event_id);
    const hasModel = r.probability_model && typeof r.probability_model === "object";
    const prev = latestPred.get(id);
    if (!prev) {
      latestPred.set(id, r);
      continue;
    }
    const ts = String(r.timestamp ?? "");
    const prevTs = String(prev.timestamp ?? "");
    if (ts > prevTs || (ts === prevTs && hasModel && !prev.probability_model)) {
      latestPred.set(id, r);
    }
  }

  const rows: BoardEventRow[] = [];
  for (const [event_id, d] of latest) {
    const ev = byId.get(event_id);
    const kickoff = (ev?.kickoff_utc as string | null) ?? null;
    const kickMs = kickoff ? parseExactUtcMs(kickoff) : null;
    const minutes =
      kickMs != null && Number.isFinite(kickMs) ? Math.round((kickMs - nowMs) / 60000) : null;
    const modelPct =
      typeof d.probability === "number" && Number.isFinite(d.probability)
        ? d.probability <= 1
          ? (d.probability as number) * 100
          : (d.probability as number)
        : typeof d.fair_probability === "number" && Number.isFinite(d.fair_probability)
          ? d.fair_probability <= 1
            ? (d.fair_probability as number) * 100
            : (d.fair_probability as number)
          : null;
    const marketPct =
      typeof d.market_probability === "number" && Number.isFinite(d.market_probability)
        ? d.market_probability <= 1
          ? (d.market_probability as number) * 100
          : (d.market_probability as number)
        : null;
    const edge =
      typeof d.estimated_edge === "number"
        ? (d.estimated_edge as number)
        : modelPct != null && marketPct != null
          ? (modelPct - marketPct) / 100
          : null;
    const modelP =
      typeof d.probability === "number"
        ? (d.probability as number)
        : typeof d.fair_probability === "number"
          ? (d.fair_probability as number)
          : null;
    const marketP = typeof d.market_probability === "number" ? (d.market_probability as number) : null;
    const resolved = resolveCompareBook({
      quotesBook: bookByEvent.get(event_id) ?? null,
      home: ev?.home_or_a != null ? String(ev.home_or_a) : null,
      away: ev?.away_or_b != null ? String(ev.away_or_b) : null,
      kickoff_utc: kickoff,
      candidates: marketCandidates,
    });
    const slot = quoteSlotFromBook(resolved?.book ?? null, resolved?.source ?? null);
    const selection = String(d.prediction ?? d.selection ?? "").toUpperCase();
    const bookLeg =
      resolved?.book == null
        ? null
        : selection === "HOME" || selection === "H" || selection === "1"
          ? resolved.book.odds_home
          : selection === "DRAW" || selection === "D" || selection === "X"
            ? resolved.book.odds_draw
            : selection === "AWAY" || selection === "A" || selection === "2"
              ? resolved.book.odds_away
              : null;
    const odds =
      typeof d.odds === "number" && d.odds > 1 ? (d.odds as number) : bookLeg != null && bookLeg > 1 ? bookLeg : null;
    const evNum = modelP != null && odds != null ? expectedValue056(modelP, odds) : null;
    const decision = String(d.decision ?? "N/A");
    const why = String(
      asRec(d.explanation)?.WHY_PRIMARY ??
        (Array.isArray(d.decision_reason_codes) ? d.decision_reason_codes[0] : null) ??
        "N/A",
    );
    const featureCoverage =
      typeof d.feature_coverage === "number"
        ? d.feature_coverage
        : typeof asRec(d.features)?.coverage === "number"
          ? (asRec(d.features)?.coverage as number)
          : null;

    const row: BoardEventRow = {
      event_id,
      kickoff_utc: kickoff,
      sport: String(ev?.sport ?? d.sport ?? "UNKNOWN"),
      competition: String(ev?.competition ?? d.competition ?? "N/A"),
      label:
        ev?.home_or_a && ev?.away_or_b
          ? `${ev.home_or_a} vs ${ev.away_or_b}`
          : String(d.label ?? event_id),
      minutes_to_kickoff: minutes,
      near_t1h: minutes != null && minutes >= 0 && minutes <= 180,
      status: String(d.status ?? decision),
      markets: [...new Set([...(d.market ? [String(d.market)] : []), ...(resolved?.book ? ["1X2"] : [])])],
      prediction_status: decision,
      lock_status: "N/A",
      selection: (d.prediction as string | null) ?? (d.selection as string | null) ?? null,
      confidence: typeof d.confidence === "number" ? d.confidence : modelPct != null ? modelPct / 100 : null,
      model_pct: modelPct,
      market_pct: marketPct,
      edge,
      ev: evNum,
      odds,
      odds_home: slot.odds_home,
      odds_draw: slot.odds_draw,
      odds_away: slot.odds_away,
      bookmaker: slot.bookmaker,
      odds_market: slot.odds_market,
      odds_collected_at: slot.odds_collected_at,
      odds_compare_only: slot.odds_compare_only,
      odds_source: slot.odds_source,
      odds_status: slot.odds_status,
      decision,
      stake: typeof d.stake === "number" ? d.stake : 0,
      why,
      fair_odds: modelP != null ? fairOdds056(modelP) : null,
      model_version: (d.model_version as string | null) ?? null,
      result: (d.result as string | null) ?? null,
      pnl: typeof d.pnl === "number" ? d.pnl : null,
      model_ne_market:
        modelP != null && marketP != null ? !mirrorsMarket056(modelP, marketP) : false,
      edge_status: edgeUnknown ? "UNKNOWN" : edge == null ? "UNKNOWN" : "KNOWN",
      feature_coverage: featureCoverage,
      analyzed_at: (d.timestamp as string | null) ?? (d.analyzed_at as string | null) ?? null,
      probability_model:
        latestPred.get(event_id)?.probability_model &&
        typeof latestPred.get(event_id)?.probability_model === "object"
          ? latestPred.get(event_id)?.probability_model
          : null,
      home_or_a: ev?.home_or_a ?? null,
      away_or_b: ev?.away_or_b ?? null,
      bucket: null as EventBucket | null,
    };
    row.bucket = classifyBoardEvent(row);
    rows.push(row);
    if (rows.length >= limit) break;
  }

  if (rows.length === 0) {
    for (const e of events.slice(-limit).reverse()) {
      const r = asRec(e);
      if (!r?.event_id) continue;
      const resolved = resolveCompareBook({
        quotesBook: bookByEvent.get(String(r.event_id)) ?? null,
        home: r.home_or_a != null ? String(r.home_or_a) : null,
        away: r.away_or_b != null ? String(r.away_or_b) : null,
        kickoff_utc: (r.kickoff_utc as string | null) ?? null,
        candidates: marketCandidates,
      });
      const slot = quoteSlotFromBook(resolved?.book ?? null, resolved?.source ?? null);
      const row: BoardEventRow = {
        event_id: String(r.event_id),
        kickoff_utc: (r.kickoff_utc as string | null) ?? null,
        sport: String(r.sport ?? "UNKNOWN"),
        competition: String(r.competition ?? "N/A"),
        label:
          r.home_or_a && r.away_or_b
            ? `${r.home_or_a} vs ${r.away_or_b}`
            : String(r.event_id),
        minutes_to_kickoff: null,
        near_t1h: false,
        status: String(r.status ?? "SCHEDULED"),
        markets: resolved?.book ? ["1X2"] : [],
        prediction_status: "INSUFFICIENT_DATA",
        lock_status: "N/A",
        selection: null,
        confidence: null,
        model_pct: null,
        market_pct: null,
        edge: null,
        ev: null,
        odds: null,
        odds_home: slot.odds_home,
        odds_draw: slot.odds_draw,
        odds_away: slot.odds_away,
        bookmaker: slot.bookmaker,
        odds_market: slot.odds_market,
        odds_collected_at: slot.odds_collected_at,
        odds_compare_only: slot.odds_compare_only,
        odds_source: slot.odds_source,
        odds_status: slot.odds_status,
        decision: "NO_BET",
        stake: 0,
        why: "INSUFFICIENT_DATA — no decision row yet",
        fair_odds: null,
        model_version: null,
        result: null,
        pnl: null,
        model_ne_market: false,
        edge_status: "UNKNOWN",
        feature_coverage: null,
        analyzed_at: null,
        bucket: "DISCOVERED" as EventBucket,
      };
      rows.push(row);
    }
  }

  return rows;
}

export function summarizeBoardBuckets(rows: BoardEventRow[]) {
  const counts = {
    DISCOVERED: 0,
    ELIGIBLE_FOR_MODEL: 0,
    ANALYZED: 0,
    SKIPPED: 0,
    UNAVAILABLE: 0,
  };
  for (const r of rows) {
    const b = (r.bucket as EventBucket) ?? classifyBoardEvent(r);
    counts[b] = (counts[b] ?? 0) + 1;
  }
  return counts;
}
