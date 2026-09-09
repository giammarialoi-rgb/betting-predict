/**
 * Analysis dossier — join event identity + prediction + features + research.
 * Never invents values; missing → explicit NO DATA AVAILABLE.
 */
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import { loadBrainState051 } from "@/domain/eval/brain-051/config";
import { latestResearchBySource } from "@/domain/eval/data-intelligence/research/status";
import type { FeatureDatum } from "@/domain/eval/predictive-intelligence/types";
import { readJsonlTail } from "@/domain/eval/betmind-runtime/board";

export type UiFeatureStatus =
  | "ELIGIBLE"
  | "UNAVAILABLE"
  | "STALE"
  | "INVALID"
  | "INSUFFICIENT";

export type DossierFeatureRow = {
  name: string;
  value: number | string | null;
  source: string;
  observed_at: string | null;
  available_at: string | null;
  status: UiFeatureStatus;
  entered_model: boolean;
};

export type AnalysisDossier = {
  event: {
    event_id: string;
    home: string;
    away: string;
    competition: string;
    kickoff_utc: string | null;
    sport: string;
    status: string;
  };
  cycle: {
    cycle_number: number | null;
    last_cycle_at: string | null;
    last_successful_cycle_at: string | null;
    model_version: string | null;
  };
  independent_model: {
    probability: Record<string, number> | null;
    model_version: string | null;
    confidence: number | null;
    feature_coverage: number | null;
    data_coverage: number | null;
    decision: string | null;
    reason_codes: string[];
    why: Record<string, unknown> | null;
    note: string | null;
  };
  market: {
    probability: Record<string, number> | null;
    selection_pct: number | null;
    note: string;
  };
  features: DossierFeatureRow[];
  features_note: string | null;
  research: Array<{
    source_id: string;
    fetched: boolean;
    ok: boolean;
    phase: string;
    fetched_at: string | null;
    available_at: string | null;
    reason: string | null;
  }>;
  prediction_id: string | null;
  analyzed_at: string | null;
  real_money: false;
};

function mapFeatureStatus(d: FeatureDatum): UiFeatureStatus {
  if (d.status === "ELIGIBLE") return "ELIGIBLE";
  if (d.status === "UNAVAILABLE") return "UNAVAILABLE";
  if (d.temporal_precision === "UNKNOWN" || d.available_at == null) return "INSUFFICIENT";
  if (d.status === "NOT_ELIGIBLE") return "INSUFFICIENT";
  return "INVALID";
}

export function reasoningIndexPath(labB = permanentRoot044()): string {
  return join(piRoot(labB), "reasoning", "by-event-index.jsonl");
}

export function appendReasoningIndex(
  eventId: string,
  at: string,
  labB?: string,
): void {
  const root = join(piRoot(labB), "reasoning");
  mkdirSync(root, { recursive: true });
  appendFileSync(
    join(root, "by-event-index.jsonl"),
    `${JSON.stringify({ event_id: eventId, at })}\n`,
    "utf8",
  );
}

function findLatestReasoning(
  eventId: string,
  labB = permanentRoot044(),
): Record<string, unknown> | null {
  const snapPath = join(piRoot(labB), "reasoning", "snapshots.jsonl");
  if (!existsSync(snapPath)) return null;
  // Tail-first scan (newest last in append-only file)
  const rows = readJsonlTail(snapPath, 800);
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    if (row.event_id === eventId) return row;
  }
  // Fallback: slow full scan only if tail miss (small files)
  try {
    const sizeHint = readFileSync(snapPath, "utf8");
    if (sizeHint.length > 12_000_000) return null;
    const lines = sizeHint.split(/\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(lines[i]!) as Record<string, unknown>;
        if (row.event_id === eventId) return row;
      } catch {
        /* skip */
      }
    }
  } catch {
    return null;
  }
  return null;
}

function findEvent(root: string, id: string): Record<string, unknown> | null {
  const p = join(root, "events.jsonl");
  if (!existsSync(p)) return null;
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const row = JSON.parse(line.replace(/^\uFEFF/, "")) as Record<string, unknown>;
      if (row.event_id === id) return row;
    } catch {
      /* skip */
    }
  }
  return null;
}

function findLatestJsonl(
  path: string,
  eventId: string,
): Record<string, unknown> | null {
  const rows = readJsonlTail(path, 600);
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    if (row.event_id === eventId) return row;
  }
  return null;
}

