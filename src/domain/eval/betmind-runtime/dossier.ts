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
import { buildResearchSummary, type ResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";
import { buildHumanExplanation, type HumanExplanation } from "@/domain/eval/betmind-runtime/explain/italian-explanation";
import { resolveEventTeamIdentity, type EventTeamIdentity } from "@/domain/eval/betmind-runtime/explain/team-identity";
import { assertIndependentOddsFirewall } from "@/domain/eval/betmind-runtime/explain/odds-firewall";
import { predictPoissonIndependentDetailed } from "@/domain/eval/predictive-intelligence/models/poisson-independent";

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

export type DossierResearchRow = {
  source_id: string;
  fetched: boolean;
  ok: boolean;
  phase: string;
  fetched_at: string | null;
  available_at: string | null;
  observed_at: string | null;
  reason: string | null;
  url: string | null;
  http_status: number | null;
  parser_status: string | null;
  fields_extracted: string[];
  adapter_kind: string | null;
  entered_model: false;
};

/** Answers the Phase 3D acceptance questions from persisted artifacts only. */
export type DossierLineageAnswers = {
  what_betmind_knew_before_kickoff: string;
  sources_consulted: string[];
  /** Catalogued but not fetched (MISSING_ADAPTER / POLICY_DENIED). */
  catalogue_noted_not_fetched: string[];
  source_information: Array<{ source_id: string; summary: string }>;
  eligible_information: string[];
  features_entered_model: string[];
  model_version: string | null;
  prediction_produced: string;
  odds_entered_model: false;
  information_missing: string[];
  after_inference: string;
  feature_vector_schema: string[];
  edge_calculated: boolean;
  confidence_defined: boolean;
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
  research: DossierResearchRow[];
  prediction_id: string | null;
  /** Legacy timestamp of prediction row — not "model inference completed". */
  analyzed_at: string | null;
  prediction_persisted_at: string | null;
  lineage: DossierLineageAnswers;
  research_summary?: ResearchSummary;
  human_explanation?: HumanExplanation;
  team_identity?: EventTeamIdentity | null;
  poisson?: { lambda_home: number; lambda_away: number } | null;
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
  const score = (row: Record<string, unknown>) => {
    const cov = typeof row.feature_coverage === "number" ? row.feature_coverage : 0;
    const hasModel =
      row.model_probability && typeof row.model_probability === "object" ? 1 : 0;
    const mv = String(row.model_version ?? "");
    const indep = mv.includes("INDEPENDENT") && !mv.includes("NO_INDEPENDENT") ? 1 : 0;
    return { ts: String(row.at ?? ""), cov, hasModel, indep };
  };
  let best: Record<string, unknown> | null = null;
  const consider = (row: Record<string, unknown>) => {
    if (row.event_id !== eventId) return;
    if (!best) {
      best = row;
      return;
    }
    const a = score(row);
    const b = score(best);
    if (a.ts > b.ts && (a.cov >= b.cov || a.hasModel >= b.hasModel)) best = row;
    else if (a.ts === b.ts && (a.cov > b.cov || a.hasModel > b.hasModel || a.indep > b.indep))
      best = row;
    else if (a.cov > b.cov + 0.1 && a.hasModel >= b.hasModel) best = row;
  };
  const rows = readJsonlTail(snapPath, 1200);
  for (const r of rows) consider(r as Record<string, unknown>);
  if (best) return best;
  try {
    const sizeHint = readFileSync(snapPath, "utf8");
    if (sizeHint.length > 12_000_000) return null;
    const lines = sizeHint.split(/\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        consider(JSON.parse(lines[i]!) as Record<string, unknown>);
      } catch {
        /* skip */
      }
    }
  } catch {
    return null;
  }
  return best;
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
  const rows = readJsonlTail(path, 1200);
  let best: Record<string, unknown> | null = null;
  const score = (row: Record<string, unknown>) => {
    const hasModel = row.probability_model && typeof row.probability_model === "object" ? 1 : 0;
    const mv = String(row.model_version ?? "");
    const indep = mv.includes("INDEPENDENT") && !mv.includes("NO_INDEPENDENT") ? 1 : 0;
    return { ts: String(row.timestamp ?? ""), hasModel, indep };
  };
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    if (row.event_id !== eventId) continue;
    if (!best) {
      best = row;
      continue;
    }
    const a = score(row);
    const b = score(best);
    if (a.ts > b.ts) best = row;
    else if (a.ts === b.ts && (a.hasModel > b.hasModel || a.indep > b.indep)) best = row;
  }
  return best;
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

  const research: DossierResearchRow[] = latestResearchBySource(eventId, labB).map((r) => ({
    source_id: r.source_id,
    fetched: r.fetched === true,
    ok: r.ok === true,
    phase: r.phase,
    fetched_at: r.fetched_at,
    available_at: r.available_at,
    observed_at: r.observed_at ?? r.fetched_at ?? null,
    reason: r.reason,
    url: r.url ?? null,
    http_status: r.http_status ?? null,
    parser_status: r.parser_status ?? null,
    fields_extracted: r.fields_extracted ?? [],
    adapter_kind: r.adapter_kind ?? null,
    entered_model: false as const,
  }));

  const marketP =
    typeof decision?.market_probability === "number" ? (decision.market_probability as number) : null;

  const entered = features.filter((f) => f.entered_model);
  const eligibleNames = features.filter((f) => f.status === "ELIGIBLE").map((f) => f.name);
  const missing: string[] = [];
  if (!probability_model) missing.push("independent probability_model (null)");
  if (entered.length === 0) missing.push("eligible independent features with values");
  if (research.every((r) => !r.ok && r.phase !== "OK")) {
    missing.push("successful independent research observations with available_at");
  }
  for (const f of features) {
    if (f.value == null || f.status !== "ELIGIBLE") {
      if (missing.length < 24) missing.push(`feature:${f.name} (${f.status})`);
    }
  }
  const consulted = research.filter(
    (r) =>
      r.fetched === true ||
      r.phase === "OK" ||
      r.phase === "BLOCKED" ||
      (r.adapter_kind === "CACHE_ONLY" && r.parser_status != null) ||
      (r.adapter_kind === "PRODUCTION_ADAPTER" && r.fetched === true),
  );
  const catalogueNoted = research.filter(
    (r) => r.phase === "MISSING_ADAPTER" || r.phase === "DENIED",
  );
  const conf =
    typeof pred?.confidence_score === "number"
      ? (pred.confidence_score as number)
      : typeof decision?.confidence === "number"
        ? (decision.confidence as number)
        : null;
  const edgeAbs =
    typeof pred?.edge_absolute === "number"
      ? (pred.edge_absolute as number)
      : typeof decision?.estimated_edge === "number"
        ? (decision.estimated_edge as number)
        : null;
  const modelVersion =
    (pred?.model_version as string | null) ??
    (decision?.model_version as string | null) ??
    (brain.model_version as string | null) ??
    null;
  const persistedAt =
    (pred?.timestamp as string | null) ??
    (decision?.timestamp as string | null) ??
    (reasoning?.at as string | null) ??
    null;

  const lineage: DossierLineageAnswers = {
    what_betmind_knew_before_kickoff: probability_model
      ? `Independent model HDA available; ${entered.length} features entered MODEL.`
      : `No independent model probability. Feature bag size=${features.length}; entered_model=${entered.length}. Market compare may exist but is NOT model knowledge.`,
    sources_consulted: consulted.map((r) => r.source_id),
    source_information: research.map((r) => ({
      source_id: r.source_id,
      summary: [
        `phase=${r.phase}`,
        r.adapter_kind ? `adapter=${r.adapter_kind}` : null,
        r.http_status != null ? `http=${r.http_status}` : null,
        r.parser_status ? `parser=${r.parser_status}` : null,
        r.fields_extracted.length ? `fields=${r.fields_extracted.join(",")}` : "fields=none",
        r.available_at ? `available_at=${r.available_at}` : "available_at=null",
        r.reason ?? "",
      ]
        .filter(Boolean)
        .join("; "),
    })),
    catalogue_noted_not_fetched: catalogueNoted.map((r) => r.source_id),
    eligible_information: eligibleNames,
    features_entered_model: entered.map((f) => `${f.name}=${String(f.value)}`),
    model_version: modelVersion,
    prediction_produced: probability_model
      ? `INDEPENDENT ${JSON.stringify(probability_model)}`
      : pred
        ? `PERSISTED_ROW_WITHOUT_INFERENCE reason_codes=${((pred.reason_codes as string[]) ?? []).slice(0, 8).join(",")}`
        : "NO_PREDICTION_ROW",
    odds_entered_model: false,
    information_missing: missing.slice(0, 40),
    after_inference: probability_model
      ? decision
        ? `Decision persisted: ${String(decision.decision)}`
        : "Model inference present; decision row may be absent"
      : decision
        ? `No model inference. Decision persisted as ${String(decision.decision)} (often NO_BET / insufficient). Prediction row ${pred ? "present" : "absent"}.`
        : "No independent inference; prediction/decision may still be persisted for audit.",
    feature_vector_schema: Object.keys(
      (reasoning?.feature_snapshot as Record<string, unknown> | undefined) ??
        Object.fromEntries(features.map((f) => [f.name, f.value])),
    ),
    edge_calculated: edgeAbs != null && Number.isFinite(edgeAbs),
    confidence_defined: conf != null && Number.isFinite(conf),
  };

  const base: AnalysisDossier = {
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
      model_version: String(modelVersion ?? "N/A"),
    },
    independent_model: {
      probability: probability_model,
      model_version: (pred?.model_version as string | null) ?? null,
      confidence: conf,
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
        : "NO DATA AVAILABLE — probability_model assente (spesso INSUFFICIENT_DATA / feature sparse). Non chiamare questo evento MODEL INFERENCE.",
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
        : entered.length === 0
          ? "Feature bag presente ma nessuna feature ELIGIBLE è entrata nel modello indipendente."
          : null,
    research,
    prediction_id: (pred?.prediction_id as string | null) ?? null,
    analyzed_at: persistedAt,
    prediction_persisted_at: persistedAt,
    lineage,
    real_money: false,
  };

  assertIndependentOddsFirewall({
    featureKeys: features.map((f) => f.name),
    enteredKeys: entered.map((f) => f.name),
    oddsEnteredModel: false,
  });

  const homeName = String(event.home_or_a ?? "N/A");
  const awayName = String(event.away_or_b ?? "N/A");
  let team_identity: EventTeamIdentity | null = null;
  try {
    team_identity = resolveEventTeamIdentity({
      home: homeName,
      away: awayName,
      competition: String(event.competition ?? ""),
      labBRoot: labB,
    });
  } catch {
    team_identity = null;
  }

  const research_summary = buildResearchSummary({
    home: homeName,
    away: awayName,
    features,
    research,
    prediction_time: persistedAt,
    model_version: String(modelVersion ?? pred?.model_version ?? ""),
    feature_coverage:
      typeof reasoning?.feature_coverage === "number"
        ? (reasoning.feature_coverage as number)
        : null,
    has_independent_inference: Boolean(probability_model),
    event_identified_at: (event.collected_at_utc as string | null) ?? persistedAt,
  });

  const storedPoisson =
    reasoning &&
    reasoning.poisson &&
    typeof (reasoning.poisson as { lambda_home?: number }).lambda_home === "number"
      ? (reasoning.poisson as { lambda_home: number; lambda_away: number })
      : null;
  let poisson = storedPoisson;
  if (!poisson && probability_model && reasoning?.feature_snapshot) {
    const values = reasoning.feature_snapshot as Record<string, number | null>;
    const hasAttack = values.home_attack_home != null || values.home_gf_l5 != null;
    if (hasAttack) {
      const detail = predictPoissonIndependentDetailed({
        features: {
          example: {} as never,
          values,
          feature_data: [],
          missing_keys: [],
          data_coverage: 1,
          feature_coverage: 1,
          data_quality: 1,
          features_version: "features_pi_v1",
          closing_odds_used: false,
        },
      });
      poisson = { lambda_home: detail.lambda_home, lambda_away: detail.lambda_away };
    }
  }

  const human_explanation = buildHumanExplanation({
    home: homeName,
    away: awayName,
    probability: probability_model,
    summary: research_summary,
    poisson,
    reason_codes: (pred?.reason_codes as string[]) ?? [],
  });

  return {
    ...base,
    research_summary,
    human_explanation,
    team_identity,
    poisson,
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
    research: d.research.slice(0, 40),
    prediction_id: d.prediction_id,
    analyzed_at: d.analyzed_at,
    prediction_persisted_at: d.prediction_persisted_at,
    lineage: d.lineage,
    research_summary: d.research_summary,
    human_explanation: d.human_explanation,
    team_identity: d.team_identity,
    poisson: d.poisson ?? null,
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
  } catch (e) {
    console.warn(
      `[dossier-neon] upsert failed event=${dossier.event.event_id}:`,
      e instanceof Error ? e.message : e,
    );
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

/** Board row from Neon — identity check only; never silently treat as full dossier. */
export async function loadBoardEventNeon(
  eventId: string,
): Promise<Record<string, unknown> | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const rows = (await sql`
      SELECT event_id, bucket, payload, published_at::text AS published_at
      FROM betmind_board_events
      WHERE event_id = ${eventId}
      LIMIT 1
    `) as Array<{
      event_id: string;
      bucket: string | null;
      payload: Record<string, unknown> | string;
      published_at: string;
    }>;
    const row = rows[0];
    if (!row) return null;
    const payload =
      typeof row.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : row.payload;
    return {
      ...payload,
      event_id: row.event_id,
      bucket: row.bucket ?? payload.bucket ?? null,
      published_at: row.published_at,
    };
  } catch {
    return null;
  }
}

