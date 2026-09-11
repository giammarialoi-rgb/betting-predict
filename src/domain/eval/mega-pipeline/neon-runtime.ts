/**
 * Operational Neon tables for mega pipeline (CREATE IF NOT EXISTS).
 * Same pattern as betmind_runtime_status — not a Drizzle domain migration.
 */
import { neon } from "@neondatabase/serverless";

function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

let ensured = false;

export async function ensureMegaPipelineTables(): Promise<{ ok: boolean; error: string | null }> {
  const sql = sqlClient();
  if (!sql) return { ok: false, error: "DATABASE_URL_MISSING" };
  if (ensured) return { ok: true, error: null };
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS betmind_source_runtime (
        source_id text PRIMARY KEY,
        title text NOT NULL,
        method text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        http_status integer,
        url text,
        bytes integer,
        events_found integer NOT NULL DEFAULT 0,
        fields_extracted jsonb NOT NULL DEFAULT '[]'::jsonb,
        latency_ms integer,
        observed_at timestamptz NOT NULL,
        last_success_at timestamptz,
        last_failure_at timestamptz,
        note text,
        note_it text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS betmind_research_jobs (
        event_id text PRIMARY KEY,
        status text NOT NULL,
        discovered_at timestamptz NOT NULL,
        queued_at timestamptz,
        researched_at timestamptz,
        analyzed_at timestamptz,
        live_at timestamptz,
        finished_at timestamptz,
        settled_at timestamptz,
        data_yield jsonb NOT NULL DEFAULT '{}'::jsonb,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS betmind_prediction_cases (
        prediction_id text PRIMARY KEY,
        event_id text NOT NULL,
        market text NOT NULL,
        selection text NOT NULL,
        prediction_probability double precision,
        odds_at_prediction double precision,
        model_version text,
        prediction_timestamp timestamptz NOT NULL,
        as_of timestamptz,
        status text NOT NULL,
        result text,
        settled_at timestamptz,
        pnl_simulated double precision,
        data_quality double precision,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS betmind_live_states (
        event_id text PRIMARY KEY,
        status text NOT NULL,
        minute integer,
        home_score integer,
        away_score integer,
        halftime text,
        fulltime text,
        source text,
        source_url text,
        observed_at timestamptz NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS betmind_learning_metrics (
        id text PRIMARY KEY,
        scope text NOT NULL,
        scope_key text NOT NULL,
        sample_size integer NOT NULL,
        accuracy double precision,
        brier double precision,
        log_loss double precision,
        win_rate double precision,
        roi_simulated double precision,
        note text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        payload jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `;
    ensured = true;
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function upsertSourceRuntime(row: {
  source_id: string;
  title: string;
  method: string;
  role: string;
  status: string;
  http_status: number | null;
  url: string;
  bytes: number;
  events_found: number;
  fields_extracted: string[];
  latency_ms: number;
  observed_at: string;
  note: string;
  note_it: string;
  ok: boolean;
}): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureMegaPipelineTables();
  const fields = JSON.stringify(row.fields_extracted);
  const success = row.ok ? row.observed_at : null;
  const failure = row.ok ? null : row.observed_at;
  await sql`
    INSERT INTO betmind_source_runtime AS t (
      source_id, title, method, role, status, http_status, url, bytes,
      events_found, fields_extracted, latency_ms, observed_at,
      last_success_at, last_failure_at, note, note_it
    ) VALUES (
      ${row.source_id}, ${row.title}, ${row.method}, ${row.role}, ${row.status},
      ${row.http_status}, ${row.url}, ${row.bytes}, ${row.events_found},
      ${fields}::jsonb, ${row.latency_ms}, ${row.observed_at}::timestamptz,
      ${success}::timestamptz, ${failure}::timestamptz, ${row.note}, ${row.note_it}
    )
    ON CONFLICT (source_id) DO UPDATE SET
      title = EXCLUDED.title,
      method = EXCLUDED.method,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      http_status = EXCLUDED.http_status,
      url = EXCLUDED.url,
      bytes = EXCLUDED.bytes,
      events_found = EXCLUDED.events_found,
      fields_extracted = EXCLUDED.fields_extracted,
      latency_ms = EXCLUDED.latency_ms,
      observed_at = EXCLUDED.observed_at,
      last_success_at = COALESCE(EXCLUDED.last_success_at, t.last_success_at),
      last_failure_at = COALESCE(EXCLUDED.last_failure_at, t.last_failure_at),
      note = EXCLUDED.note,
      note_it = EXCLUDED.note_it
  `;
}

export async function upsertResearchJob(row: {
  event_id: string;
  status: string;
  discovered_at: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureMegaPipelineTables();
  const payload = JSON.stringify(row.payload ?? {});
  await sql`
    INSERT INTO betmind_research_jobs (event_id, status, discovered_at, queued_at, payload, updated_at)
    VALUES (
      ${row.event_id}, ${row.status}, ${row.discovered_at}::timestamptz,
      ${row.discovered_at}::timestamptz, ${payload}::jsonb, now()
    )
    ON CONFLICT (event_id) DO UPDATE SET
      status = CASE
        WHEN betmind_research_jobs.status IN ('SETTLED','FINISHED','LIVE','ANALYZED','RESEARCHED')
          AND EXCLUDED.status = 'DISCOVERED' THEN betmind_research_jobs.status
        ELSE EXCLUDED.status
      END,
      payload = betmind_research_jobs.payload || EXCLUDED.payload,
      updated_at = now()
  `;
}

export async function upsertPredictionCase(row: {
  prediction_id: string;
  event_id: string;
  market: string;
  selection: string;
  prediction_probability: number | null;
  odds_at_prediction: number | null;
  model_version: string | null;
  prediction_timestamp: string;
  as_of: string | null;
  status: string;
  result?: string | null;
  settled_at?: string | null;
  pnl_simulated?: number | null;
  data_quality?: number | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureMegaPipelineTables();
  const payload = JSON.stringify(row.payload ?? {});
  await sql`
    INSERT INTO betmind_prediction_cases (
      prediction_id, event_id, market, selection, prediction_probability,
      odds_at_prediction, model_version, prediction_timestamp, as_of, status,
      result, settled_at, pnl_simulated, data_quality, payload, updated_at
    ) VALUES (
      ${row.prediction_id}, ${row.event_id}, ${row.market}, ${row.selection},
      ${row.prediction_probability}, ${row.odds_at_prediction}, ${row.model_version},
      ${row.prediction_timestamp}::timestamptz, ${row.as_of}::timestamptz, ${row.status},
      ${row.result ?? null}, ${row.settled_at ?? null}::timestamptz,
      ${row.pnl_simulated ?? null}, ${row.data_quality ?? null}, ${payload}::jsonb, now()
    )
    ON CONFLICT (prediction_id) DO UPDATE SET
      status = EXCLUDED.status,
      result = COALESCE(EXCLUDED.result, betmind_prediction_cases.result),
      settled_at = COALESCE(EXCLUDED.settled_at, betmind_prediction_cases.settled_at),
      pnl_simulated = COALESCE(EXCLUDED.pnl_simulated, betmind_prediction_cases.pnl_simulated),
      payload = betmind_prediction_cases.payload || EXCLUDED.payload,
      updated_at = now()
  `;
}

export async function upsertLiveState(row: {
  event_id: string;
  status: string;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  halftime: string | null;
  fulltime: string | null;
  source: string;
  source_url: string;
  observed_at: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sql = sqlClient();
  if (!sql) return;
  await ensureMegaPipelineTables();
  const payload = JSON.stringify(row.payload ?? {});
  await sql`
    INSERT INTO betmind_live_states (
      event_id, status, minute, home_score, away_score, halftime, fulltime,
      source, source_url, observed_at, payload
    ) VALUES (
      ${row.event_id}, ${row.status}, ${row.minute}, ${row.home_score}, ${row.away_score},
      ${row.halftime}, ${row.fulltime}, ${row.source}, ${row.source_url},
      ${row.observed_at}::timestamptz, ${payload}::jsonb
    )
    ON CONFLICT (event_id) DO UPDATE SET
      status = EXCLUDED.status,
      minute = EXCLUDED.minute,
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      halftime = COALESCE(EXCLUDED.halftime, betmind_live_states.halftime),
      fulltime = COALESCE(EXCLUDED.fulltime, betmind_live_states.fulltime),
      source = EXCLUDED.source,
      source_url = EXCLUDED.source_url,
      observed_at = EXCLUDED.observed_at,
      payload = betmind_live_states.payload || EXCLUDED.payload
  `;
}

export async function listPredictionCasesFromNeon(limit = 200): Promise<
  Array<Record<string, unknown>>
> {
  const sql = sqlClient();
  if (!sql) return [];
  await ensureMegaPipelineTables();
  const rows = await sql`
    SELECT * FROM betmind_prediction_cases
    ORDER BY prediction_timestamp DESC
    LIMIT ${limit}
  `;
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function listSourceRuntimeFromNeon(): Promise<Array<Record<string, unknown>>> {
  const sql = sqlClient();
  if (!sql) return [];
  await ensureMegaPipelineTables();
  const rows = await sql`SELECT * FROM betmind_source_runtime ORDER BY source_id`;
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function listLiveStatesFromNeon(): Promise<Array<Record<string, unknown>>> {
  const sql = sqlClient();
  if (!sql) return [];
  await ensureMegaPipelineTables();
  const rows = await sql`SELECT * FROM betmind_live_states ORDER BY observed_at DESC`;
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function listConclusiFromNeon(limit = 100): Promise<Array<Record<string, unknown>>> {
  const sql = sqlClient();
  if (!sql) return [];
  await ensureMegaPipelineTables();
  const rows = await sql`
    SELECT *
    FROM betmind_prediction_cases
    WHERE status IN ('WON','LOST','VOID','PUSH','CANCELLED')
    ORDER BY COALESCE(settled_at, prediction_timestamp) DESC
    LIMIT ${limit}
  `;
  return rows as unknown as Array<Record<string, unknown>>;
}
