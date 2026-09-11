/**
 * Persist light analyses to disk and Neon operational table.
 * CREATE TABLE IF NOT EXISTS — same pattern as betmind_analysis_dossiers.
 * Not a Drizzle schema migration.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import type { LightAnalysis } from "@/domain/eval/light-analysis/types";

export function lightAnalysisDiskPath(cwd = process.cwd()): string {
  return join(cwd, "data", "light-analysis", "analyses.jsonl");
}

export function lightAnalysisLabPath(): string {
  return join(permanentRoot044(), "light-analyses.jsonl");
}

function parseJsonl(path: string): LightAnalysis[] {
  if (!existsSync(path)) return [];
  const out: LightAnalysis[] = [];
  for (const line of readFileSync(path, "utf8").split(/\n/).filter(Boolean)) {
    try {
      out.push(JSON.parse(line.replace(/^\uFEFF/, "")) as LightAnalysis);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function loadLightAnalysesFromDisk(cwd = process.cwd()): LightAnalysis[] {
  const byId = new Map<string, LightAnalysis>();
  for (const path of [lightAnalysisDiskPath(cwd), lightAnalysisLabPath()]) {
    for (const row of parseJsonl(path)) {
      if (!row?.event_id) continue;
      const prev = byId.get(row.event_id);
      if (!prev || String(row.analyzed_at) >= String(prev.analyzed_at)) {
        byId.set(row.event_id, row);
      }
    }
  }
  return [...byId.values()];
}

export function loadLightAnalysisFromDisk(eventId: string, cwd = process.cwd()): LightAnalysis | null {
  const rows = loadLightAnalysesFromDisk(cwd).filter((r) => r.event_id === eventId);
  if (!rows.length) return null;
  rows.sort((a, b) => String(b.analyzed_at).localeCompare(String(a.analyzed_at)));
  return rows[0] ?? null;
}

function rewriteLatest(path: string, row: LightAnalysis): void {
  mkdirSync(dirname(path), { recursive: true });
  const existing = parseJsonl(path).filter((r) => r.event_id !== row.event_id);
  existing.push(row);
  writeFileSync(path, `${existing.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");
}

export function persistLightAnalysisDisk(row: LightAnalysis, cwd = process.cwd()): void {
  try {
    rewriteLatest(lightAnalysisDiskPath(cwd), row);
  } catch {
    try {
      const p = lightAnalysisDiskPath(cwd);
      mkdirSync(dirname(p), { recursive: true });
      appendFileSync(p, `${JSON.stringify(row)}\n`, "utf8");
    } catch {
      /* ephemeral FS */
    }
  }
  try {
    rewriteLatest(lightAnalysisLabPath(), row);
  } catch {
    /* lab store optional */
  }
}

async function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { neon } = await import("@neondatabase/serverless");
  return neon(url);
}

export async function ensureLightAnalysisTable(): Promise<boolean> {
  const sql = await sqlClient();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS betmind_light_analyses (
      event_id text PRIMARY KEY,
      published_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL
    )
  `;
  return true;
}

export async function upsertLightAnalysisNeon(row: LightAnalysis): Promise<boolean> {
  const sql = await sqlClient();
  if (!sql) return false;
  try {
    await ensureLightAnalysisTable();
    await sql`
      INSERT INTO betmind_light_analyses (event_id, published_at, payload)
      VALUES (${row.event_id}, ${row.analyzed_at}::timestamptz, ${JSON.stringify(row)}::jsonb)
      ON CONFLICT (event_id) DO UPDATE
      SET published_at = EXCLUDED.published_at,
          payload = EXCLUDED.payload
    `;
    return true;
  } catch (e) {
    console.warn(
      `[light-analysis] neon upsert failed event=${row.event_id}:`,
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

export async function persistLightAnalysis(row: LightAnalysis, cwd = process.cwd()): Promise<void> {
  persistLightAnalysisDisk(row, cwd);
  await upsertLightAnalysisNeon(row);
}

function asAnalysis(payload: unknown): LightAnalysis | null {
  if (!payload) return null;
  const row = typeof payload === "string" ? (JSON.parse(payload) as LightAnalysis) : (payload as LightAnalysis);
  if (!row?.event_id || !Array.isArray(row.markets)) return null;
  return row;
}

export async function loadLightAnalysisNeon(eventId: string): Promise<LightAnalysis | null> {
  const sql = await sqlClient();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT payload FROM betmind_light_analyses WHERE event_id = ${eventId} LIMIT 1
    `) as Array<{ payload: unknown }>;
    return asAnalysis(rows[0]?.payload);
  } catch {
    return null;
  }
}

export async function loadLightAnalysesNeon(): Promise<LightAnalysis[]> {
  const sql = await sqlClient();
  if (!sql) return [];
  try {
    const rows = (await sql`
      SELECT payload FROM betmind_light_analyses
    `) as Array<{ payload: unknown }>;
    return rows.map((r) => asAnalysis(r.payload)).filter((r): r is LightAnalysis => r != null);
  } catch {
    return [];
  }
}

export async function loadLightAnalysis(eventId: string, cwd = process.cwd()): Promise<LightAnalysis | null> {
  return loadLightAnalysisFromDisk(eventId, cwd) ?? (await loadLightAnalysisNeon(eventId));
}

export async function loadAllLightAnalyses(cwd = process.cwd()): Promise<LightAnalysis[]> {
  const byId = new Map<string, LightAnalysis>();
  for (const row of loadLightAnalysesFromDisk(cwd)) {
    byId.set(row.event_id, row);
  }
  for (const row of await loadLightAnalysesNeon()) {
    const prev = byId.get(row.event_id);
    if (!prev || String(row.analyzed_at) >= String(prev.analyzed_at)) {
      byId.set(row.event_id, row);
    }
  }
  return [...byId.values()];
}
