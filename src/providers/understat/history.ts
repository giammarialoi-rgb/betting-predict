/**
 * Archivio storico xG di Understat, su disco.
 *
 * L'endpoint e lo stesso che chiama la pagina pubblica del sito
 * (GET /getLeagueData/{lega}/{anno} con X-Requested-With: XMLHttpRequest):
 * nessun aggiramento, nessuna firma, nessun login. Le risposte si salvano
 * intatte, una per lega-stagione, cosi il dataset si puo ricostruire senza
 * rete e la fonte resta verificabile riga per riga.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { UnderstatFixture } from "@/domain/eval/predictive-intelligence/dataset/understat-join";

/** Divisioni Football-Data coperte da Understat. */
export const UNDERSTAT_SLUG_BY_DIVISION: Readonly<Record<string, string>> = Object.freeze({
  E0: "EPL",
  SP1: "La_liga",
  D1: "Bundesliga",
  I1: "Serie_A",
  F1: "Ligue_1",
});

export const UNDERSTAT_HISTORY_DIR = join("data", "acquisition", "understat", "history");

/** "2425" -> 2024. Understat indicizza per anno d'inizio stagione. */
export function seasonStartYear(season: string): number | null {
  const m = /^(\d{2})(\d{2})$/.exec(season);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ((a + 1) % 100 !== b) return null;
  return a >= 90 ? 1900 + a : 2000 + a;
}

export function understatHistoryPath(root: string, slug: string, year: number): string {
  return join(root, UNDERSTAT_HISTORY_DIR, `${slug}-${year}.json`);
}

export function understatLeagueDataUrl(slug: string, year: number): string {
  return `https://understat.com/getLeagueData/${slug}/${year}`;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function title(v: unknown): string | null {
  if (v && typeof v === "object") {
    const t = (v as { title?: unknown }).title;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

/** Estrae le partite concluse con xG da una risposta getLeagueData. */
export function parseUnderstatHistory(text: string): UnderstatFixture[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const dates = (parsed as { dates?: unknown })?.dates;
  if (!Array.isArray(dates)) return [];
  const out: UnderstatFixture[] = [];
  for (const raw of dates) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (r.isResult !== true) continue;
    const home = title(r.h);
    const away = title(r.a);
    const dt = typeof r.datetime === "string" ? r.datetime.slice(0, 10) : null;
    const goals = r.goals as { h?: unknown; a?: unknown } | undefined;
    const xg = r.xG as { h?: unknown; a?: unknown } | undefined;
    const gh = num(goals?.h);
    const ga = num(goals?.a);
    const xh = num(xg?.h);
    const xa = num(xg?.a);
    if (!home || !away || !dt || gh == null || ga == null || xh == null || xa == null) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    out.push({ date: dt, home, away, goalsHome: gh, goalsAway: ga, xgHome: xh, xgAway: xa });
  }
  return out;
}

/** Legge dal disco, senza rete. Restituisce null se la stagione non e stata scaricata. */
export function loadUnderstatSeason(
  root: string,
  division: string,
  season: string,
): UnderstatFixture[] | null {
  const slug = UNDERSTAT_SLUG_BY_DIVISION[division];
  const year = seasonStartYear(season);
  if (!slug || year == null) return null;
  const p = understatHistoryPath(root, slug, year);
  if (!existsSync(p)) return null;
  return parseUnderstatHistory(readFileSync(p, "utf8"));
}

/** Scarica e salva una lega-stagione. Ritorna il numero di partite con xG. */
export async function fetchUnderstatSeason(input: {
  root: string;
  slug: string;
  year: number;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; matches: number; path: string }> {
  const url = understatLeagueDataUrl(input.slug, input.year);
  const path = understatHistoryPath(input.root, input.slug, input.year);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), input.timeoutMs ?? 40_000);
  try {
    const res = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: `https://understat.com/league/${input.slug}/${input.year}`,
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, matches: 0, path };
    const parsed = parseUnderstatHistory(text);
    if (!parsed.length) return { ok: false, status: res.status, matches: 0, path };
    mkdirSync(join(input.root, UNDERSTAT_HISTORY_DIR), { recursive: true });
    writeFileSync(path, text);
    return { ok: true, status: res.status, matches: parsed.length, path };
  } finally {
    clearTimeout(timer);
  }
}
