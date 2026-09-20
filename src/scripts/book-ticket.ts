/**
 * Prenota su Planetwin365 il biglietto descritto in un file JSON e stampa il codice.
 *
 *   pnpm book:ticket --file=data/tickets/listone.json
 *   pnpm book:ticket --file=... --dry-run      # verifica la mappatura, non apre il browser
 *   pnpm book:ticket --file=... --tolerance=0.03
 *
 * Il file: [{ "event": "Fiorentina - Napoli", "selection": "1", "expectedOdds": 3.20 }, ...]
 *
 * Va lanciato su Windows, dalla connessione di casa: i book rispondono 403 da
 * qualsiasi altro IP. Il comando non fa login e non gioca nulla — emette solo
 * il codice da portare in agenzia.
 */
import { readFileSync } from "node:fs";
import { bookTicket, planTicket } from "@/domain/booking/planetwin/driver";
import { BookingError, type TicketLeg } from "@/domain/booking/types";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function readLegs(path: string): readonly TicketLeg[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new BookingError(`${path}: atteso un array di gambe`);
  return parsed.map((raw, i) => {
    const o = raw as Partial<TicketLeg>;
    if (typeof o.event !== "string" || o.event.trim() === "") {
      throw new BookingError(`gamba ${i}: "event" mancante`);
    }
    if (typeof o.selection !== "string" || o.selection.trim() === "") {
      throw new BookingError(`gamba ${i}: "selection" mancante`);
    }
    if (typeof o.expectedOdds !== "number" || !Number.isFinite(o.expectedOdds)) {
      throw new BookingError(`gamba ${i}: "expectedOdds" mancante o non numerica`);
    }
    return { event: o.event, selection: o.selection, expectedOdds: o.expectedOdds };
  });
}

async function main(): Promise<void> {
  const file = arg("file");
  if (!file) {
    console.error("serve --file=<percorso.json>");
    process.exitCode = 2;
    return;
  }
  const legs = readLegs(file);
  const plan = planTicket(legs);

  console.log(`biglietto: ${legs.length} gambe`);
  legs.forEach((leg, i) => {
    const p = plan[i]!;
    const linea = p.line ? ` (${p.line})` : "";
    console.log(`  ${leg.event} → ${p.tab} / ${p.block}${linea} / ${p.outcome} @ ${leg.expectedOdds}`);
  });

  if (process.argv.includes("--dry-run")) {
    console.log("\nmappatura completa. Nessun browser aperto (--dry-run).");
    return;
  }

  const tolerance = Number(arg("tolerance") ?? "0.02");
  const booked = await bookTicket(legs, {
    tolerance,
    headless: process.argv.includes("--headless"),
    // Nessun profilo di default: il book conserva la schedina nel profilo, e
    // una gamba della corsa precedente finirebbe nel biglietto nuovo.
    ...(arg("profile") ? { profileDir: arg("profile") as string } : {}),
  });

  console.log(`\nCODICE      ${booked.code}`);
  console.log(`scadenza    ${booked.expiry}`);
  console.log(`quota tot.  ${booked.totalOdds.toFixed(2)}`);
  if (booked.bonus > 0) console.log(`bonus       ${booked.bonus.toFixed(2)}`);

  // Cosa c'è davvero nel biglietto, con le quote PRESE: senza questo il codice
  // è un numero di cui non si conosce il contenuto.
  console.log("\ngambe prenotate:");
  for (const leg of booked.legs) {
    const scarto = leg.drift >= 0 ? `+${(leg.drift * 100).toFixed(1)}` : (leg.drift * 100).toFixed(1);
    console.log(
      `  ${leg.event} ${leg.selection} @ ${leg.takenOdds.toFixed(2)} (attesa ${leg.expectedOdds}, ${scarto}%)`,
    );
  }
  console.log("\nda comunicare alla cassa di un punto vendita Planetwin365.");
}

main().catch((e: unknown) => {
  const err = e as BookingError;
  console.error(`\nNON PRENOTATO: ${err.message}`);
  if (err.detail) console.error(JSON.stringify(err.detail, null, 2));
  process.exitCode = 1;
});
