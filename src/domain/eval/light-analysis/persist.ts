/**
 * Persist light analyses to disk (data/ + Lab B).
 * NEON NON UTILIZZATO — no operational table, no DATABASE_URL fallback.
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

export async function ensureLightAnalysisTable(): Promise<boolean> {
  return false;
}

/** Neon writes are banned. Kept as a no-op so call sites compile. */
export async function upsertLightAnalysisNeon(row: LightAnalysis): Promise<boolean> {
  void row;
  return false;
}

function hasOkMarket(row: LightAnalysis): boolean {
  return row.markets.some((m) => m.status === "OK" && m.probability != null);
}

/** Do not replace a measured light row with an empty recompute (Vercel without CSV). */
export function shouldReplaceLightAnalysis(
  incoming: LightAnalysis,
  existing: LightAnalysis | null,
): boolean {
  if (!existing) return true;
  if (hasOkMarket(incoming)) return true;
  if (!hasOkMarket(existing)) return true;
  return false;
}

export async function persistLightAnalysis(row: LightAnalysis, cwd = process.cwd()): Promise<void> {
  const existing = await loadLightAnalysis(row.event_id, cwd);
  if (!shouldReplaceLightAnalysis(row, existing)) {
    return;
  }
  persistLightAnalysisDisk(row, cwd);
}

export async function loadLightAnalysisNeon(eventId: string): Promise<LightAnalysis | null> {
  void eventId;
  return null;
}

export async function loadLightAnalysesNeon(): Promise<LightAnalysis[]> {
  return [];
}

export async function loadLightAnalysis(eventId: string, cwd = process.cwd()): Promise<LightAnalysis | null> {
  return loadLightAnalysisFromDisk(eventId, cwd);
}

export async function loadAllLightAnalyses(cwd = process.cwd()): Promise<LightAnalysis[]> {
  return loadLightAnalysesFromDisk(cwd);
}
