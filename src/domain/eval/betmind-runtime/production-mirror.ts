/**
 * Production Control Center helpers — honest filesystem mirror, never fake ONLINE.
 * A historical/stale payload is still a real event list; stale ≠ empty.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { matchesCalendarQuery } from "@/domain/eval/betmind-runtime/calendar";
import { operationalStatusIt } from "@/domain/eval/betmind-runtime/status-copy";
import type { SourceEntry } from "@/domain/eval/data-intelligence/types";

export {
  brainStatusIt,
  decisionLabelIt,
  formatAgeIt,
  operationalStatusIt,
  statusWordIt,
} from "@/domain/eval/betmind-runtime/status-copy";

/** Lab B is present only when the event ledger exists — an empty directory is not a store. */
export function localLabStorePresent(root: string): boolean {
  return existsSync(join(root, "events.jsonl"));
}

/** Stale mirror: liveness is OFFLINE. Last known payload may still list real events. */
export function staleMirrorComponents(): {
  supervisor: "OFFLINE";
  worker: "OFFLINE";
  brain: "OFFLINE";
  predictive_engine: "OFFLINE";
  data_pipeline: "OFFLINE";
  settlement: "UNKNOWN";
  learning: "UNKNOWN";
} {
  return {
    supervisor: "OFFLINE",
    worker: "OFFLINE",
    brain: "OFFLINE",
    predictive_engine: "OFFLINE",
    data_pipeline: "OFFLINE",
    settlement: "UNKNOWN",
    learning: "UNKNOWN",
  };
}

export type OperationalOverlay = {
  source_id?: string;
  id?: string;
  status?: string;
  last_attempt?: string | null;
  last_success?: string | null;
  last_failure?: string | null;
  events_found?: number;
  observations_found?: number;
  blocked_count?: number;
  no_event_count?: number;
  last_event_label?: string | null;
  capabilities?: string[];
  reason?: string | null;
  missing_adapter?: boolean;
};

export type OverlaySourceCard = SourceEntry & {
  last_attempt?: string | null;
  last_success?: string | null;
  last_failure?: string | null;
  events_found?: number;
  observations_found?: number;
  blocked_count?: number;
  no_event_count?: number;
  last_event_label?: string | null;
  capabilities?: string[];
  missing_adapter?: boolean;
  overlay: "neon_operational" | "registry_only";
};

function opId(row: OperationalOverlay): string {
  return String(row.source_id ?? row.id ?? "");
}

/**
 * Prefer measured filesystem operational rows over in-memory registry placeholders.
 * Does not invent success: empty operational stays empty.
 */
export function overlayRegistryWithOperational(
  registry: SourceEntry[],
  operational: OperationalOverlay[],
): OverlaySourceCard[] {
  const byId = new Map<string, OperationalOverlay>();
  for (const row of operational) {
    const id = opId(row);
    if (id) byId.set(id, row);
  }
  return registry.map((s) => {
    const op = byId.get(s.id);
    if (!op) return { ...s, overlay: "registry_only" as const };
    const eventsFound = Number(op.events_found ?? 0);
    const observations = Number(op.observations_found ?? 0);
    const hasSignal = eventsFound > 0 || observations > 0 || Boolean(op.last_success);
    const status = hasSignal
      ? mapOperationalToRegistryStatus(op.status, s.status)
      : s.status;
    const reason = hasSignal
      ? operationalReason(op, s.reason)
      : s.reason;
    return {
      ...s,
      status,
      reason,
      last_attempt: op.last_attempt ?? null,
      last_success: op.last_success ?? null,
      last_failure: op.last_failure ?? null,
      events_found: eventsFound,
      observations_found: observations,
      blocked_count: op.blocked_count ?? 0,
      no_event_count: op.no_event_count ?? 0,
      last_event_label: op.last_event_label ?? null,
      capabilities: op.capabilities?.length ? op.capabilities : undefined,
      missing_adapter: op.missing_adapter,
      overlay: "neon_operational",
    };
  });
}

function mapOperationalToRegistryStatus(
  opStatus: string | undefined,
  fallback: SourceEntry["status"],
): SourceEntry["status"] {
  const u = String(opStatus ?? "").toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "DEGRADED" || u === "PARTIAL") return "TEMPORALLY_CAUTIOUS";
  if (u === "BLOCKED") return "UNAVAILABLE";
  if (u === "MISSING_ADAPTER") return "CANDIDATE";
  if (u === "NO_EVENT" || u === "IDLE") return fallback;
  if (u === "DISABLED_BY_POLICY") return "DISABLED_BY_POLICY";
  return fallback;
}

function operationalReason(op: OperationalOverlay, fallback: string): string {
  const events = Number(op.events_found ?? 0);
  const obs = Number(op.observations_found ?? 0);
  const parts = [
    `Specchio filesystem: ${operationalStatusIt(op.status)}`,
    events ? `${events} eventi con dati` : null,
    obs ? `${obs} osservazioni` : null,
    op.last_event_label ? `ultimo: ${op.last_event_label}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : fallback;
}

export function neonEventsEmptyReason(input: {
  remotePresent: boolean;
  remoteFresh: boolean | null;
  universeCount: number;
  filteredCount: number;
  date: string;
  sport: string;
  storePresentLocalOnPublisher?: boolean | null;
}): string {
  if (!input.remotePresent) {
    return "Nessuno specchio filesystem: il PC non ha ancora pubblicato eventi. Vercel non ha lo store Lab B in locale — nessuna partita inventata.";
  }
  if (input.universeCount === 0) {
    const stale = input.remoteFresh === false ? " Specchio non aggiornato." : "";
    const local = input.storePresentLocalOnPublisher
      ? " Sul PC lo store c’è, ma questo specchio non contiene righe calendario."
      : " Store Lab B assente anche sul publisher.";
    return `Nessuna partita nello specchio filesystem.${stale}${local}`;
  }
  if (input.filteredCount === 0) {
    return `Nessuna partita per ${input.date}${input.sport && input.sport !== "ALL" ? ` · ${input.sport}` : ""} (${input.universeCount} eventi in altre date/sport nello specchio).`;
  }
  return "";
}

export function filterNeonUniverse(
  universe: unknown[],
  q: { date?: string | null; from?: string | null; to?: string | null; sport?: string | null },
): unknown[] {
  return universe.filter((e) =>
    matchesCalendarQuery(e as { calendar_day?: string; kickoff_utc?: string; sport?: string }, q),
  );
}

export function collectNeonUniverse(obs: {
  next_events?: unknown;
  calendar?: { events?: unknown[] };
} | null | undefined): unknown[] {
  if (!obs) return [];
  if (Array.isArray(obs.next_events) && obs.next_events.length) return obs.next_events;
  if (Array.isArray(obs.calendar?.events) && obs.calendar.events.length) return obs.calendar.events;
  return [];
}

export function operationalHasNeonSignal(operational: OperationalOverlay[]): boolean {
  return operational.some(
    (s) => Number(s.events_found ?? 0) > 0 || Number(s.observations_found ?? 0) > 0 || Boolean(s.last_success),
  );
}
