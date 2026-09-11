/**
 * Load finished-match history for analisi light on hosts without local CSVs.
 *
 * Production / Vercel does not ship Club-Football Matches.csv or the
 * football-data-co-uk acquisition folder (often 0-byte / gitignored).
 * Refresh therefore fetches free football-data.co.uk result CSVs over HTTP
 * (apex host first, then www). Odds columns are parsed then ignored.
 *
 * Cache: in-memory → /tmp → Neon jsonb → optional disk. `force` re-fetches.
 * No WAF bypass: 403/503 stay blocked for that URL; we try the next host/pack.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  OPENFOOTBALL_PACKS,
  currentFootballDataSeasonCode,
  openFootballUrl,
} from "@/domain/eval/acquisition-engine/catalog";
import { parseOpenFootballPack } from "@/domain/eval/acquisition-engine/sources/openfootball";
import {
  loadHistoricalMatches,
  parseFootballDataCoUkHistory,
} from "@/domain/eval/light-analysis/history";
import type { HistoricalMatchRow } from "@/domain/eval/light-analysis/types";

export const LIGHT_HISTORY_DIVISIONS = [
  "E0",
  "E1",
  "SP1",
  "I1",
  "D1",
  "F1",
  "N1",
  "P1",
  "SC0",
  "B1",
] as const;

export const LIGHT_HISTORY_CACHE_KEY = "default";
const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_CONCURRENCY = 6;
const CSV_MIN_BYTES = 200;

export type LightHistoryPack = {
  url: string;
  ok: boolean;
  status: number | null;
  rows: number;
  error: string | null;
};

export type LightHistoryReport = {
  rows: HistoricalMatchRow[];
  fetched_at: string;
  from_cache: boolean;
  cache: "memory" | "tmp" | "neon" | "disk" | "http" | "empty";
  seasons: string[];
  divisions: string[];
  packs: LightHistoryPack[];
  note_it: string;
};

type CachedBlob = {
  fetched_at: string;
  seasons: string[];
  divisions: string[];
  rows: HistoricalMatchRow[];
};

let memory: { at: number; blob: CachedBlob } | null = null;

export function previousFootballDataSeasonCode(current: string): string {
  const a = Number(current.slice(0, 2));
  if (!Number.isFinite(a)) return current;
  const prevA = a === 0 ? 99 : a - 1;
  return `${String(prevA).padStart(2, "0")}${String(a).padStart(2, "0")}`;
}

export function lightHistorySeasonCodes(dayIso: string): string[] {
  const current = currentFootballDataSeasonCode(dayIso);
  const previous = previousFootballDataSeasonCode(current);
  return previous === current ? [current] : [current, previous];
}

export function footballDataCsvUrls(season: string, division: string): string[] {
  return [
    `https://football-data.co.uk/mmz4281/${season}/${division}.csv`,
    `https://www.football-data.co.uk/mmz4281/${season}/${division}.csv`,
  ];
}

export function looksLikeFdoukCsv(text: string): boolean {
  const head = text.slice(0, 400);
  if (/<html/i.test(head) || /temporarily unavailable/i.test(head)) return false;
  return /HomeTeam/i.test(head) && /FTHG/i.test(head);
}

function tmpPath(): string {
  return join("/tmp", "betmind-light-history.json");
}

function diskCachePath(cwd: string): string {
  return join(cwd, "data", "light-analysis", "history.json");
}

function asBlob(raw: unknown): CachedBlob | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as CachedBlob;
  if (!Array.isArray(rec.rows) || !rec.fetched_at) return null;
  return {
    fetched_at: String(rec.fetched_at),
    seasons: Array.isArray(rec.seasons) ? rec.seasons.map(String) : [],
    divisions: Array.isArray(rec.divisions) ? rec.divisions.map(String) : [],
    rows: rec.rows.filter((r) => r && r.home && r.away && r.date && r.home_goals != null),
  };
}

function readJsonFile(path: string): CachedBlob | null {
  try {
    if (!existsSync(path)) return null;
    return asBlob(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, blob: CachedBlob): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    /* ignore */
  }
  try {
    writeFileSync(path, JSON.stringify(blob), "utf8");
  } catch {
    /* ephemeral / permission */
  }
}

async function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { neon } = await import("@neondatabase/serverless");
  return neon(url);
}

