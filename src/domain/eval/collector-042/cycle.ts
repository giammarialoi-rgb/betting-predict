import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPayload } from "@/ingest/hash";
import { hasUtcOffset, parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { secondsToKickoff } from "@/domain/eval/prospective-036/windows";
import { observationWindow039 } from "@/domain/eval/live-039/asof";
import { availableAt039, classifyQuote039, isStrict039, matchGrade039 } from "@/domain/eval/live-039/classify";
import { persistRaw039 } from "@/domain/eval/live-039/collector";
import {
  appendJournal039,
  appendQuote039,
  loadStore039,
  upsertEvent039,
  type Store039,
} from "@/domain/eval/live-039/store";
import { applyScores039 } from "@/domain/eval/live-039/settle";
import { settledVerified039 } from "@/domain/eval/live-039/health";
import { getOddsApiKey } from "@/domain/eval/live-039/sources";
import { recoverLocks040 } from "@/domain/eval/recover-040/lock";
import { LIVE_SOCCER_SPORTS_039, pullSportOdds042, pullSportScores042 } from "@/domain/eval/collector-042/api";
import {
  loadGovernorConfig042,
  sourceStore042,
  type GovernorConfig042,
} from "@/domain/eval/collector-042/config";
import {
  canAffordRun042,
  loadCreditState042,
  remainingCredits042,
  saveCreditState042,
} from "@/domain/eval/collector-042/credit";
import { loadHeartbeat042, saveHeartbeat042 } from "@/domain/eval/collector-042/heartbeat";
import { logCycle042 } from "@/domain/eval/collector-042/log";
import { planCycle042 } from "@/domain/eval/collector-042/plan";
import type { CollectorHeartbeat042, CollectorStatus042, CreditState042 } from "@/domain/eval/collector-042/types";

type Meta042 = {
  lastDiscoveryAt: string | null;
  labTriggeredAt: string | null;
  consecutiveErrors: number;
  backoffMs: number;
};

function metaPath(root: string): string {
  return join(root, "collector-meta.json");
}

export function loadMeta042(root: string): Meta042 {
  const p = metaPath(root);
  if (!existsSync(p)) {
    return { lastDiscoveryAt: null, labTriggeredAt: null, consecutiveErrors: 0, backoffMs: 0 };
  }
  try {
    return {
      lastDiscoveryAt: null,
      labTriggeredAt: null,
      consecutiveErrors: 0,
      backoffMs: 0,
      ...(JSON.parse(readFileSync(p, "utf8")) as Meta042),
    };
  } catch {
    return { lastDiscoveryAt: null, labTriggeredAt: null, consecutiveErrors: 0, backoffMs: 0 };
  }
}

export function saveMeta042(meta: Meta042, root: string): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(metaPath(root), JSON.stringify(meta, null, 2));
}

