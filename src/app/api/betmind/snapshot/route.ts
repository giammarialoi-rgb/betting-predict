import { NextResponse } from "next/server";
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { buildHealthPayload053, loadCurrentWork053 } from "@/domain/eval/bankroll-053/system";
import { loadChallengerRegistry053 } from "@/domain/eval/bankroll-053/challenger";
import { loadSourceHealth053 } from "@/domain/eval/bankroll-053/source-health";
import { loadAutostartStatus055 } from "@/domain/eval/catalog-055/autostart";
import { loadCoverage055, loadCurrentActivity055, readActivityFeed055 } from "@/domain/eval/catalog-055/cycle";
import { loadRuntimeStatus } from "@/domain/eval/betmind-runtime/remote-status";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import { expectedValue056, fairOdds056, mirrorsMarket056 } from "@/domain/eval/audit-056/math";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";

export const dynamic = "force-dynamic";

type CacheEntry = { at: number; body: Record<string, unknown> };
let cache: CacheEntry | null = null;
const CACHE_MS = 3500;

function readJsonIfExists(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readJsonlTail(path: string, limit: number): unknown[] {
  if (!existsSync(path)) return [];
  const size = statSync(path).size;
  // Cap read window so huge ledgers (decisions.jsonl ~38MB+) never block the UI thread.
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

function readJsonlAllSmall(path: string, maxBytes = 2_000_000): unknown[] {
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

function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Lite next_events from decisions tail + events index — never loads quotes/markets/snapshots. */
function buildLiteNextEvents(root: string, nowMs: number, limit = 120) {
  const edgeUnknown = (() => {
    const v = readJsonIfExists(join(root, "predictive-intelligence", "final-verdict.json"));
    if (!v) return true;
    const gate = asRec(v.promotion_gate);
    if (gate?.model_edge === "UNKNOWN") return true;
    const blockers = (v.blockers as string[] | undefined) ?? [];
    return (
      blockers.includes("INDEPENDENT_DOES_NOT_BEAT_BENCHMARKS") ||
      blockers.includes("MODEL_EDGE_UNKNOWN") ||
      true
    );
  })();

  const events = readJsonlAllSmall(join(root, "events.jsonl"), 2_000_000);
  const byId = new Map<string, Record<string, unknown>>();
  for (const e of events) {
    const r = asRec(e);
    if (r?.event_id) byId.set(String(r.event_id), r);
  }

  const decisions = readJsonlTail(join(root, "decisions.jsonl"), 400);
  const latest = new Map<string, Record<string, unknown>>();
  // tail is newest-first; keep first seen per event
  for (const d of decisions) {
    const r = asRec(d);
    if (!r?.event_id) continue;
    const id = String(r.event_id);
    if (!latest.has(id)) latest.set(id, r);
  }

  const rows: Record<string, unknown>[] = [];
  for (const [event_id, d] of latest) {
    const ev = byId.get(event_id);
    const kickoff = (ev?.kickoff_utc as string | null) ?? null;
    const kickMs = kickoff ? parseExactUtcMs(kickoff) : null;
    const minutes =
      kickMs != null && Number.isFinite(kickMs) ? Math.round((kickMs - nowMs) / 60000) : null;
    const modelPct =
      typeof d.probability === "number"
        ? (d.probability as number) * 100
        : typeof d.fair_probability === "number"
          ? (d.fair_probability as number) * 100
          : typeof d.confidence === "number"
            ? (d.confidence as number) * 100
            : null;
    const marketPct =
      typeof d.market_probability === "number" ? (d.market_probability as number) * 100 : null;
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
    const odds =
      marketP != null && marketP > 0
        ? Number((1 / marketP).toFixed(3))
        : typeof d.odds === "number"
          ? (d.odds as number)
          : null;
    const evNum =
      modelP != null && odds != null ? expectedValue056(modelP, odds) : null;
    const decision = String(d.decision ?? "N/A");
    const why = String(
      asRec(d.explanation)?.WHY_PRIMARY ??
        (Array.isArray(d.decision_reason_codes) ? d.decision_reason_codes[0] : null) ??
        "N/A",
    );

    rows.push({
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
      markets: d.market ? [String(d.market)] : [],
      prediction_status: decision,
      lock_status: "N/A",
      selection: (d.prediction as string | null) ?? (d.selection as string | null) ?? null,
      confidence: modelPct != null ? modelPct / 100 : null,
      model_pct: modelPct,
      market_pct: marketPct,
      edge,
      ev: evNum,
      odds,
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
    });
    if (rows.length >= limit) break;
  }

  // If no decisions, surface upcoming events only
  if (rows.length === 0) {
    for (const e of events.slice(-limit).reverse()) {
      const r = asRec(e);
      if (!r?.event_id) continue;
      rows.push({
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
        markets: [],
        prediction_status: "INSUFFICIENT_DATA",
        lock_status: "N/A",
        selection: null,
        confidence: null,
        model_pct: null,
        market_pct: null,
        edge: null,
        ev: null,
        odds: null,
        decision: "NO_BET",
        stake: 0,
        why: "INSUFFICIENT_DATA — no decision row yet",
        fair_odds: null,
        model_version: null,
        result: null,
        pnl: null,
        model_ne_market: false,
        edge_status: "UNKNOWN",
      });
    }
  }

  return rows;
}

function buildLiteObservatory(root: string, nowIso: string) {
  const coverage = loadCoverage055(root);
  const activity = loadCurrentActivity055(root) ?? loadCurrentWork053(root);
  const feed = readActivityFeed055(root, 40);
  const health053 = buildHealthPayload053(root);
  const next_events = buildLiteNextEvents(root, Date.parse(nowIso), 120);
  const piVerdict = readJsonIfExists(join(root, "predictive-intelligence", "final-verdict.json"));

  return {
    at: nowIso,
    system: health053.system,
    brain: health053.brain,
    current_work: health053.current_work,
    next_events,
    sport_diagnostics: coverage?.by_sport ?? null,
    coverage_047: coverage,
    multisource_055: {
      title: "UNIVERSAL 24/7 SPORTS INTELLIGENCE BRAIN",
      artificial_cap: false as const,
      coverage,
      current_activity: activity,
      activity_feed: feed,
      paper_bankroll: 1000 as const,
      capital: "PAPER_ONLY" as const,
      real_money: false as const,
      auto_promotion: false as const,
      model_edge: "UNKNOWN" as const,
      api_calls_ui: 0 as const,
    },
    capital: { CAPITAL: "PAPER_1000", REAL_MONEY: false },
    audit_056: {
      AUTOSTART_STATUS: loadAutostartStatus055(root)?.ACTIVE_MECHANISM ?? "N/A",
      model_readiness: piVerdict?.model_is_market_only === false ? "INDEPENDENT_ACTIVE" : "UNKNOWN",
      model_edge: "UNKNOWN" as const,
      decision_board_count: next_events.length,
      canonical_chain: "supervisor→worker→brain→massive049→decision048→bankroll053",
      open_task_057: false as const,
    },
    api_calls_ui: 0 as const,
  };
}

/** Disk-first BetMind snapshot; Neon mirror when Lab B FS absent (Vercel). Zero Odds/API-Sports. */
export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return NextResponse.json({ ...cache.body, cache_hit: true });
  }

  try {
    const root = permanentRoot044();
    const pi = piRoot(root);
    const nowIso = new Date().toISOString();
    const storePresent =
      existsSync(join(root, "events.jsonl")) && existsSync(join(root, "decisions.jsonl"));

    if (!storePresent) {
      const remote = await loadRuntimeStatus(now);
      if (remote?.fresh) {
        const body = {
          at: nowIso,
          api_calls_ui: 0 as const,
          real_money: false as const,
          cache_hit: false,
          mirror_source: "neon" as const,
          mirror_published_at: remote.published_at,
          mirror_age_ms: remote.age_ms,
          observatory: remote.payload.observatory,
          health: {
            ...remote.payload.health053,
            components: remote.payload.components,
            detail: remote.payload.detail,
          },
          challengers: [],
          predictive: {
            final_verdict: remote.payload.predictive.final_verdict,
            validation: remote.payload.predictive.validation,
            model_manifest: remote.payload.predictive.model_manifest,
            learning_report: null,
            paper_bankroll_report: null,
            e2e: null,
          },
          learning_cases: [],
          recent_settlements: [],
          recent_autopsies: [],
        };
        cache = { at: now, body };
        return NextResponse.json(body);
      }
    }

    const observatory = buildLiteObservatory(root, nowIso);
    const health = {
      ...buildHealthPayload053(root),
      source_health: loadSourceHealth053(root),
      autostart: loadAutostartStatus055(root),
    };

    const learningPath = join(pi, "learning", "cases.jsonl");
    const learningFromPi = readJsonlTail(learningPath, 40);
    const learningFromStore = readJsonlTail(join(root, "learning-cases.jsonl"), 40);

    const body = {
      at: nowIso,
      api_calls_ui: 0 as const,
      real_money: false as const,
      cache_hit: false,
      observatory,
      health,
      challengers: loadChallengerRegistry053(root),
      predictive: {
        final_verdict: readJsonIfExists(join(pi, "final-verdict.json")),
        validation: readJsonIfExists(join(pi, "validation-report.json")),
        model_manifest: readJsonIfExists(join(pi, "model-manifest.json")),
        learning_report: readJsonIfExists(join(pi, "learning-report.json")),
        paper_bankroll_report: readJsonIfExists(join(pi, "paper-bankroll-report.json")),
        e2e: readJsonIfExists(join(pi, "e2e-pipeline-report.json")),
      },
      learning_cases: learningFromPi.length ? learningFromPi : learningFromStore,
      recent_settlements: readJsonlTail(join(root, "settlements.jsonl"), 30),
      recent_autopsies: readJsonlTail(join(root, "autopsies.jsonl"), 30),
    };

    cache = { at: now, body };
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        at: new Date().toISOString(),
        api_calls_ui: 0 as const,
        real_money: false as const,
        cache_hit: false,
        observatory: null,
        health: null,
        challengers: [],
        predictive: null,
        learning_cases: [],
        recent_settlements: [],
        recent_autopsies: [],
        store_root: "audit/external/task-044",
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 200 },
    );
  }
}
