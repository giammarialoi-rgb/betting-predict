import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marketDevig } from "@/domain/eval/turnaround-025/models";

export type BookQuote029 = {
  matchId: string;
  bookmaker: string;
  home: number;
  draw: number;
  away: number;
};

export type Disagreement029 = {
  n: number;
  stdHome: number;
  rangeHome: number;
  consensusMinusPrimaryHome: number;
};

export function booksOverlayPath(skipHeavy: boolean): string {
  if (skipHeavy) {
    return join(process.cwd(), "src", "domain", "eval", "incremental-029", "fixtures", "books-t1h.csv");
  }
  return join(process.cwd(), "audit", "external", "task-029", "books-t1h.csv");
}

export function parseBooksCsv(text: string): BookQuote029[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",");
  const iM = header.indexOf("match_id");
  const iB = header.indexOf("bookmaker");
  const iH = header.indexOf("home_odds");
  const iD = header.indexOf("draw_odds");
  const iA = header.indexOf("away_odds");
  if ([iM, iB, iH, iD, iA].some((i) => i < 0)) throw new Error("books-t1h.csv missing columns");
  const out: BookQuote029[] = [];
  for (let n = 1; n < lines.length; n++) {
    const c = lines[n]!.split(",");
    const h = Number(c[iH]);
    const d = Number(c[iD]);
    const a = Number(c[iA]);
    if (!(h > 1 && d > 1 && a > 1)) continue;
    out.push({
      matchId: c[iM] ?? "",
      bookmaker: c[iB] ?? "",
      home: h,
      draw: d,
      away: a,
    });
  }
  return out;
}

export function loadBooksByMatch(skipHeavy: boolean): Map<string, BookQuote029[]> {
  const p = booksOverlayPath(skipHeavy);
  if (!existsSync(p)) return new Map();
  const rows = parseBooksCsv(readFileSync(p, "utf8"));
  const map = new Map<string, BookQuote029[]>();
  for (const r of rows) {
    const g = map.get(r.matchId) ?? [];
    g.push(r);
    map.set(r.matchId, g);
  }
  return map;
}

export function disagreementVsPrimary(
  books: readonly BookQuote029[] | undefined,
  primary: { home: number; draw: number; away: number },
): Disagreement029 {
  const list = books ?? [];
  const ps: number[] = [];
  for (const b of list) {
    const d = marketDevig({ home: b.home, draw: b.draw, away: b.away });
    if (d) ps.push(d[0]!);
  }
  const prim = marketDevig(primary);
  const p0 = prim ? prim[0]! : 1 / 3;
  if (ps.length < 2) {
    return { n: ps.length, stdHome: 0, rangeHome: 0, consensusMinusPrimaryHome: 0 };
  }
  const mean = ps.reduce((s, x) => s + x, 0) / ps.length;
  const v = ps.reduce((s, x) => s + (x - mean) ** 2, 0) / ps.length;
  return {
    n: ps.length,
    stdHome: Math.sqrt(v),
    rangeHome: Math.max(...ps) - Math.min(...ps),
    consensusMinusPrimaryHome: mean - p0,
  };
}