function ingestOddsPull(
  store: Store039,
  sport: string,
  events: { source_event_id: string; competition: string; home_team: string; away_team: string; kickoff_at_utc: string | null }[],
  quotes: {
    source_event_id: string;
    market: string;
    selection: string;
    odds_decimal: number;
    bookmaker: string;
    source_record_id: string;
    source_timestamp_utc: string | null;
  }[],
  collectedAt: string,
  rawHash: string,
): { events: number; quotes: number; duplicates: number } {
  let evN = 0;
  let qN = 0;
  let dup = 0;
  const eventBySource = new Map<string, string>();
  for (const ev of events) {
    const kickOk = Boolean(ev.kickoff_at_utc && hasUtcOffset(ev.kickoff_at_utc) && parseExactUtcMs(ev.kickoff_at_utc) != null);
    const eventId = hashPayload({ s: "the-odds-api", id: ev.source_event_id }).slice(0, 24);
    eventBySource.set(ev.source_event_id, eventId);
    if (
      upsertEvent039(store, {
        event_id: eventId,
        source_event_id: ev.source_event_id,
        sport_key: ev.competition || sport,
        home_team: ev.home_team,
        away_team: ev.away_team,
        commence_time: kickOk ? ev.kickoff_at_utc : null,
        source: "the-odds-api",
        first_seen_at: collectedAt,
        last_seen_at: collectedAt,
        kickoff_status: kickOk ? "OK" : "INVALID_KICKOFF",
      }) === "inserted"
    ) {
      evN += 1;
    }
  }
  for (const q of quotes) {
    const eventId = eventBySource.get(q.source_event_id);
    const stored = store.events.find((e) => e.event_id === eventId);
    if (!eventId || !stored) continue;
    const match = matchGrade039({
      home: stored.home_team,
      away: stored.away_team,
      commenceTime: stored.commence_time,
      sourceEventId: stored.source_event_id,
      sportKey: stored.sport_key,
    });
    const cls = classifyQuote039({
      sourceQuoteTimestamp: q.source_timestamp_utc,
      commenceTime: stored.commence_time,
      collectedAt,
      market: q.market,
      match,
    });
    const available = availableAt039(q.source_timestamp_utc);
    const qMs = parseExactUtcMs(available);
    const kMs = parseExactUtcMs(stored.commence_time);
    const offset = qMs != null && kMs != null ? secondsToKickoff(qMs, kMs) : null;
    const win = available && stored.commence_time ? observationWindow039(available, stored.commence_time) : null;
    const ins = appendQuote039(store, {
      event_id: eventId,
      market: q.market,
      bookmaker: q.bookmaker,
      outcome: q.selection,
      price: q.odds_decimal,
      source_quote_timestamp: q.source_timestamp_utc,
      collected_at: collectedAt,
      available_at: available,
      raw_payload_hash: rawHash || hashPayload({ q: q.source_record_id, t: q.source_timestamp_utc }),
      temporal_class: cls,
      match_status: match,
      window: win,
      offset_seconds_from_kickoff: offset,
      coverage_status: win ? "COVERED" : offset != null && offset > 0 ? "OUT_OF_WINDOW" : "NO_OBSERVATION",
    });
    if (ins === "IGNORED_DUPLICATE") dup += 1;
    else if (isStrict039(cls, match) || true) qN += 1;
  }
  return { events: evN, quotes: qN, duplicates: dup };
}

function bumpHeartbeat(
  store: Store039,
  credit: CreditState042,
  patch: Partial<CollectorHeartbeat042>,
  cfg: GovernorConfig042,
  root: string,
): CollectorHeartbeat042 {
  const settled = settledVerified039(store);
  const prev = loadHeartbeat042(root);
  const hb: CollectorHeartbeat042 = {
    ...prev,
    ...patch,
    eventsDiscovered: store.events.length,
    quoteObservations: store.quotes.length,
    lockedDecisions: store.decisions.length,
    settledEvents: settled,
    remainingTo100: Math.max(0, cfg.settledTarget - settled),
    apiKeyConfigured: Boolean(getOddsApiKey()),
    budget: {
      monthlyLimit: credit.monthlyLimit,
      used: credit.observedUsed ?? credit.estimatedUsed,
      remaining: remainingCredits042(credit),
      estimatedRemaining: credit.estimatedRemaining,
      safeRemaining: credit.safeRemaining,
      maxCreditsPerRun: credit.maxCreditsPerRun,
      sourceOfTruth: credit.sourceOfTruth,
    },
    updatedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  };
  saveHeartbeat042(hb, root);
  return hb;
}

export type CycleResult042 = {
  status: CollectorStatus042;
  skipped: boolean;
  reason: string;
  discovery: { sports: number; events: number; quotes: number; duplicates: number } | null;
  scores: { sports: number; settled: number; unsettled: number } | null;
  lockedNew: number;
  credit: CreditState042;
  settled: number;
};

