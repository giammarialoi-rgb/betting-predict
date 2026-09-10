/**
 * Full event calendar from events.jsonl — not the 120-row decision board.
 * An event is listed even without a prediction. Independent inference is separate.
 */
import { join } from "node:path";
import { hasIndependentModel } from "@/domain/eval/permanent-044/prediction-precedence";
import { loadResearchQueue } from "@/domain/eval/data-intelligence/research/queue";
import {
  readJsonlAllSmall,
  readJsonlTail,
  type BoardEventRow,
  type EventBucket,
} from "@/domain/eval/betmind-runtime/board";

export type CalendarBucket =
  | "DISCOVERED"
  | "QUEUED"
  | "RESEARCHING"
  | "RESEARCHED"
  | "ELIGIBLE"
  | "MODEL_INFERENCE"
  | "INSUFFICIENT_DATA"
  | "SKIPPED";

export type CalendarEventRow = BoardEventRow & {
  calendar_day: string;
  calendar_bucket: CalendarBucket;
  research_state: string | null;
};

export function calendarDayKey(iso: string | null | undefined, timeZone = "Europe/Rome"): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function sportNorm(s: string): string {
  const x = s.toUpperCase();
  if (x === "SOCCER" || x === "FOOTBALL" || x === "CALCIO") return "FOOTBALL";
  if (x === "TENNIS") return "TENNIS";
  if (x === "BASKETBALL" || x === "BASKET") return "BASKETBALL";
  if (x === "HOCKEY") return "HOCKEY";
  if (x === "VOLLEYBALL" || x === "VOLLEY") return "VOLLEYBALL";
  return x || "UNKNOWN";
}

export function listCalendarEvents(input: {
  root: string;
  date?: string | null;
  from?: string | null;
  to?: string | null;
  sport?: string | null;
  nowMs?: number;
}): { day: string | null; total: number; events: CalendarEventRow[] } {
  const events = readJsonlAllSmall(join(input.root, "events.jsonl"), 8_000_000);
  const predTail = readJsonlTail(join(input.root, "predictions.jsonl"), 20_000);
  const latestPred = new Map<string, Record<string, unknown>>();
  for (const p of predTail) {
    const r = asRec(p);
    if (!r?.event_id) continue;
    const id = String(r.event_id);
    const prev = latestPred.get(id);
    const ts = String(r.timestamp ?? "");
    if (!prev || ts >= String(prev.timestamp ?? "")) latestPred.set(id, r);
  }
  const queue = loadResearchQueue(input.root);
  const qBy = new Map(queue.items.map((i) => [i.event_id, i]));

  const sportFilter = input.sport && input.sport.toUpperCase() !== "ALL" ? sportNorm(input.sport) : null;
  const from = input.from ?? input.date ?? null;
  const to = input.to ?? input.date ?? null;

  const rows: CalendarEventRow[] = [];
  for (const e of events) {
    const r = asRec(e);
    if (!r?.event_id) continue;
    const kickoff = (r.kickoff_utc as string | null) ?? null;
    const day = calendarDayKey(kickoff);
    if (from && day && day < from) continue;
    if (to && day && day > to) continue;
    if (from && !day) continue;
    const sport = sportNorm(String(r.sport ?? "UNKNOWN"));
    if (sportFilter && sport !== sportFilter) continue;

    const id = String(r.event_id);
    const pred = latestPred.get(id);
    const independent = pred
      ? hasIndependentModel({
          probability_model: pred.probability_model as Record<string, number> | null,
          model_version: String(pred.model_version ?? ""),
          reason_codes: (pred.reason_codes as string[]) ?? [],
        })
      : false;
    const q = qBy.get(id);
    let calendar_bucket: CalendarBucket = "DISCOVERED";
    if (independent) calendar_bucket = "MODEL_INFERENCE";
    else if (pred && pred.probability_model == null) calendar_bucket = "INSUFFICIENT_DATA";
    else if (q?.state === "RESEARCHING") calendar_bucket = "RESEARCHING";
    else if (q?.state === "RESEARCHED" || q?.state === "FEATURED") calendar_bucket = "RESEARCHED";
    else if (q?.state === "QUEUED") calendar_bucket = "QUEUED";

    const home = (r.home_or_a as string | null) ?? null;
    const away = (r.away_or_b as string | null) ?? null;
    const modelP =
      independent && pred?.probability_model && typeof pred.probability_model === "object"
        ? (pred.probability_model as Record<string, number>)
        : null;

    rows.push({
      event_id: id,
      kickoff_utc: kickoff,
      sport,
      competition: String(r.competition ?? "N/A"),
      label: home && away ? `${home} vs ${away}` : String(id),
      minutes_to_kickoff: null,
      near_t1h: false,
      status: String(r.status ?? "SCHEDULED"),
      markets: [],
      prediction_status: independent ? "INDEPENDENT_MODEL" : calendar_bucket,
      lock_status: "N/A",
      selection: null,
      confidence: null,
      model_pct: modelP?.HOME != null ? modelP.HOME * 100 : null,
      market_pct: null,
      edge: null,
      ev: null,
      odds: null,
      decision: independent ? "MODEL_INFERENCE" : calendar_bucket,
      stake: 0,
      why: independent ? "INDEPENDENT_POISSON" : calendar_bucket,
      fair_odds: null,
      model_version: pred ? String(pred.model_version ?? "") : null,
      result: null,
      pnl: null,
      model_ne_market: false,
      edge_status: "UNKNOWN",
      feature_coverage: typeof pred?.feature_coverage === "number" ? (pred.feature_coverage as number) : null,
      analyzed_at: pred ? String(pred.timestamp ?? "") : null,
      probability_model: modelP,
      home_or_a: home,
      away_or_b: away,
      bucket: (independent ? "ANALYZED" : "DISCOVERED") as EventBucket,
      calendar_day: day ?? "",
      calendar_bucket,
      research_state: q?.state ?? null,
    });
  }

  rows.sort((a, b) => String(a.kickoff_utc ?? "").localeCompare(String(b.kickoff_utc ?? "")));
  return { day: input.date ?? from, total: rows.length, events: rows };
}

export function shiftCalendarDay(yyyyMmDd: string, deltaDays: number, timeZone = "Europe/Rome"): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const utc = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return calendarDayKey(new Date(utc + deltaDays * 86400000).toISOString(), timeZone) ?? yyyyMmDd;
}

export function todayCalendarDay(nowIso?: string, timeZone = "Europe/Rome"): string {
  return calendarDayKey(nowIso ?? new Date().toISOString(), timeZone) ?? "1970-01-01";
}
