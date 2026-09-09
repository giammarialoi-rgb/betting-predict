import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (q && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else q = !q;
    } else if (c === "," && !q) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function walkCsv(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkCsv(p, acc);
    else if (e.name.endsWith(".csv")) acc.push(p);
  }
  return acc;
}

const sharp = parseCsv(readFileSync("audit/external/task-035/sharpapi-wc2026.csv", "utf8"));
const h = sharp[0]!;
const idx = (n: string) => h.indexOf(n);
const iSport = idx("sport");
const iMkt = idx("market_type");
const iEid = idx("event_id");
const iLive = idx("is_live");
const iStart = idx("event_start_time");
const iTs = idx("timestamp");
const iHome = idx("home_team");
const iAway = idx("away_team");
const soccer = sharp.slice(1).filter((r) => r[iSport] === "soccer");
const mkts: Record<string, number> = {};
for (const r of soccer) mkts[r[iMkt] ?? ""] = (mkts[r[iMkt] ?? ""] ?? 0) + 1;
type Ev = {
  id: string;
  home: string;
  away: string;
  start: string;
  mkts: Set<string>;
  prem: boolean;
  live: boolean;
};
const events = new Map<string, Ev>();
for (const r of soccer) {
  const id = r[iEid] ?? "";
  const start = Date.parse(r[iStart] ?? "");
  const ts = Date.parse(r[iTs] ?? "");
  const live = String(r[iLive]).toLowerCase() === "true";
  const prem = Number.isFinite(start) && Number.isFinite(ts) && ts < start && !live;
  const e = events.get(id) ?? {
    id,
    home: r[iHome] ?? "",
    away: r[iAway] ?? "",
    start: r[iStart] ?? "",
    mkts: new Set<string>(),
    prem: false,
    live: false,
  };
  e.mkts.add(r[iMkt] ?? "");
  if (prem) e.prem = true;
  if (live) e.live = true;
  events.set(id, e);
}
const ev = [...events.values()];
const money = ev.filter((e) => [...e.mkts].some((m) => /moneyline|1x2|match_odds|h2h/i.test(m)));
const ahFiles = walkCsv("audit/external/task-026/kaggle-ah/sample");
console.log(
  JSON.stringify(
    {
      sharp: {
        soccerRows: soccer.length,
        soccerEvents: ev.length,
        prematchEvents: ev.filter((e) => e.prem).length,
        liveEvents: ev.filter((e) => e.live).length,
        moneylineish: money.length,
        moneylinePrematch: money.filter((e) => e.prem).length,
        topMkts: Object.entries(mkts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15),
        samplePrematch: ev
          .filter((e) => e.prem)
          .slice(0, 10)
          .map((e) => ({
            id: e.id,
            home: e.home,
            away: e.away,
            start: e.start,
            mkts: [...e.mkts].slice(0, 6),
          })),
      },
      kaggleAhSampleFiles: ahFiles.length,
      soccerOddsLines: readFileSync("audit/external/task-035/hf-soccer_odds.csv", "utf8").split(/\n/).length,
    },
    null,
    2,
  ),
);
