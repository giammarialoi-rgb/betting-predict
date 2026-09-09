import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadSportCoverage049 } from "@/domain/eval/factory-049/config";
import type { SportCoverageEntry049 } from "@/domain/eval/factory-049/config";

export type SportDiagStatus053 =
  | "ACTIVE_DATA"
  | "ACTIVE_EMPTY"
  | "INACTIVE"
  | "UNAVAILABLE"
  | "BUDGET_BLOCKED"
  | "RATE_LIMITED"
  | "ERROR"
  | "UNKNOWN";

export type SportDiagnostic053 = {
  sport: string;
  status: SportDiagStatus053;
  keys_active: number;
  keys_pulled: number;
  events_in_lab: number;
  unique_events: number;
  next_24h: number;
  analyzed: number;
  predicted: number;
  bet: number;
  no_bet: number;
  locked: number;
  settled: number;
  note: string | null;
};

function mapStatus(entry: SportCoverageEntry049 | undefined, eventsInLab: number): SportDiagStatus053 {
  if (!entry) return eventsInLab > 0 ? "ACTIVE_DATA" : "UNKNOWN";
  switch (entry.status) {
    case "AVAILABLE":
      return eventsInLab > 0 ? "ACTIVE_DATA" : "ACTIVE_EMPTY";
    case "AVAILABLE_NO_EVENTS_IN_WINDOW":
      return "ACTIVE_EMPTY";
    case "PROVIDER_UNAVAILABLE":
      return "UNAVAILABLE";
    case "BUDGET_INSUFFICIENT":
      return "BUDGET_BLOCKED";
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    case "DISCOVERY_FAILED":
    case "PROVIDER_ERROR":
      return "ERROR";
    default:
      return eventsInLab > 0 ? "ACTIVE_DATA" : "UNKNOWN";
  }
}

function normalizeSport(s: string): string {
  const x = (s || "").toLowerCase();
  if (x.includes("soccer") || x.includes("football")) return "soccer";
  if (x.includes("tennis")) return "tennis";
  if (x.includes("basket")) return "basketball";
  if (x.includes("volley")) return "volleyball";
  if (x.includes("hockey")) return "hockey";
  return "other";
}

/** Explicit sport diagnostics — never leave TENNIS=0 unexplained. */
export function buildSportDiagnostics053(nowIso = new Date().toISOString()): {
  at: string;
  sports: SportDiagnostic053[];
} {
  const root = permanentRoot044();
  const store = loadStore044(root);
  const cov = loadSportCoverage049(root);
  const now = Date.parse(nowIso);
  const day = 24 * 3600_000;
  const families = ["soccer", "tennis", "basketball", "volleyball", "hockey", "other"] as const;

  const decisionsPath = join(root, "decisions.jsonl");
  const decisionByEvent = new Map<string, string>();
  if (existsSync(decisionsPath)) {
    for (const line of readFileSync(decisionsPath, "utf8").split(/\n/).filter(Boolean)) {
      try {
        const d = JSON.parse(line) as { event_id: string; decision: string; timestamp: string };
        const prev = decisionByEvent.get(d.event_id);
        if (!prev) decisionByEvent.set(d.event_id, d.decision);
      } catch {
        /* skip */
      }
    }
  }

  const sports = families.map((sport) => {
    const entry = cov.sports.find((s) => s.family === sport);
    const evs = store.events.filter((e) => normalizeSport(e.sport) === sport);
    const unique = new Set(evs.map((e) => e.event_id));
    const uniqueList = [...unique];
    const next24 = uniqueList.filter((id) => {
      const e = evs.find((x) => x.event_id === id);
      if (!e?.kickoff_utc) return false;
      const k = Date.parse(e.kickoff_utc);
      return Number.isFinite(k) && k >= now && k < now + day;
    }).length;
    const predicted = uniqueList.filter((id) => store.predictions.some((p) => p.event_id === id)).length;
    const locked = uniqueList.filter((id) => store.lockEventIds.has(id)).length;
    const settled = uniqueList.filter((id) => store.settlementEventIds.has(id)).length;
    let bet = 0;
    let no_bet = 0;
    for (const id of uniqueList) {
      const d = decisionByEvent.get(id);
      if (d === "BET_CANDIDATE" || d === "STRONG_CANDIDATE") bet += 1;
      else if (d === "NO_BET") no_bet += 1;
    }
    return {
      sport: sport.toUpperCase(),
      status: mapStatus(entry, unique.size),
      keys_active: entry?.keys_active ?? 0,
      keys_pulled: entry?.keys_pulled ?? 0,
      events_in_lab: evs.length,
      unique_events: unique.size,
      next_24h: next24,
      analyzed: predicted,
      predicted,
      bet,
      no_bet,
      locked,
      settled,
      note: entry?.note ?? null,
    };
  });

  const payload = { at: nowIso, sports };
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(join(root, "manifests", "sport-diagnostics-053.json"), JSON.stringify(payload, null, 2));
  return payload;
}
