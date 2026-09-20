/**
 * I BIGLIETTI DEL GIORNO — singola, raddoppio, multipla, listone.
 *
 *   pnpm tickets                          tutti i prodotti
 *   pnpm tickets --listone --stake=5 --win=10000 --tolerance=0.2
 *   pnpm tickets --listone ... --out=data/tickets/listone.json
 *
 * Legge il pool di selezioni valutate e stampa, per ogni biglietto, anche
 * quello che di solito non si stampa: probabilità di vincita, quota di
 * pareggio e valore atteso. Senza quei numeri i quattro prodotti sembrano
 * uguali; con quei numeri si vede subito quali reggono.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  bestSingle,
  buildTicket,
  legCost,
  PRESETS,
  targetFromStake,
  type BuiltTicket,
  type RatedSelection,
} from "@/domain/booking/ticket-builder";

const POOL = join(process.cwd(), "audit", "selection-pool.json");

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function stampa(titolo: string, t: BuiltTicket, stake: number): void {
  process.stdout.write(`\n${titolo}\n${"-".repeat(titolo.length)}\n`);
  for (const l of t.legs) {
    const costo = legCost(l);
    const segno = " ";
    const mod = l.modelProbability == null ? "    -" : `${(l.modelProbability * 100).toFixed(1)}%`;
    process.stdout.write(
      `  ${segno} ${l.event.padEnd(32).slice(0, 32)} ${l.selection.padEnd(6)} @ ${l.odds.toFixed(2).padStart(6)}` +
        `   equa ${(l.probability * 100).toFixed(1).padStart(5)}%   modello ${mod.padStart(6)}` +
        `   margine ${((costo - 1) * 100).toFixed(1).padStart(4)}%\n`,
    );
  }
  const vincita = stake * t.totalOdds;
  process.stdout.write(
    `\n  gambe ${t.legs.length}   quota ${t.totalOdds.toFixed(2)}   ` +
      `${stake.toFixed(2)}€ -> ${vincita.toFixed(2)}€\n`,
  );
  process.stdout.write(
    `  probabilità di vincita ${(t.probability * 100).toFixed(3)}%  ` +
      `(una ogni ${Math.round(t.oneWinEvery)} giocate)\n`,
  );
  process.stdout.write(
    `  serve ${(t.breakEvenProbability * 100).toFixed(3)}% per andare in pari   ` +
      `margine totale pagato ${(-t.edgePerEuro * 100).toFixed(1)}%\n`,
  );
  process.stdout.write(
    `  su ${stake.toFixed(2)}€ il valore atteso è ${(stake * (1 + t.edgePerEuro)).toFixed(2)}€ ` +
      `(le probabilità sono quelle del mercato, non del modello)\n`,
  );
}

function main(): void {
  const dati = JSON.parse(readFileSync(POOL, "utf8")) as {
    generated_at: string;
    pool: RatedSelection[];
  };
  const pool = dati.pool;
  const orizzonte = Number(arg("days") ?? "14");
  const stake = Number(arg("stake") ?? "5");

  process.stdout.write(
    `pool del ${dati.generated_at}: ${pool.length} selezioni su ` +
      `${new Set(pool.map((p) => p.event)).size} eventi\n`,
  );

  const solo = (nome: string): boolean =>
    process.argv.includes(`--${nome}`) ||
    !process.argv.some((a) => /^--(singola|raddoppio|multipla|listone)$/.test(a));

  const prova = (titolo: string, fn: () => BuiltTicket, importo = stake): BuiltTicket | null => {
    try {
      const t = fn();
      stampa(titolo, t, importo);
      return t;
    } catch (e) {
      process.stdout.write(`\n${titolo}\n  non componibile: ${(e as Error).message}\n`);
      return null;
    }
  };

  if (solo("singola")) prova("SINGOLA DEL GIORNO", () => bestSingle(pool, 1));
  if (solo("raddoppio")) {
    prova("RADDOPPIO DEL GIORNO", () =>
      buildTicket(pool, { ...PRESETS.raddoppio(), horizonDays: 1 }),
    );
  }
  if (solo("multipla")) {
    prova("MULTIPLA A 5", () => buildTicket(pool, { ...PRESETS.multipla(5), horizonDays: 2 }));
    prova("MULTIPLA A 10", () => buildTicket(pool, { ...PRESETS.multipla(10), horizonDays: 2 }));
  }

  if (solo("listone")) {
    const win = Number(arg("win") ?? "10000");
    const tol = Number(arg("tolerance") ?? "0.2");
    const target = targetFromStake(stake, win, tol);
    process.stdout.write(
      `\nlistone: ${stake}€ per vincerne ~${win}€ -> quota ${target.minOdds.toFixed(0)}-${target.maxOdds.toFixed(0)}, orizzonte ${orizzonte} giorni\n`,
    );
    const t = prova("LISTONE", () =>
      buildTicket(pool, { ...target, maxLegs: 20, minLegs: 2, horizonDays: orizzonte }),
    );
    const out = arg("out");
    if (t && out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(
        out,
        JSON.stringify(
          t.legs.map((l) => ({
            event: l.event,
            selection: l.selection,
            expectedOdds: l.odds,
            kickoff: l.kickoff,
          })),
          null,
          2,
        ) + "\n",
      );
      process.stdout.write(`\n-> ${out}\n`);
    }
  }
}

main();