export function buildAnalysisDossier(
  eventId: string,
  labB = permanentRoot044(),
): AnalysisDossier | null {
  const event = findEvent(labB, eventId);
  if (!event) return null;

  const brain = loadBrainState051(labB);
  const pred = findLatestJsonl(join(labB, "predictions.jsonl"), eventId);
  const decision = findLatestJsonl(join(labB, "decisions.jsonl"), eventId);
  const reasoning = findLatestReasoning(eventId, labB);

  const probability_model =
    pred?.probability_model && typeof pred.probability_model === "object"
      ? (pred.probability_model as Record<string, number>)
      : null;
  const probability_market =
    pred?.probability_market && typeof pred.probability_market === "object"
      ? (pred.probability_market as Record<string, number>)
      : null;

  const featureData = (reasoning?.feature_data as FeatureDatum[] | undefined) ?? [];
  const featureSnapshot =
    (reasoning?.feature_snapshot as Record<string, number | null> | undefined) ?? {};
  const features: DossierFeatureRow[] = [];

  if (featureData.length > 0) {
    for (const d of featureData) {
      features.push({
        name: d.key,
        value: d.value,
        source: d.source,
        observed_at: d.feature_time ?? null,
        available_at: d.available_at,
        status: mapFeatureStatus(d),
        entered_model: d.status === "ELIGIBLE" && d.value != null,
      });
    }
  } else {
    for (const [k, v] of Object.entries(featureSnapshot)) {
      features.push({
        name: k,
        value: v,
        source: "feature_snapshot",
        observed_at: (reasoning?.at as string | null) ?? null,
        available_at: null,
        status: v == null ? "INSUFFICIENT" : "ELIGIBLE",
        entered_model: v != null,
      });
    }
  }

  const research = latestResearchBySource(eventId, labB).map((r) => ({
    source_id: r.source_id,
    fetched: r.fetched === true,
    ok: r.ok === true,
    phase: r.phase,
    fetched_at: r.fetched_at,
    available_at: r.available_at,
    reason: r.reason,
  }));

  const marketP =
    typeof decision?.market_probability === "number" ? (decision.market_probability as number) : null;

  return {
    event: {
      event_id: eventId,
      home: String(event.home_or_a ?? "N/A"),
      away: String(event.away_or_b ?? "N/A"),
      competition: String(event.competition ?? "N/A"),
      kickoff_utc: (event.kickoff_utc as string | null) ?? null,
      sport: String(event.sport ?? "UNKNOWN"),
      status: String(event.status ?? "N/A"),
    },
    cycle: {
      cycle_number: brain.cycles_completed ?? null,
      last_cycle_at: brain.last_cycle_at,
      last_successful_cycle_at: brain.last_successful_cycle_at,
      model_version: String(
        pred?.model_version ?? decision?.model_version ?? brain.model_version ?? "N/A",
      ),
    },
    independent_model: {
      probability: probability_model,
      model_version: (pred?.model_version as string | null) ?? null,
      confidence:
        typeof pred?.confidence_score === "number"
          ? (pred.confidence_score as number)
          : typeof decision?.confidence === "number"
            ? (decision.confidence as number)
            : null,
      feature_coverage:
        typeof reasoning?.feature_coverage === "number"
          ? (reasoning.feature_coverage as number)
          : null,
      data_coverage:
        typeof reasoning?.data_coverage === "number" ? (reasoning.data_coverage as number) : null,
      decision: decision ? String(decision.decision) : null,
      reason_codes: (pred?.reason_codes as string[]) ?? [],
      why: (reasoning?.why as Record<string, unknown> | null) ?? null,
      note: probability_model
        ? null
        : "NO DATA AVAILABLE — probability_model assente (spesso INSUFFICIENT_DATA / feature sparse)",
    },
    market: {
      probability: probability_market,
      selection_pct: marketP,
      note: "Le quote e le probabilità di mercato sono solo confronto — non entrano nel modello indipendente.",
    },
    features,
    features_note:
      features.length === 0
        ? "NO DATA AVAILABLE — nessuno snapshot di reasoning/feature per questo evento"
        : null,
    research,
    prediction_id: (pred?.prediction_id as string | null) ?? null,
    analyzed_at:
      (pred?.timestamp as string | null) ??
      (decision?.timestamp as string | null) ??
      (reasoning?.at as string | null) ??
      null,
    real_money: false,
  };
}

/** Compact dossier for Neon mirror (cap features/research). */
export function compactDossierForMirror(d: AnalysisDossier): Record<string, unknown> {
  return {
    event: d.event,
    cycle: d.cycle,
    independent_model: d.independent_model,
    market: d.market,
    features: d.features.slice(0, 80),
    features_note: d.features_note,
    research: d.research.slice(0, 30),
    prediction_id: d.prediction_id,
    analyzed_at: d.analyzed_at,
    real_money: false,
  };
}

export async function upsertDossierNeon(dossier: AnalysisDossier): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    await sql`
      CREATE TABLE IF NOT EXISTS betmind_analysis_dossiers (
        event_id text PRIMARY KEY,
        published_at timestamptz NOT NULL DEFAULT now(),
        payload jsonb NOT NULL
      )
    `;
    const payload = JSON.stringify(compactDossierForMirror(dossier));
    await sql`
      INSERT INTO betmind_analysis_dossiers (event_id, published_at, payload)
      VALUES (${dossier.event.event_id}, ${new Date().toISOString()}::timestamptz, ${payload}::jsonb)
      ON CONFLICT (event_id) DO UPDATE
      SET published_at = EXCLUDED.published_at,
          payload = EXCLUDED.payload
    `;
  } catch {
    /* mirror optional */
  }
}

export async function loadDossierNeon(eventId: string): Promise<AnalysisDossier | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const rows = (await sql`
      SELECT payload FROM betmind_analysis_dossiers WHERE event_id = ${eventId} LIMIT 1
    `) as Array<{ payload: AnalysisDossier | string }>;
    const row = rows[0];
    if (!row) return null;
    return typeof row.payload === "string"
      ? (JSON.parse(row.payload) as AnalysisDossier)
      : row.payload;
  } catch {
    return null;
  }
}
