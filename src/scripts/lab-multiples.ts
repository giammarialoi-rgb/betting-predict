/**
 * Conviene comporre multiple con le selezioni del motore di dispersione?
 *
 * La tesi seducente: se ogni gamba ha vantaggio e, una multipla di n gambe vale
 * (1+e)^n, quindi il vantaggio si compone. E' vero, ma incompleto in due modi
 * che questo script misura invece di argomentare.
 *
 * 1. Una multipla si gioca presso UN bookmaker. Il vantaggio misurato in questo
 *    progetto (+2,79% di CLV) viene dal prendere il MIGLIOR prezzo fra 42 book:
 *    overround combinato circa 0% contro il 3,5% del miglior book singolo. Una
 *    multipla rinuncia per costruzione proprio alla leva che genera il vantaggio.
 * 2. Comporre amplifica anche l'INCERTEZZA sulla stima. Il ROI misurato ha IC
 *    [-1,6%, +4,7%]: elevare alla n un numero che potrebbe essere negativo non
 *    e leva, e azzardo sulla correttezza della propria stima.
 */
import { makeRng } from "@/domain/eval/predictive-intelligence/validation/rng";

const OVERROUND_BEST = 1.000;   // miglior prezzo combinato, misurato -0,17/+0,34%
const OVERROUND_SHARP = 1.035;  // Pinnacle da solo, misurato 3,49-3,84%
const OVERROUND_SOFT = 1.054;   // book ricreativo tipico, misurato

/** Una gamba: probabilita vera p, quota offerta con un dato overround su k esiti. */
function legOdds(p: number, overround: number, k = 3): number {
  // il margine e distribuito sugli esiti; approssimazione uniforme sufficiente qui
  return 1 / (p * overround ** (1 / k) * (overround ** ((k - 1) / k)));
}

function simulate(input: {
  legs: number;
  overround: number;
  trueEdgePerLeg: number;
  betsPerYear: number;
  stakeFraction: number;
  years: number;
  trials: number;
  seed: number;
}): { median: number; p05: number; p95: number; ruinRate: number; winRate: number; meanBets: number } {
  const rnd = makeRng(input.seed);
  const finals: number[] = [];
  let ruin = 0;
  let wins = 0;
  let totalTickets = 0;

  for (let t = 0; t < input.trials; t += 1) {
    let bank = 1000;
    const tickets = Math.max(1, Math.round((input.betsPerYear * input.years) / input.legs));
    totalTickets += tickets;
    for (let i = 0; i < tickets; i += 1) {
      if (bank < 1) { ruin += 1; break; }
      const stake = Math.max(1, bank * input.stakeFraction);
      // probabilita media di una gamba tipica del motore: quote corte, 1,6-2,5
      let product = 1;
      let won = true;
      for (let l = 0; l < input.legs; l += 1) {
        const pTrue = 0.45 + rnd() * 0.2;                 // 45-65%
        const offered = legOdds(pTrue, input.overround);  // quota del book
        // il vantaggio vero e' applicato alla probabilita: p_effettiva = p * (1+e) * (overround corretto)
        const pEff = Math.min(0.97, pTrue * (1 + input.trueEdgePerLeg));
        product *= offered;
        if (rnd() > pEff) { won = false; }
      }
      bank -= stake;
      if (won) { bank += stake * product; wins += 1; }
    }
    finals.push(bank);
  }
  finals.sort((a, b) => a - b);
  const q = (f: number) => finals[Math.min(finals.length - 1, Math.floor(f * finals.length))]!;
  return {
    median: q(0.5), p05: q(0.05), p95: q(0.95),
    ruinRate: ruin / input.trials,
    winRate: wins / Math.max(1, totalTickets),
    meanBets: totalTickets / input.trials,
  };
}

function main(): void {
  const BETS = 600;   // gambe disponibili in un anno dal motore
  const YEARS = 1;
  const TRIALS = 20000;

  const scenarios: [string, number, number, number][] = [
    // etichetta, gambe per schedina, overround, vantaggio vero per gamba
    ["singole, miglior prezzo", 1, OVERROUND_BEST, 0.028],
    ["singole, un solo book sharp", 1, OVERROUND_SHARP, 0.028],
    ["doppie, un solo book", 2, OVERROUND_SHARP, 0.028],
    ["triple, un solo book", 3, OVERROUND_SHARP, 0.028],
    ["5 gambe, un solo book", 5, OVERROUND_SHARP, 0.028],
    ["10 gambe, un solo book", 10, OVERROUND_SHARP, 0.028],
    ["5 gambe, book ricreativo", 5, OVERROUND_SOFT, 0.028],
  ];

  process.stdout.write(`\nUn anno, ${BETS} gambe disponibili, puntata 1% del banco, ${TRIALS} simulazioni\n`);
  process.stdout.write(`vantaggio vero per gamba +2,8% (la nostra stima puntuale di CLV)\n\n`);
  process.stdout.write(`${"strategia".padEnd(28)} ${"schedine".padStart(9)} ${"vince".padStart(7)} ${"mediana".padStart(9)} ${"5%".padStart(8)} ${"95%".padStart(9)} ${"rovina".padStart(8)}\n`);
  process.stdout.write("-".repeat(86) + "\n");
  for (const [label, legs, ovr, edge] of scenarios) {
    const r = simulate({ legs, overround: ovr, trueEdgePerLeg: edge, betsPerYear: BETS, stakeFraction: 0.01, years: YEARS, trials: TRIALS, seed: 1234 + legs });
    process.stdout.write(
      `${label.padEnd(28)} ${r.meanBets.toFixed(0).padStart(9)} ${(100 * r.winRate).toFixed(1).padStart(6)}% ${r.median.toFixed(0).padStart(9)} ${r.p05.toFixed(0).padStart(8)} ${r.p95.toFixed(0).padStart(9)} ${(100 * r.ruinRate).toFixed(1).padStart(7)}%\n`,
    );
  }

  process.stdout.write(`\n\nE se la nostra stima del vantaggio fosse sbagliata?\n`);
  process.stdout.write(`Il ROI misurato ha IC [-1,6%, +4,7%]. Ecco cosa succede agli estremi.\n\n`);
  process.stdout.write(`${"vantaggio vero".padEnd(18)} ${"singole".padStart(12)} ${"triple".padStart(12)} ${"5 gambe".padStart(12)} ${"10 gambe".padStart(12)}\n`);
  process.stdout.write("-".repeat(70) + "\n");
  for (const edge of [-0.016, 0, 0.016, 0.028, 0.047]) {
    const row = [1, 3, 5, 10].map((legs) => {
      const r = simulate({ legs, overround: legs === 1 ? OVERROUND_BEST : OVERROUND_SHARP, trueEdgePerLeg: edge, betsPerYear: BETS, stakeFraction: 0.01, years: YEARS, trials: 8000, seed: 99 + legs });
      return r.median.toFixed(0).padStart(12);
    });
    process.stdout.write(`${((edge >= 0 ? "+" : "") + (100 * edge).toFixed(1) + "% per gamba").padEnd(18)}${row.join("")}\n`);
  }
  process.stdout.write(`\n(mediana del banco finale partendo da 1000)\n`);
}

main();
