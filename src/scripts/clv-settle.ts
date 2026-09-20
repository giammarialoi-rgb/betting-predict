/**
 * CLV — il vantaggio si è realizzato davvero?
 *
 * Il confronto prezzi è l'unica cosa che in questa sessione sia risultata
 * positiva: +2.79% di CLV su 11505 selezioni storiche. Ma era un backtest, e
 * un backtest è una promessa. Questo script la verifica in avanti.
 *
 * Non spende crediti: lavora sugli snapshot che la scansione accumula gia'.
 * Per ogni evento prende il prezzo MIGLIORE visto in anticipo e lo confronta
 * con l'ULTIMO visto prima del calcio d'inizio, che è il miglior sostituto
 * della chiusura di cui disponiamo. Il vantaggio è
 *
 *     CLV = prezzo_preso / prezzo_di_chiusura - 1
 *
 * Positivo significa aver comprato a un prezzo che il mercato ha poi
 * accorciato: è la definizione operativa di aver avuto ragione, e si misura
 * senza aspettare l'esito della partita.
 *
 * Quello che NON fa: dire se abbiamo vinto. Il CLV è una misura di prezzo, non
 * di fortuna, ed è per questo che serve — su poche centinaia di osservazioni
 * dice qualcosa, mentre il profitto no.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR = join(ROOT, "audit/external/task-044/dispersion");
const OUT = join(ROOT, "audit", "clv-ledger.json");

type Row = {
  sport: string;
  eventId: string;
  commence: string;
  home: string;
  away: string;
  outcome: string;
  bestBook: string;
  priceNet: number;
  fairPrice?: number;
};
type Scan = { run_at: string; rows: Row[] };

/** Chiave di una selezione: evento + esito. */
const keyOf = (r: Row): string => `${r.eventId}|${r.outcome}`;

function main(): void {
  const files = readdirSync(DIR)
    .filter((f) => f.startsWith("scan-") && f.endsWith(".json"))
    .sort();
  if (files.length < 2) {
    process.stdout.write(
      `servono almeno due scansioni per confrontare un prezzo con la sua chiusura; ce ne sono ${files.length}.\n` +
        `Il ledger si riempie da solo man mano che l'attività pianificata gira.\n`,
    );
    return;
  }

  // Per ogni selezione: il prezzo migliore visto, e l'ultimo prima del via.
  const migliore = new Map<string, { row: Row; at: string }>();
  const ultimo = new Map<string, { row: Row; at: string }>();

  for (const f of files) {
    const scan = JSON.parse(readFileSync(join(DIR, f), "utf8")) as Scan;
    const t = Date.parse(scan.run_at);
    for (const r of scan.rows ?? []) {
      const via = Date.parse(r.commence);
      if (!Number.isFinite(via) || t >= via) continue; // solo prepartita
      const k = keyOf(r);
      const m = migliore.get(k);
      if (!m || r.priceNet > m.row.priceNet) migliore.set(k, { row: r, at: scan.run_at });
      const u = ultimo.get(k);
      if (!u || t > Date.parse(u.at)) ultimo.set(k, { row: r, at: scan.run_at });
    }
  }

  const voci: Array<Record<string, unknown>> = [];
  for (const [k, presa] of migliore) {
    const chiusura = ultimo.get(k);
    if (!chiusura) continue;
    // Serve una vera distanza temporale: confrontare una scansione con sé
    // stessa darebbe zero e gonfierebbe il campione di non-informazione.
    if (chiusura.at === presa.at) continue;
    const clv = presa.row.priceNet / chiusura.row.priceNet - 1;
    voci.push({
      evento: `${presa.row.home} - ${presa.row.away}`,
      esito: presa.row.outcome,
      book: presa.row.bestBook,
      presa: presa.row.priceNet,
      presa_il: presa.at,
      chiusura: chiusura.row.priceNet,
      chiusura_il: chiusura.at,
      clv,
    });
  }

  if (voci.length === 0) {
    process.stdout.write(
      `nessuna selezione ha ancora due osservazioni distinte prima del via.\n` +
        `Scansioni presenti: ${files.length}. Serve tempo, non codice.\n`,
    );
    return;
  }

  const clvs = voci.map((v) => v.clv as number).sort((a, b) => a - b);
  const media = clvs.reduce((a, b) => a + b, 0) / clvs.length;
  const mediana = clvs[Math.floor(clvs.length / 2)] ?? 0;
  const battute = clvs.filter((c) => c > 0).length;

  mkdirSync(join(ROOT, "audit"), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        scansioni: files.length,
        selezioni: voci.length,
        clv_medio: media,
        clv_mediano: mediana,
        battute_su_chiusura: battute / voci.length,
        voci: voci.slice(-200),
      },
      null,
      2,
    ),
  );

  process.stdout.write(
    `\n${voci.length} selezioni su ${files.length} scansioni\n` +
      `  CLV medio    ${(media * 100).toFixed(2)}%\n` +
      `  CLV mediano  ${(mediana * 100).toFixed(2)}%\n` +
      `  batte la chiusura  ${((battute / voci.length) * 100).toFixed(1)}%\n` +
      `\nriferimento dal backtest: +2.79% medio, 65.5% batte la chiusura\n-> ${OUT}\n`,
  );
}

main();
