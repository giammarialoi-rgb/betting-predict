/**
 * CLV — il vantaggio si e realizzato davvero?
 *
 * Verifica in avanti del +2,79% di CLV del backtest. Non spende crediti:
 * lavora sulle istantanee che la scansione accumula gia.
 *
 * Presa e chiusura sono indipendenti (vedi src/domain/markets/clv.ts):
 *   presa    = prezzo alla prima volta che la selezione ha superato i filtri
 *   chiusura = prezzo equo (Pinnacle de-viggato) dell'ultima osservazione
 *              prepartita successiva
 * quindi il CLV puo essere negativo e accumulare istantanee non lo gonfia.
 *
 * Il verdetto esce solo sul campione "pulito", cioe quello con chiusura
 * registrata dalle istantanee nuove (campo `marks`). Le istantanee vecchie
 * hanno solo le righe sopra soglia e danno una stima distorta verso l'alto:
 * sono riportate a parte e non entrano nel verdetto.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { isExchangeBook } from "@/domain/markets/exchanges";
import {
  CLV_MIN_EVENTS,
  CLV_MIN_N,
  clvVerdict,
  computeClv,
  type ClvSummary,
  type Snapshot,
} from "@/domain/markets/clv";

const ROOT = process.cwd();
const DIR = join(ROOT, "audit/external/task-044/dispersion");
const OUT = join(ROOT, "audit", "clv-ledger.json");
const MIN_EDGE = Number(process.argv.find((a) => a.startsWith("--min-edge="))?.split("=")[1] ?? 0.02);

const pct = (x: number): string => `${(x * 100).toFixed(2)}%`;
function line(label: string, s: ClvSummary | null): string {
  if (!s) return `  ${label.padEnd(26)} nessuna selezione\n`;
  const ci = s.ci95 ? `  IC95 [${pct(s.ci95[0])}, ${pct(s.ci95[1])}]` : "";
  return (
    `  ${label.padEnd(26)} n=${String(s.n).padStart(4)} su ${String(s.events).padStart(3)} partite  ` +
    `medio ${pct(s.mean)}  mediano ${pct(s.median)}  ` +
    `>0 ${(s.share_positive * 100).toFixed(1)}%  <0 ${(s.share_negative * 100).toFixed(1)}%  =0 ${(s.share_zero * 100).toFixed(1)}%${ci}\n`
  );
}

function main(): void {
  const files = readdirSync(DIR)
    .filter((f) => f.startsWith("scan-") && f.endsWith(".json"))
    .sort();
  if (files.length < 2) {
    process.stdout.write(`servono almeno due scansioni; ce ne sono ${files.length}.\n`);
    return;
  }
  const snaps = files.map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Snapshot);
  const withMarks = snaps.filter((s) => (s.marks?.length ?? 0) > 0).length;
  const r = computeClv(snaps, isExchangeBook, MIN_EDGE);
  const verdict = clvVerdict(r.clean);

  mkdirSync(join(ROOT, "audit"), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        definizione: "CLV = prezzo alla prima presa / prezzo equo Pinnacle all'ultima osservazione prepartita - 1",
        scansioni: files.length,
        scansioni_con_marks: withMarks,
        selezioni_prese: r.taken,
        senza_chiusura: r.withoutClose,
        righe_escluse: r.excludedRows,
        pulito: r.clean,
        pulito_per_fascia_quota: r.byBand,
        legacy_distorto_verso_alto: r.legacy,
        verdetto: verdict.ready
          ? { pronto: true, sostiene_backtest: verdict.supports_backtest, lettura: verdict.reading }
          : { pronto: false, selezioni_mancanti: verdict.missing, eventi_minimi: CLV_MIN_EVENTS, selezioni_minime: CLV_MIN_N },
        voci: r.entries.slice(-200),
      },
      null,
      2,
    ),
  );

  let out = `\n${files.length} scansioni (${withMarks} con chiusure registrate)\n`;
  out += `selezioni prese ${r.taken}, senza una chiusura valida ${r.withoutClose}\n`;
  out += `righe escluse dai filtri: ${Object.entries(r.excludedRows).map(([k, v]) => `${k} ${v}`).join(", ") || "nessuna"}\n\n`;
  out += line("pulito (chiusura marks)", r.clean);
  for (const [b, s] of Object.entries(r.byBand)) out += line(`  quota ${b}`, s);
  out += line("vecchie (stima distorta)", r.legacy);
  if (verdict.ready) {
    out += `\nVERDETTO: ${verdict.reading}\n`;
  } else {
    out += `\nNessun verdetto: servono ${CLV_MIN_N} selezioni su ${CLV_MIN_EVENTS} partite con chiusura registrata (mancano ${verdict.missing} selezioni). Qualunque cifra sopra e rumore.\n`;
  }
  out += `\nriferimento backtest (chiusura Pinnacle indipendente): +2.79% medio, 65.5% batte la chiusura\n-> ${OUT}\n`;
  process.stdout.write(out);
}

main();
