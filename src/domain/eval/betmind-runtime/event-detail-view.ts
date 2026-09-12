/**
 * Event-detail honesty helpers.
 *
 * Choice (documented): HTTP 200 when the board row exists but the full dossier
 * is not mirrored. 404 stays reserved for true `not_found` (board missing).
 * The client still accepts a 404 + `dossier_not_mirrored` + `board_summary`
 * so a reverted status code cannot empty the page.
 *
 * Never invent HDA / features / lineage from board lite fields.
 */

export const EVENT_DETAIL_BOARD_ONLY_NOTICE_IT =
  "Partita trovata sullo specchio remoto. Il dossier completo (probabilità HDA, features, lineage) non è pubblicato — esiste solo su Lab B / locale. Niente di inventato.";

export type BoardSummary = {
  event_id: string;
  bucket: string | null;
  label: string | null;
  competition: string | null;
  kickoff_utc: string | null;
  model_version: string | null;
  decision: string | null;
  prediction_status: string | null;
  feature_coverage: number | null;
  analyzed_at: string | null;
  home_or_a: string | null;
  away_or_b: string | null;
};

export type DossierState =
  | "ok"
  | "research_running"
  | "research_failed"
  | "local_only"
  | "board_only"
  | "not_found";

export type EventLiveView = {
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  minute: string | null;
  period: number | null;
  source: string;
  source_status: string | null;
  observed_at: string;
  finished: boolean;
};

export type EventDetailApiJson = {
  error?: string;
  reason?: string;
  notice_it?: string;
  present?: Record<string, unknown>;
  missing?: unknown;
  board_summary?: Record<string, unknown> | BoardSummary | null;
  dossier?: unknown;
  event?: unknown;
  dossier_state?: DossierState;
  research_state?: string | null;
  live?: EventLiveView | null;
  settlement?: unknown;
};

export type ClassifiedEventDetail =
  | { kind: "ok" }
  | { kind: "local_only"; notice_it: string }
  | { kind: "research_running"; summary: BoardSummary | null; notice_it: string }
  | { kind: "research_failed"; summary: BoardSummary | null; notice_it: string; reason: string }
  | { kind: "board_only"; summary: BoardSummary; notice_it: string; reason: string }
  | { kind: "not_found"; message: string }
  | { kind: "error"; message: string };

export const EVENT_DETAIL_LOCAL_ONLY_NOTICE_IT =
  "Dossier presente in locale (Lab B). Non ancora verificato sullo specchio remoto. Analisi reale — non inventata dal board.";

export const EVENT_DETAIL_RESEARCH_RUNNING_IT =
  "Ricerca in corso per questo evento. Nessun dossier ancora. Niente di inventato.";

export const EVENT_DETAIL_RESEARCH_FAILED_IT =
  "Ricerca fallita o incompleta. Nessun dossier valido. Niente di inventato.";

function nullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function nullableNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function teamsFromBoardLabel(label: unknown): {
  home_or_a: string | null;
  away_or_b: string | null;
} {
  const s = String(label ?? "");
  if (!s.includes(" vs ")) return { home_or_a: null, away_or_b: null };
  const [home, away] = s.split(" vs ").map((part) => part.trim());
  return { home_or_a: home || null, away_or_b: away || null };
}

export function boardSummaryFromBoard(eventId: string, board: Record<string, unknown>): BoardSummary {
  const label = nullableString(board.label);
  const teams = teamsFromBoardLabel(label);
  return {
    event_id: eventId,
    bucket: nullableString(board.bucket),
    label,
    competition: nullableString(board.competition),
    kickoff_utc: nullableString(board.kickoff_utc),
    model_version: nullableString(board.model_version),
    decision: nullableString(board.decision),
    prediction_status: nullableString(board.prediction_status),
    feature_coverage: nullableNumber(board.feature_coverage),
    analyzed_at: nullableString(board.analyzed_at),
    home_or_a: nullableString(board.home_or_a) ?? teams.home_or_a,
    away_or_b: nullableString(board.away_or_b) ?? teams.away_or_b,
  };
}

export function normalizeBoardSummary(raw: unknown): BoardSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const eventId = nullableString(row.event_id);
  if (!eventId) return null;
  return boardSummaryFromBoard(eventId, row);
}

