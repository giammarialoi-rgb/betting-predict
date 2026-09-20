/**
 * REGOLAZIONE E VERDETTO DEI CORNER.
 *
 * Il ledger prospettico registrava linea, prezzo e probabilita del modello, ma
 * nessuno riempiva mai il risultato: `settled` restava false per sempre. Senza
 * questo passo aspettare dieci giorni non avrebbe prodotto una misura, solo un
 * file piu grande.
 *
 * I corner giocati arrivano dai CSV di Football-Data (colonne HC/AC): gratis,
 * con circa un giorno di ritardo, nessun credito API. La logica sta in
 * @/domain/eval/corners/prospective, dove e verificabile senza aspettare che le
 * partite finiscano.
 *
 *   tsx src/scripts/refresh-raw-season.ts --leagues=E0,E1,I1,SP1,F1,D1
 *   tsx src/scripts/corners-settle.ts
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { currentSeasonCode } from "@/domain/eval/predictive-intelligence/dataset/freshness";
import { parseCsv, parseFootballDataCoUkDate } from "@/providers/football-data-co-uk/parser";
import {
  MIN_SELEZIONI,
  buildSelections,
  buildVerdict,
  resultKey,
  settleObservations,
  type CornerObs,
  type CornerResult,
} from "@/domain/eval/corners/prospective";

const ROOT = process.cwd();
const LEDGER = join(ROOT, "audit/external/task-044/corners-prospective/observations.jsonl");
const RAW = join(ROOT, "audit/external/task-044/predictive-intelligence/datasets/raw");
const OUT = join(ROOT, "audit", "corners-prospective-report.json");

function caricaRisultati(divisioni: ReadonlySet<string>): Map<string, CornerResult[]> {
  const season = currentSeasonCode();
  const out = new Map<string, CornerResult[]>();
  if (!existsSync(RAW)) return out;
  for (const f of readdirSync(RAW)) {
    const m = /^([A-Z]+\d?)-(\d{4})\.csv$/.exec(f);
    if (!m || m[2] !== season || !divisioni.has(m[1]!)) continue;
    for (const row of parseCsv(readFileSync(join(RAW, f), "utf8")).rows) {
      const home = (row.HomeTeam ?? "").trim();
      const away = (row.AwayTeam ?? "").trim();
      const hc = Number(row.HC);
      const ac = Number(row.AC);
      const d = parseFootballDataCoUkDate(row.Date ?? "", season);
      if (!home || !away || !d || !Number.isFinite(hc) || !Number.isFinite(ac)) continue;
      const k = resultKey(m[1]!, home, away);
      const cur = out.get(k);
      const r: CornerResult = { hc, ac, dayMs: d.getTime() };
      if (cur) cur.push(r);
      else out.set(k, [r]);
    }
  }
  return out;
}

function main(): void {
  if (!existsSync(LEDGER)) {
    process.stdout.write("nessun ledger corner: niente da regolare\n");
    return;
  }
  const oss = readFileSync(LEDGER, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as CornerObs);

  const risultati = caricaRisultati(new Set(oss.map((o) => o.division)));
  const regolate = settleObservations(oss, risultati);
  if (regolate) writeFileSync(LEDGER, oss.map((o) => JSON.stringify(o)).join("\n") + "\n");

  const chiuse = oss.filter((o) => o.settled);
  const partite = new Set(chiuse.map((o) => o.event_id));
  process.stdout.write(
    `ledger ${oss.length} righe  regolate ora ${regolate}  chiuse in tutto ${chiuse.length} su ${partite.size} partite\n`,
  );

  const minN = Number(process.argv.find((a) => a.startsWith("--min-n="))?.split("=")[1] ?? String(MIN_SELEZIONI));
  const sel = buildSelections(chiuse);
  const v = buildVerdict(sel, minN);

  if (!v) {
    process.stdout.write(
      `\nselezioni utilizzabili ${sel.length}, sotto la soglia di ${minN}: qualunque cifra qui sarebbe rumore. Nessun verdetto.\n`,
    );
  } else {
    process.stdout.write(
      `\nselezioni ${v.n}  margine medio del book ${(v.meanMargin * 100).toFixed(2)}%\n` +
        `log loss modello ${v.logLossModel.toFixed(4)}  mercato ${v.logLossMarket.toFixed(4)}  ` +
        `(${v.deltaMillesimi.toFixed(1)} millesimi)\n\n` +
        `${"soglia".padEnd(8)}${"giocate".padStart(9)}${"rendimento".padStart(13)}\n`,
    );
    for (const s of v.simulation) {
      process.stdout.write(
        `${String(s.soglia).padEnd(8)}${String(s.giocate).padStart(9)}${(s.rendimento * 100).toFixed(2).padStart(12)}%\n`,
      );
    }
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        ledger_rows: oss.length,
        settled: chiuse.length,
        events: partite.size,
        usable: sel.length,
        min_n: minN,
        verdict: v,
      },
      null,
      2,
    ),
  );
  process.stdout.write(`\n-> ${OUT}\n`);
}

main();
