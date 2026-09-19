/**
 * Costruisce il dataset esteso a tutte le divisioni Football-Data disponibili.
 *
 * Il dataset originale copre 5 leghe. Proporre selezioni in un campionato che il
 * modello non ha mai visto e esattamente l'errore da evitare: l'universo di
 * proposta non puo essere piu largo dell'universo che il modello sa prezzare.
 * Scrive un file separato: il dataset esistente e i lab che lo usano non cambiano.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/normalize";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const ROOT = process.cwd();
const RAW = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/raw");
const OUT = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl");

const LEAGUE_NAMES: Record<string, string> = {
  E0: "Premier League", E1: "Championship", E2: "League One", E3: "League Two", EC: "National League",
  SC0: "Scozia Premiership", SC1: "Scozia Championship", SC2: "Scozia League One", SC3: "Scozia League Two",
  D1: "Bundesliga", D2: "2. Bundesliga", SP1: "La Liga", SP2: "La Liga 2",
  I1: "Serie A", I2: "Serie B", F1: "Ligue 1", F2: "Ligue 2",
  N1: "Eredivisie", B1: "Belgio Pro League", P1: "Primeira Liga",
  T1: "Turchia Super Lig", G1: "Grecia Super League",
};

function main(): void {
  const files = readdirSync(RAW).filter((f) => /^[A-Z]+\d?-\d{4}\.csv$/.test(f)).sort();
  const all: PiMatchRow[] = [];
  const perLeague = new Map<string, { n: number; seasons: Set<string>; rejected: number }>();

  for (const f of files) {
    const m = /^([A-Z]+\d?)-(\d{4})\.csv$/.exec(f);
    if (!m) continue;
    const [, league, season] = m as unknown as [string, string, string];
    const csvText = readFileSync(join(RAW, f), "utf8");
    let res: ReturnType<typeof normalizeFootballDataCsv>;
    try {
      res = normalizeFootballDataCsv({ csvText, season, league });
    } catch (e) {
      process.stdout.write(`  SCARTATO ${f}: ${(e as Error).message}\n`);
      continue;
    }
    all.push(...res.matches);
    const cur = perLeague.get(league) ?? { n: 0, seasons: new Set<string>(), rejected: 0 };
    cur.n += res.matches.length;
    cur.rejected += res.rejected;
    cur.seasons.add(season);
    perLeague.set(league, cur);
  }

  all.sort((a, b) => (a.event_time < b.event_time ? -1 : 1));
  const seen = new Set<string>();
  const deduped = all.filter((r) => {
    if (seen.has(r.canonical_id)) return false;
    seen.add(r.canonical_id);
    return true;
  });

  mkdirSync(join(ROOT, "audit/external/task-044/predictive-intelligence/datasets"), { recursive: true });
  writeFileSync(OUT, deduped.map((r) => JSON.stringify(r)).join("\n") + "\n");

  process.stdout.write(`\n${"div".padEnd(5)} ${"lega".padEnd(22)} ${"stag.".padStart(6)} ${"partite".padStart(9)} ${"scartate".padStart(9)}\n`);
  process.stdout.write("-".repeat(56) + "\n");
  let tot = 0;
  for (const [lg, s] of [...perLeague.entries()].sort((a, b) => b[1].n - a[1].n)) {
    process.stdout.write(
      `${lg.padEnd(5)} ${(LEAGUE_NAMES[lg] ?? "?").padEnd(22)} ${String(s.seasons.size).padStart(6)} ${String(s.n).padStart(9)} ${String(s.rejected).padStart(9)}\n`,
    );
    tot += s.n;
  }
  process.stdout.write("-".repeat(56) + "\n");
  process.stdout.write(`${"".padEnd(5)} ${"TOTALE".padEnd(22)} ${"".padStart(6)} ${String(tot).padStart(9)}\n`);
  process.stdout.write(`\nleghe: ${perLeague.size}  righe scritte: ${deduped.length}  duplicati rimossi: ${all.length - deduped.length}\n`);
  process.stdout.write(`-> ${OUT}\n`);
}

main();