export function matchTitleFromBoard(summary: BoardSummary): string {
  if (summary.home_or_a && summary.away_or_b) {
    return `${summary.home_or_a} vs ${summary.away_or_b}`;
  }
  return summary.label || summary.event_id || "Partita";
}

export function formatEventDetailError(json: EventDetailApiJson, status: number): string {
  const missing = Array.isArray(json.missing) ? json.missing.filter((x) => typeof x === "string") : [];
  return [
    json.reason ?? `HTTP ${status}`,
    json.error ? `(${json.error})` : null,
    missing.length ? `Missing: ${missing.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

export function isDossierNotMirroredWithBoard(json: EventDetailApiJson): boolean {
  return json.error === "dossier_not_mirrored" && normalizeBoardSummary(json.board_summary) != null;
}

/**
 * Classify GET /api/betmind/event/:id for the UI.
 * `dossier_not_mirrored` + board_summary is never a fatal empty page,
 * whether the route answers 200 or 404.
 */
function hasRenderableDossier(json: EventDetailApiJson): boolean {
  return json.dossier != null && typeof json.dossier === "object";
}

export function liveViewFromRow(row: {
  status?: string;
  home_goals?: number | string | null;
  away_goals?: number | string | null;
  minute?: string | null;
  period?: number | null;
  source?: string;
  source_status?: string | null;
  observed_at?: string;
  finished?: boolean;
  score?: unknown;
  result?: unknown;
} | null | undefined): EventLiveView | null {
  if (!row) return null;
  const asNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
    return null;
  };
  let home_goals = asNum(row.home_goals);
  let away_goals = asNum(row.away_goals);
  if (home_goals == null || away_goals == null) {
    const raw = row.score ?? row.result;
    if (typeof raw === "string") {
      const m = raw.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);
      if (m) {
        home_goals = home_goals ?? Number(m[1]);
        away_goals = away_goals ?? Number(m[2]);
      }
    }
  }
  return {
    status: String(row.status ?? "UNKNOWN"),
    home_goals,
    away_goals,
    minute: row.minute ?? null,
    period: typeof row.period === "number" ? row.period : null,
    source: String(row.source ?? "unknown"),
    source_status: row.source_status ?? null,
    observed_at: String(row.observed_at ?? ""),
    finished: Boolean(row.finished),
  };
}

export function classifyEventDetailResponse(
  res: { ok: boolean; status: number },
  json: EventDetailApiJson,
): ClassifiedEventDetail {
  if (hasRenderableDossier(json) && (json.dossier_state === "ok" || json.dossier_state === "local_only" || !json.dossier_state)) {
    if (json.dossier_state === "local_only") {
      return { kind: "local_only", notice_it: json.notice_it ?? EVENT_DETAIL_LOCAL_ONLY_NOTICE_IT };
    }
    return { kind: "ok" };
  }

  if (json.dossier_state === "research_running") {
    return {
      kind: "research_running",
      summary: normalizeBoardSummary(json.board_summary),
      notice_it: json.notice_it ?? EVENT_DETAIL_RESEARCH_RUNNING_IT,
    };
  }

  if (json.dossier_state === "research_failed") {
    return {
      kind: "research_failed",
      summary: normalizeBoardSummary(json.board_summary),
      notice_it: json.notice_it ?? EVENT_DETAIL_RESEARCH_FAILED_IT,
      reason: json.reason ?? EVENT_DETAIL_RESEARCH_FAILED_IT,
    };
  }

  if (isDossierNotMirroredWithBoard(json) || json.dossier_state === "board_only") {
    const summary = normalizeBoardSummary(json.board_summary);
    if (summary) {
      return {
        kind: "board_only",
        summary,
        notice_it: json.notice_it ?? EVENT_DETAIL_BOARD_ONLY_NOTICE_IT,
        reason: json.reason ?? EVENT_DETAIL_BOARD_ONLY_NOTICE_IT,
      };
    }
  }

  if (json.error === "not_found" || json.dossier_state === "not_found" || res.status === 404) {
    return { kind: "not_found", message: formatEventDetailError(json, res.status) };
  }

  if (!res.ok) {
    return { kind: "error", message: formatEventDetailError(json, res.status) };
  }

  return { kind: "ok" };
}
