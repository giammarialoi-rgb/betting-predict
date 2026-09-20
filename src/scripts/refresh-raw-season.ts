/**
 * Riscarica i CSV della stagione in corso dentro datasets/raw.
 *
 * Serve perche il resto della catena legge da li: il tabellone, il dataset
 * esteso e la regolazione dei corner. Un archivio fermo supera tutte le
 * validazioni storiche e sbaglia solo sul presente, che e l'unico momento in
 * cui si scommette — il motivo per cui esiste il modulo di freschezza.
 *
 *   tsx src/scripts/refresh-raw-season.ts            // stagione corrente
 *   tsx src/scripts/refresh-raw-season.ts --season=2627 --leagues=E0,I1
 */
import { downloadFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/download";
import { currentSeasonCode } from "@/domain/eval/predictive-intelligence/dataset/freshness";

const TUTTE = [
  "E0", "E1", "E2", "E3", "EC", "SC0", "SC1", "SC2", "SC3", "D1", "D2",
  "SP1", "SP2", "I1", "I2", "F1", "F2", "N1", "B1", "P1", "T1", "G1",
];

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main(): Promise<void> {
  const season = arg("season") ?? currentSeasonCode();
  const leghe = (arg("leagues") ?? TUTTE.join(",")).split(",").filter(Boolean);
  process.stdout.write(`stagione ${season}, ${leghe.length} divisioni\n`);

  let ok = 0;
  let ko = 0;
  for (const league of leghe) {
    try {
      const r = await downloadFootballDataCsv({ league, season, force: true });
      if (r.ok) {
        ok += 1;
      } else {
        ko += 1;
        process.stdout.write(`  ${league}: non scaricato (${r.attempts.map((a) => a.status).join(",")})\n`);
      }
    } catch (e) {
      ko += 1;
      process.stdout.write(`  ${league}: ${(e as Error).message}\n`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  process.stdout.write(`aggiornate ${ok}, fallite ${ko}\n`);
}

void main();