export async function runCollectorCycle042(input: {
  storeRoot?: string;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
  triggerLab?: (settled: number) => Promise<void> | void;
  nowMs?: number;
}): Promise<CycleResult042> {
  const cfg = loadGovernorConfig042();
  const root = sourceStore042(input.storeRoot);
  const store = loadStore039(root);
  const meta = loadMeta042(root);
  let credit = loadCreditState042(root);
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!getOddsApiKey()) {
    credit = { ...credit, status: "PAUSED_ERROR", lastUpdatedAt: nowIso };
    saveCreditState042(credit, root);
    bumpHeartbeat(store, credit, {
      status: "PAUSED_ERROR",
      lastError: "THE_ODDS_API_KEY missing",
      pausedReason: "missing_api_key",
      providerStatus: "not_configured",
      mode: "IDLE",
    }, cfg, root);
    return {
      status: "PAUSED_ERROR",
      skipped: true,
      reason: "missing_api_key",
      discovery: null,
      scores: null,
      lockedNew: 0,
      credit,
      settled: settledVerified039(store),
    };
  }

  const settled0 = settledVerified039(store);
  if (settled0 >= cfg.settledTarget) {
    const lock = recoverLocks040(store);
    credit = { ...credit, status: "COMPLETED", lastUpdatedAt: nowIso };
    saveCreditState042(credit, root);
    bumpHeartbeat(store, credit, {
      status: "COMPLETED",
      providerStatus: "ok",
      mode: "IDLE",
      lastError: null,
      pausedReason: null,
      lastPullAt: nowIso,
    }, cfg, root);
    if (!meta.labTriggeredAt && input.triggerLab) {
      await input.triggerLab(settled0);
      meta.labTriggeredAt = nowIso;
      saveMeta042(meta, root);
    }
    return {
      status: "COMPLETED",
      skipped: true,
      reason: "settled_target_reached",
      discovery: null,
      scores: null,
      lockedNew: lock.locked,
      credit,
      settled: settled0,
    };
  }

  const plan = planCycle042({
    store,
    lastDiscoveryAt: meta.lastDiscoveryAt,
    forceDiscovery: input.forceDiscovery,
    nowMs,
    cfg,
  });

  const afford = canAffordRun042(credit, Math.max(plan.estimatedCredits, plan.runScores || plan.runDiscovery ? 1 : 0), cfg);
  if ((plan.runDiscovery || plan.runScores) && !afford.ok) {
    credit = { ...credit, status: "PAUSED_BUDGET", lastUpdatedAt: nowIso };
    saveCreditState042(credit, root);
    bumpHeartbeat(store, credit, {
      status: "PAUSED_BUDGET",
      pausedReason: afford.reason,
      providerStatus: "budget",
      mode: "IDLE",
      lastError: null,
    }, cfg, root);
    logCycle042({ status: "PAUSED_BUDGET", reason: afford.reason, plan }, root);
    return {
      status: "PAUSED_BUDGET",
      skipped: true,
      reason: afford.reason ?? "budget",
      discovery: null,
      scores: null,
      lockedNew: 0,
      credit,
      settled: settled0,
    };
  }

  let discovery: CycleResult042["discovery"] = null;
  let scores: CycleResult042["scores"] = null;
  let providerStatus = "ok";
  let lastError: string | null = null;
  let status: CollectorStatus042 = "RUNNING";
  let httpFatal: number | null = null;

  if (plan.runDiscovery) {
    let ev = 0;
    let qq = 0;
    let dup = 0;
    for (const sport of LIVE_SOCCER_SPORTS_039) {
      const pull = await pullSportOdds042({
        sport,
        fetchImpl: input.fetchImpl,
        creditState: credit,
        regions: cfg.regions,
      });
      credit = pull.creditState;
      if (pull.httpStatus === 401 || pull.httpStatus === 403) {
        httpFatal = pull.httpStatus;
        lastError = pull.error;
        break;
      }
      if (pull.httpStatus === 429) {
        lastError = pull.error;
        providerStatus = "rate_limited";
        meta.backoffMs = Math.min(cfg.maxBackoffMs, Math.max(60_000, (meta.backoffMs || 60_000) * 2));
        break;
      }
      if (pull.error) {
        lastError = pull.error;
        providerStatus = "error";
        continue;
      }
      if (pull.raw_hash) persistRaw039(root, "the-odds-api", { sport, hash: pull.raw_hash });
      const ins = ingestOddsPull(store, sport, pull.events, pull.quotes, nowIso, pull.raw_hash);
      ev += ins.events;
      qq += ins.quotes;
      dup += ins.duplicates;
      appendJournal039(store, {
        source: "the-odds-api",
        requested_at_utc: nowIso,
        received_at_utc: nowIso,
        status: "ok",
        error: null,
        failure_mode: null,
        events: pull.events.length,
        quotes: pull.quotes.length,
      });
    }
    discovery = { sports: LIVE_SOCCER_SPORTS_039.length, events: ev, quotes: qq, duplicates: dup };
    meta.lastDiscoveryAt = nowIso;
  }

  if (!httpFatal && plan.runScores) {
    let settledN = 0;
    let unsettledN = 0;
    const allScores: Parameters<typeof applyScores039>[1] = [];
    for (const sport of plan.scoreSports) {
      const pull = await pullSportScores042({
        sport,
        fetchImpl: input.fetchImpl,
        creditState: credit,
      });
      credit = pull.creditState;
      if (pull.httpStatus === 401 || pull.httpStatus === 403) {
        httpFatal = pull.httpStatus;
        lastError = pull.error;
        break;
      }
      if (pull.httpStatus === 429) {
        lastError = pull.error;
        providerStatus = "rate_limited";
        meta.backoffMs = Math.min(cfg.maxBackoffMs, Math.max(60_000, (meta.backoffMs || 60_000) * 2));
        break;
      }
      if (pull.error) {
        lastError = pull.error;
        providerStatus = "error";
        continue;
      }
      allScores.push(...pull.scores);
    }
    if (!httpFatal) {
      const counts = applyScores039(store, allScores, nowIso, "the-odds-api-scores");
      settledN = counts.settled;
      unsettledN = counts.unsettled;
      scores = { sports: plan.scoreSports.length, settled: settledN, unsettled: unsettledN };
    }
  }

  if (httpFatal === 401 || httpFatal === 403) {
    status = "PAUSED_ERROR";
    credit = { ...credit, status, lastUpdatedAt: nowIso };
    meta.consecutiveErrors += 1;
  } else if (providerStatus === "rate_limited") {
    status = "RUNNING";
    meta.consecutiveErrors += 1;
  } else if (lastError && !discovery && !scores) {
    status = "PAUSED_ERROR";
    meta.consecutiveErrors += 1;
    meta.backoffMs = Math.min(cfg.maxBackoffMs, Math.max(15_000, (meta.backoffMs || 15_000) * 2));
  } else {
    meta.consecutiveErrors = 0;
    meta.backoffMs = 0;
    status = "RUNNING";
  }

  const lock = recoverLocks040(store);
  const settled = settledVerified039(store);
  if (settled >= cfg.settledTarget) status = "COMPLETED";
  else if (status === "RUNNING" && plan.scoreSports.length > 0) status = "READY_TO_SETTLE";

  credit = { ...credit, status, lastUpdatedAt: nowIso };
  saveCreditState042(credit, root);
  saveMeta042(meta, root);

  const nextPull = new Date(nowMs + Math.max(cfg.pollMinutes * 60_000, meta.backoffMs)).toISOString();
  bumpHeartbeat(store, credit, {
    status,
    pid: process.pid,
    lastPullAt: nowIso,
    nextPullAt: nextPull,
    providerStatus,
    lastError,
    pausedReason: status.startsWith("PAUSED") ? lastError ?? status : null,
    backoffMs: meta.backoffMs,
    mode: plan.runDiscovery && plan.runScores ? "MIXED" : plan.runDiscovery ? "DISCOVERY" : plan.runScores ? "SETTLE_ONLY" : "IDLE",
  }, cfg, root);

  logCycle042(
    {
      status,
      reason: plan.reason,
      discovery,
      scores,
      lockedNew: lock.locked,
      settled,
      remaining: remainingCredits042(credit),
      nextPullAt: nextPull,
    },
    root,
  );

  if (settled >= cfg.settledTarget && !meta.labTriggeredAt && input.triggerLab) {
    await input.triggerLab(settled);
    meta.labTriggeredAt = nowIso;
    saveMeta042(meta, root);
  }

  return {
    status,
    skipped: false,
    reason: plan.reason,
    discovery,
    scores,
    lockedNew: lock.locked,
    credit,
    settled,
  };
}

export function nextKickoffs042(store: Store039, limit = 8, nowMs = Date.now()) {
  return store.events
    .filter((e) => e.commence_time && parseExactUtcMs(e.commence_time) != null)
    .map((e) => {
      const kick = parseExactUtcMs(e.commence_time!)!;
      const settled = store.settlements.find((s) => s.event_id === e.event_id && s.outcome !== "UNSETTLED");
      const locked = store.decisions.some((d) => d.event_id === e.event_id);
      let state = "SCHEDULED";
      if (settled) state = "SETTLED";
      else if (kick <= nowMs && locked) state = "AWAITING_REVEAL";
      else if (locked) state = "LOCKED";
      return {
        event_id: e.event_id,
        home_team: e.home_team,
        away_team: e.away_team,
        sport_key: e.sport_key,
        kickoff: e.commence_time!,
        ms_to_kickoff: kick - nowMs,
        state,
      };
    })
    .sort((a, b) => a.ms_to_kickoff - b.ms_to_kickoff)
    .slice(0, limit);
}

export function shaQuiet042(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
}