/**
 * Mirror Lab B analysis dossiers to Neon for Vercel `/events/[id]`.
 * Prefers ANALYZED / independent-inference events; never invents dossiers.
 */
export async function mirrorDossiersToNeon(
  labB = permanentRoot044(),
  opts: { limit?: number; eventIds?: string[] } = {},
): Promise<{ attempted: number; upserted: number; skipped: number }> {
  const limit = opts.limit ?? 150;
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  if (opts.eventIds?.length) {
    for (const id of opts.eventIds) push(String(id));
  } else {
    const { buildLiteNextEvents } = await import("@/domain/eval/betmind-runtime/board");
    const board = buildLiteNextEvents(labB, Date.now(), 200);
    for (const row of board) {
      if (String(row.bucket) === "ANALYZED") push(String(row.event_id));
    }
    for (const row of board) push(String(row.event_id));
    const predTail = readJsonlTail(join(labB, "predictions.jsonl"), 800);
    for (const r of predTail) {
      const row = r as Record<string, unknown>;
      const mv = String(row.model_version ?? "");
      const indep =
        row.probability_model &&
        typeof row.probability_model === "object" &&
        mv.includes("INDEPENDENT") &&
        !mv.includes("NO_INDEPENDENT");
      if (indep) push(String(row.event_id ?? ""));
    }
  }

  let upserted = 0;
  let skipped = 0;
  let attempted = 0;
  for (const eid of ids) {
    if (upserted >= limit) break;
    attempted += 1;
    const d = buildAnalysisDossier(eid, labB);
    if (!d) {
      skipped += 1;
      continue;
    }
    await upsertDossierNeon(d);
    upserted += 1;
  }
  return { attempted, upserted, skipped };
}
