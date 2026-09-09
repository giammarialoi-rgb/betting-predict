/**
 * Store integrity diagnostics — disk-only, visible in Control Center.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";

export type DiagnosticIssue056 = {
  code: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  count?: number;
};

function loadDecisions(root: string): DecisionRecord048[] {
  const p = join(root, "decisions.jsonl");
  if (!existsSync(p)) return [];
  const out: DecisionRecord048[] = [];
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      out.push(JSON.parse(line.replace(/^\uFEFF/, "")) as DecisionRecord048);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function runDiagnostics056(root = permanentRoot044()): {
  at: string;
  ok: boolean;
  issues: DiagnosticIssue056[];
} {
  const store = loadStore044(root);
  const issues: DiagnosticIssue056[] = [];
  const now = Date.now();

  const eventIds = store.events.map((e) => e.event_id);
  const uniqueEvents = new Set(eventIds);
  if (eventIds.length !== uniqueEvents.size) {
    issues.push({
      code: "DUPLICATE_EVENT_ID_LINES",
      level: "WARN",
      message: "events.jsonl has duplicate event_id lines (dashboard dedupes; file append-only)",
      count: eventIds.length - uniqueEvents.size,
    });
  }

  const decisions = loadDecisions(root);
  const decIds = decisions.map((d) => d.decision_id);
  const uniqueDec = new Set(decIds);
  if (decIds.length !== uniqueDec.size) {
    issues.push({
      code: "DUPLICATE_DECISION_ID",
      level: "ERROR",
      message: "duplicate decision_id in decisions.jsonl",
      count: decIds.length - uniqueDec.size,
    });
  }

  let invalidOdds = 0;
  let invalidProb = 0;
  for (const q of store.quotes) {
    if (!(q.price > 1)) invalidOdds += 1;
  }
  for (const p of store.predictions) {
    const probs = [p.home_prob, p.draw_prob, p.away_prob].filter((x) => x != null) as number[];
    for (const x of probs) {
      if (x < 0 || x > 1) invalidProb += 1;
    }
  }
  if (invalidOdds) {
    issues.push({ code: "INVALID_ODDS", level: "ERROR", message: "quote price <= 1", count: invalidOdds });
  }
  if (invalidProb) {
    issues.push({
      code: "PROBABILITY_OUT_OF_RANGE",
      level: "ERROR",
      message: "prediction probability outside [0,1]",
      count: invalidProb,
    });
  }

  let pastUpcoming = 0;
  for (const e of store.events) {
    if (!e.kickoff_utc) continue;
    const k = Date.parse(e.kickoff_utc);
    if (Number.isFinite(k) && k < now - 6 * 3600_000 && e.status === "SCHEDULED") pastUpcoming += 1;
  }
  if (pastUpcoming) {
    issues.push({
      code: "PAST_MARKED_UPCOMING",
      level: "WARN",
      message: "events with kickoff in past still SCHEDULED",
      count: pastUpcoming,
    });
  }

  let betNoWhy = 0;
  let betNoEdge = 0;
  for (const d of decisions) {
    if (d.decision !== "BET_CANDIDATE" && d.decision !== "STRONG_CANDIDATE") continue;
    if (!d.explanation?.WHY_PRIMARY) betNoWhy += 1;
    if (d.estimated_edge == null || d.estimated_edge <= 0) betNoEdge += 1;
  }
  if (betNoWhy) {
    issues.push({ code: "BET_WITHOUT_WHY", level: "ERROR", message: "BET without WHY_PRIMARY", count: betNoWhy });
  }
  if (betNoEdge) {
    issues.push({ code: "BET_WITHOUT_EDGE", level: "ERROR", message: "BET without positive edge", count: betNoEdge });
  }

  let settledNoLock = 0;
  for (const s of store.settlements) {
    if (s.outcome === "UNSETTLED") continue;
    if (!store.lockEventIds.has(s.event_id)) settledNoLock += 1;
  }
  if (settledNoLock) {
    issues.push({
      code: "SETTLEMENT_WITHOUT_LOCK",
      level: "WARN",
      message: "settled event without Lab B lock",
      count: settledNoLock,
    });
  }

  const marketOnly = decisions.filter((d) => d.decision_reason_codes?.includes("MODEL_IS_MARKET_ONLY")).length;
  const independent = decisions.filter(
    (d) =>
      d.model_version?.includes("INDEPENDENT") ||
      d.decision_reason_codes?.some((c) => c === "INDEPENDENT_MODEL" || c.includes("INDEPENDENT_POISSON")),
  ).length;
  if (independent > 0) {
    issues.push({
      code: "INDEPENDENT_MODEL_ACTIVE",
      level: "INFO",
      message: "Independent model present in decisions — MODEL_EDGE remains UNKNOWN until gates",
      count: independent,
    });
  } else if (marketOnly > 0 && decisions.length > 0 && marketOnly / decisions.length > 0.9) {
    issues.push({
      code: "MODEL_IS_MARKET_ONLY",
      level: "WARN",
      message: "Champion model mirrors market (no independent edge) — expected NO_BET",
      count: marketOnly,
    });
  }

  if (store.settlements.filter((s) => s.outcome !== "UNSETTLED").length > 0 && store.learning.length === 0) {
    issues.push({
      code: "SETTLED_WITHOUT_LEARNING_CANDIDATES",
      level: "INFO",
      message: "settlements exist but store.learning candidates empty (044 learning_candidate gate or correct preds)",
    });
  }

  const errors = issues.filter((i) => i.level === "ERROR");
  return { at: new Date().toISOString(), ok: errors.length === 0, issues };
}
