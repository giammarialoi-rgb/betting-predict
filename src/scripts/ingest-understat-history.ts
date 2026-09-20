/**
 * Scarica lo storico xG di Understat per i cinque campionati maggiori.
 *
 * Idempotente: una lega-stagione gia su disco non viene riscaricata, a meno di
 * --force. La stagione in corso conviene riscaricarla, perche cresce.
 *
 *   tsx src/scripts/ingest-understat-history.ts --from=2019 --to=2026
 *   tsx src/scripts/ingest-understat-history.ts --from=2026 --force
 */
import { existsSync } from "node:fs";
import {
  UNDERSTAT_SLUG_BY_DIVISION,
  fetchUnderstatSeason,
  understatHistoryPath,
} from "@/providers/understat/history";

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const from = Number(arg("from", "2019"));
  const to = Number(arg("to", String(new Date().getUTCFullYear())));
  const force = process.argv.includes("--force");
  const slugs = [...new Set(Object.values(UNDERSTAT_SLUG_BY_DIVISION))];

  let scaricate = 0;
  let saltate = 0;
  let fallite = 0;
  for (const slug of slugs) {
    for (let year = from; year <= to; year += 1) {
      const p = understatHistoryPath(root, slug, year);
      if (!force && existsSync(p)) {
        saltate += 1;
        continue;
      }
      try {
        const r = await fetchUnderstatSeason({ root, slug, year });
        if (r.ok) {
          scaricate += 1;
          process.stdout.write(`${slug}-${year}: ${r.matches} partite con xG\n`);
        } else {
          fallite += 1;
          process.stdout.write(`${slug}-${year}: HTTP ${r.status}, nessun dato\n`);
        }
      } catch (e) {
        fallite += 1;
        process.stdout.write(`${slug}-${year}: ${(e as Error).message}\n`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  process.stdout.write(`\nscaricate ${scaricate}  gia presenti ${saltate}  fallite ${fallite}\n`);
}

void main();