export async function ensureLightHistoryTable(): Promise<boolean> {
  const sql = await sqlClient();
  if (!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS betmind_light_history (
      cache_key text PRIMARY KEY,
      published_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL
    )
  `;
  return true;
}

export async function loadLightHistoryNeon(): Promise<CachedBlob | null> {
  const sql = await sqlClient();
  if (!sql) return null;
  try {
    const rows = (await sql`
      SELECT payload FROM betmind_light_history
      WHERE cache_key = ${LIGHT_HISTORY_CACHE_KEY}
      LIMIT 1
    `) as Array<{ payload: unknown }>;
    return asBlob(rows[0]?.payload);
  } catch {
    return null;
  }
}

export async function saveLightHistoryNeon(blob: CachedBlob): Promise<boolean> {
  const sql = await sqlClient();
  if (!sql) return false;
  try {
    await ensureLightHistoryTable();
    await sql`
      INSERT INTO betmind_light_history (cache_key, published_at, payload)
      VALUES (${LIGHT_HISTORY_CACHE_KEY}, ${blob.fetched_at}::timestamptz, ${JSON.stringify(blob)}::jsonb)
      ON CONFLICT (cache_key) DO UPDATE
      SET published_at = EXCLUDED.published_at,
          payload = EXCLUDED.payload
    `;
    return true;
  } catch (e) {
    console.warn(
      "[light-history] neon upsert failed:",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

function persistLocal(blob: CachedBlob, cwd: string): void {
  memory = { at: Date.now(), blob };
  writeJsonFile(tmpPath(), blob);
  writeJsonFile(diskCachePath(cwd), blob);
}

function rowKey(row: HistoricalMatchRow): string {
  return `${row.date}|${row.home}|${row.away}|${row.home_goals}|${row.away_goals}`;
}

export function mergeHistoryRows(...lists: readonly HistoricalMatchRow[][]): HistoricalMatchRow[] {
  const by = new Map<string, HistoricalMatchRow>();
  for (const list of lists) {
    for (const row of list) {
      const k = rowKey(row);
      if (!by.has(k)) by.set(k, row);
    }
  }
  return [...by.values()];
}

export function parseOpenFootballHistory(
  jsonText: string,
  leagueHint = "",
): HistoricalMatchRow[] {
  const pack = parseOpenFootballPack(jsonText);
  const out: HistoricalMatchRow[] = [];
  for (const m of pack.matches) {
    const home = String(m.team1 ?? "").trim();
    const away = String(m.team2 ?? "").trim();
    const date = String(m.date ?? "").slice(0, 10);
    if (!home || !away || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const rec = m as OpenFootballMatchScore;
    const ft = rec.score?.ft ?? rec.ft;
    if (!Array.isArray(ft) || ft.length < 2) continue;
    const hg = Number(ft[0]);
    const ag = Number(ft[1]);
    if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
    out.push({
      home,
      away,
      date,
      home_goals: hg,
      away_goals: ag,
      home_corners: null,
      away_corners: null,
      league: leagueHint || pack.name || null,
      source_id: "openfootball",
    });
  }
  return out;
}

type OpenFootballMatchScore = {
  team1?: string;
  team2?: string;
  date?: string;
  score?: { ft?: unknown };
  ft?: unknown;
};

async function fetchText(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ status: number | null; text: string; error: string | null }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "text/csv,text/plain,application/json,*/*",
          "User-Agent": "betmind-light-history/1.0 (ordinary GET; no WAF bypass)",
        },
        redirect: "follow",
        signal: ctrl.signal,
      });
      const text = await res.text();
      return { status: res.status, text, error: res.ok ? null : `HTTP_${res.status}` };
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    return { status: null, text: "", error: e instanceof Error ? e.message : String(e) };
  }
}

async function mapPool<T, R>(items: readonly T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

export type FetchLightHistoryInput = {
  cwd?: string;
  force?: boolean;
  dayIso?: string;
  fetchImpl?: typeof fetch;
  includeOpenFootball?: boolean;
  persistNeon?: boolean;
};

export async function fetchFootballDataHistory(input: {
  seasons: readonly string[];
  divisions?: readonly string[];
  fetchImpl?: typeof fetch;
}): Promise<{ rows: HistoricalMatchRow[]; packs: LightHistoryPack[] }> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const divisions = input.divisions ?? LIGHT_HISTORY_DIVISIONS;
  const jobs = input.seasons.flatMap((season) =>
    divisions.map((division) => ({ season, division })),
  );

  const packs: LightHistoryPack[] = [];
  const rows: HistoricalMatchRow[] = [];

  await mapPool(jobs, FETCH_CONCURRENCY, async ({ season, division }) => {
    let last: LightHistoryPack = {
      url: footballDataCsvUrls(season, division)[0]!,
      ok: false,
      status: null,
      rows: 0,
      error: "NOT_ATTEMPTED",
    };
    for (const url of footballDataCsvUrls(season, division)) {
      const got = await fetchText(url, fetchImpl);
      last = {
        url,
        ok: false,
        status: got.status,
        rows: 0,
        error: got.error,
      };
      if (got.status === 403 || got.status === 401) {
        last.error = `BLOCKED_HTTP_${got.status}`;
        continue;
      }
      if (!got.text || got.text.length < CSV_MIN_BYTES || !looksLikeFdoukCsv(got.text)) {
        last.error = got.error ?? "NOT_CSV";
        continue;
      }
      const parsed = parseFootballDataCoUkHistory(got.text, division);
      last.ok = parsed.length > 0;
      last.rows = parsed.length;
      last.error = parsed.length ? null : "NO_ROWS";
      if (parsed.length) {
        rows.push(...parsed);
        break;
      }
    }
    packs.push(last);
  });

  return { rows, packs };
}

export async function fetchOpenFootballHistory(input: {
  fetchImpl?: typeof fetch;
}): Promise<{ rows: HistoricalMatchRow[]; packs: LightHistoryPack[] }> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const packs: LightHistoryPack[] = [];
  const rows: HistoricalMatchRow[] = [];
  const targets = [
    ...OPENFOOTBALL_PACKS.map((p) => p.path),
    "2024-25/en.1.json",
    "2024-25/it.1.json",
    "2024-25/es.1.json",
    "2024-25/de.1.json",
    "2024-25/fr.1.json",
  ];
  const unique = [...new Set(targets)];

  await mapPool(unique, FETCH_CONCURRENCY, async (path) => {
    const url = openFootballUrl(path);
    const got = await fetchText(url, fetchImpl);
    const parsed =
      got.text && !/<html/i.test(got.text.slice(0, 80))
        ? parseOpenFootballHistory(got.text, path)
        : [];
    packs.push({
      url,
      ok: parsed.length > 0,
      status: got.status,
      rows: parsed.length,
      error: parsed.length ? null : (got.error ?? "NO_FINISHED"),
    });
    rows.push(...parsed);
  });

  return { rows, packs };
}

function reportFromBlob(
  blob: CachedBlob,
  cache: LightHistoryReport["cache"],
  extra?: Partial<LightHistoryReport>,
): LightHistoryReport {
  return {
    rows: blob.rows,
    fetched_at: blob.fetched_at,
    from_cache: cache !== "http" && cache !== "empty",
    cache,
    seasons: blob.seasons,
    divisions: blob.divisions,
    packs: extra?.packs ?? [],
    note_it:
      extra?.note_it ??
      (blob.rows.length
        ? `Storico in cache: ${blob.rows.length} partite finite.`
        : "Nessuno storico in cache."),
  };
}

export async function loadLightHistory(
  input: FetchLightHistoryInput = {},
): Promise<LightHistoryReport> {
  const cwd = input.cwd ?? process.cwd();
  const nowIso = new Date().toISOString();
  const day = input.dayIso ?? nowIso.slice(0, 10);
  const seasons = lightHistorySeasonCodes(day);
  const divisions = [...LIGHT_HISTORY_DIVISIONS];

  if (!input.force) {
    if (memory && Date.now() - memory.at < MEMORY_TTL_MS && memory.blob.rows.length) {
      return reportFromBlob(memory.blob, "memory");
    }
    const tmp = readJsonFile(tmpPath());
    if (tmp?.rows.length) {
      memory = { at: Date.now(), blob: tmp };
      return reportFromBlob(tmp, "tmp");
    }
    const neon = await loadLightHistoryNeon();
    if (neon?.rows.length) {
      persistLocal(neon, cwd);
      return reportFromBlob(neon, "neon");
    }
    const diskFile = readJsonFile(diskCachePath(cwd));
    if (diskFile?.rows.length) {
      persistLocal(diskFile, cwd);
      return reportFromBlob(diskFile, "disk");
    }
    const diskRows = loadHistoricalMatches(cwd, true);
    if (diskRows.length) {
      const blob: CachedBlob = {
        fetched_at: nowIso,
        seasons,
        divisions,
        rows: diskRows,
      };
      persistLocal(blob, cwd);
      return reportFromBlob(blob, "disk", {
        note_it: `Storico da file locali: ${diskRows.length} partite. Su Vercel questi file di solito mancano.`,
      });
    }
  }

  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const fdouk = await fetchFootballDataHistory({
    seasons,
    divisions,
    fetchImpl,
  });
  let openRows: HistoricalMatchRow[] = [];
  let openPacks: LightHistoryPack[] = [];
  if (input.includeOpenFootball !== false) {
    try {
      const open = await fetchOpenFootballHistory({ fetchImpl });
      openRows = open.rows;
      openPacks = open.packs;
    } catch {
      /* optional */
    }
  }

  const diskRows = loadHistoricalMatches(cwd, true);
  const rows = mergeHistoryRows(fdouk.rows, openRows, diskRows);
  const packs = [...fdouk.packs, ...openPacks];
  const blob: CachedBlob = {
    fetched_at: nowIso,
    seasons,
    divisions,
    rows,
  };

  if (rows.length) {
    persistLocal(blob, cwd);
    if (input.persistNeon !== false) {
      await saveLightHistoryNeon(blob);
    }
  }

  const okPacks = packs.filter((p) => p.ok).length;
  return {
    rows,
    fetched_at: nowIso,
    from_cache: false,
    cache: rows.length ? "http" : "empty",
    seasons,
    divisions,
    packs,
    note_it: rows.length
      ? `Storico risultati scaricato: ${rows.length} partite finite (${okPacks} file).`
      : "Storico risultati non disponibile (CSV assenti o host non raggiungibile). Nessuna percentuale inventata.",
  };
}

export function clearLightHistoryMemory(): void {
  memory = null;
}
