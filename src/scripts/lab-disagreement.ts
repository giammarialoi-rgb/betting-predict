/**
 * LAB — QUANDO MODELLO E MERCATO NON SONO D'ACCORDO, CHI HA RAGIONE?
 *
 * È la domanda da cui dipende tutto il resto. Il costruttore di biglietti
 * sceglie per costruzione le selezioni dove il modello si discosta di più dal
 * mercato: se quel disaccordo è informazione, il costruttore cerca valore; se
 * è errore di calibrazione, il costruttore lo AMPLIFICA — e più alza
 * l'obiettivo di quota, più è costretto verso le code, dove un modello sbaglia
 * di più.
 *
 * Il caso che ha spinto a misurarlo: un listone a quota 1602 su cui il modello
 * dichiarava lo 0.308% di probabilità contro lo 0.062% del mercato, cioè di
 * essere 4.9 volte più accurato. Con dentro Bournemouth che batte il Liverpool
 * al 44.6% contro il 30.8%.
 *
 * Protocollo: walk-forward, forza rifittata alla vigilia di ogni giornata dai
 * soli risultati precedenti. Le quote non entrano mai nel modello. Per ogni
 * coppia (partita, esito) si registra quanto il modello si discosta dal
 * mercato, e cosa è poi successo davvero. Se il disaccordo fosse informazione,
 * nelle fasce dove il modello alza la probabilità gli esiti dovrebbero
 * verificarsi PIÙ spesso di quanto dice il mercato.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_STRENGTH_DC,
  StrengthFitCache,
  predictStrengthDc,
  type StrengthDcParams,
} from "@/domain/eval/predictive-intelligence/models/strength-dc";
import { applyTemperature } from "@/domain/eval/predictive-intelligence/models/temperature";
import { marketBaselineFromOpenOdds } from "@/domain/eval/predictive-intelligence/models/market-baseline";
import { featureCutoffForMatch } from "@/domain/eval/predictive-intelligence/features/asof";
import type { PiMatchRow } from "@/domain/eval/predictive-intelligence/types";

const DATASET = join(
  process.cwd(),
  "audit/external/task-044/predictive-intelligence/datasets/matches-expanded.jsonl",
);
const OUT = join(process.cwd(), "audit", "disagreement.json");

/** Gli stessi parametri che generano le giocate vere. */
const flag = (name: string, fallback: number): number =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? String(fallback));

const PARAMS: StrengthDcParams = {
  ...DEFAULT_STRENGTH_DC,
  halfLifeDays: flag("half-life", 180),
  shrinkage: flag("shrinkage", 4),
  rho: -0.12,
  sotWeight: 0.8,
  xgWeight: flag("xg-weight", 0.9),
  iterations: 60,
};
const TEMPERATURE = Number(
  process.argv.find((a) => a.startsWith("--temperature="))?.split("=")[1] ?? "0.8",
);

/** Fasce di scarto modello/mercato. L'ultima è quella del listone. */
const FASCE: Array<[string, number, number]> = [
  ["modello molto più basso", 0.0, 0.7],
  ["modello più basso", 0.7, 0.9],
  ["accordo", 0.9, 1.1],
  ["modello più alto", 1.1, 1.3],
  ["modello molto più alto", 1.3, 1.6],
  ["modello estremo", 1.6, 99],
];

type Osservazione = {
  rapporto: number;
  pModello: number;
  pMercato: number;
  avvenuto: boolean;
};

class LeagueIndex {
  private readonly byLeague = new Map<string, { rows: PiMatchRow[]; avail: number[] }>();
  constructor(universe: readonly PiMatchRow[]) {
    for (const m of universe) {
      let e = this.byLeague.get(m.league);
      if (!e) {
        e = { rows: [], avail: [] };
        this.byLeague.set(m.league, e);
      }
      e.rows.push(m);
    }
    for (const e of this.byLeague.values()) {
      e.rows.sort((a, b) => Date.parse(a.result_available_at) - Date.parse(b.result_available_at));
      e.avail = e.rows.map((m) => Date.parse(m.result_available_at));
    }
  }
  priors(league: string, cutMs: number): PiMatchRow[] {
    const e = this.byLeague.get(league);
    if (!e) return [];
    let lo = 0;
    let hi = e.avail.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (e.avail[mid]! < cutMs) lo = mid + 1;
      else hi = mid;
    }
    return e.rows.slice(0, lo);
  }
  all(): PiMatchRow[] {
    const out: PiMatchRow[] = [];
    for (const e of this.byLeague.values()) out.push(...e.rows);
    return out.sort((a, b) => (a.event_time < b.event_time ? -1 : 1));
  }
}

function main(): void {
  const t0 = Date.now();
  const rows = readFileSync(DATASET, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as PiMatchRow);
  const stagioni = new Set(
    (process.argv.find((a) => a.startsWith("--seasons="))?.split("=")[1] ?? "2324,2425,2526")
      .split(","),
  );
  // Il costo sta nei rifit: uno per lega e per giornata, ciascuno su tutto lo
  // storico precedente di quella lega. Sull'intero archivio (22 divisioni, tre
  // stagioni) sono decine di migliaia di fit e non finisce: la prima versione
  // ha girato sette ore senza produrre una riga. Si misura sui campionati
  // maggiori, che è dove il modello viene poi usato.
  const leghe = new Set(
    (process.argv.find((a) => a.startsWith("--leagues="))?.split("=")[1] ?? "E0,I1,SP1,D1,F1")
      .split(","),
  );
  const universo = rows.filter((m) => leghe.has(String(m.league)));
  process.stdout.write(
    `archivio ${rows.length} partite -> ${universo.length} nei campionati ${[...leghe].join(",")}\n`,
  );
  const index = new LeagueIndex(universo);
  const cache = new StrengthFitCache((lg, cut) => index.priors(lg, cut), PARAMS);

  const oss: Osservazione[] = [];
  let valutate = 0;
  for (const m of index.all()) {
    if (!stagioni.has(String(m.season))) continue;
    const pMk = marketBaselineFromOpenOdds(m);
    if (!pMk) continue;
    const fit = cache.get(m.league, featureCutoffForMatch(m));
    if (!fit.supported) continue;
    const pred = predictStrengthDc({
      fit,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      params: PARAMS,
    });
    const pMd = applyTemperature(pred.probability, TEMPERATURE);
    valutate += 1;
    if (valutate % 200 === 0) {
      process.stdout.write(
        `  ${valutate} partite valutate (${Math.round((Date.now() - t0) / 1000)}s)\n`,
      );
    }

    for (const esito of ["HOME", "DRAW", "AWAY"] as const) {
      const a = pMd[esito];
      const b = pMk[esito];
      if (!(a > 0) || !(b > 0)) continue;
      oss.push({ rapporto: a / b, pModello: a, pMercato: b, avvenuto: m.ftr === esito });
    }
  }

  // Log loss complessiva: il confronto diretto con il mercato.
  const ll = (get: (o: Osservazione) => number): number =>
    -oss.reduce((a, o) => a + Math.log(Math.max(1e-12, o.avvenuto ? get(o) : 1 - get(o))), 0) /
    oss.length;
  const llModello = ll((o) => o.pModello);
  const llMercato = ll((o) => o.pMercato);

  process.stdout.write(
    `\nT=${TEMPERATURE}  partite ${valutate}  osservazioni ${oss.length}  ` +
      `log loss modello ${llModello.toFixed(4)}  mercato ${llMercato.toFixed(4)}  ` +
      `(${((llModello - llMercato) * 1000).toFixed(1)} millesimi)\n\n`,
  );
  process.stdout.write(
    `${"fascia di scarto".padEnd(24)}${"n".padStart(7)}${"mercato".padStart(10)}${"modello".padStart(10)}${"reale".padStart(10)}   verdetto\n`,
  );
  process.stdout.write("-".repeat(92) + "\n");

  const tabella: Record<string, unknown>[] = [];
  for (const [nome, lo, hi] of FASCE) {
    const g = oss.filter((o) => o.rapporto >= lo && o.rapporto < hi);
    if (g.length < 50) continue;
    const mk = g.reduce((a, o) => a + o.pMercato, 0) / g.length;
    const md = g.reduce((a, o) => a + o.pModello, 0) / g.length;
    const reale = g.filter((o) => o.avvenuto).length / g.length;
    // Chi è più vicino alla frequenza osservata?
    const vince = Math.abs(md - reale) < Math.abs(mk - reale) ? "MODELLO" : "mercato";
    tabella.push({ fascia: nome, n: g.length, mercato: mk, modello: md, reale, piu_vicino: vince });
    process.stdout.write(
      `${nome.padEnd(24)}${String(g.length).padStart(7)}${(mk * 100).toFixed(1).padStart(9)}%${(md * 100).toFixed(1).padStart(9)}%${(reale * 100).toFixed(1).padStart(9)}%   ${vince}\n`,
    );
  }

  mkdirSync(join(process.cwd(), "audit"), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      { generated_at: new Date().toISOString(), seasons: [...stagioni], matches: valutate, bands: tabella },
      null,
      2,
    ),
  );
  process.stdout.write(`\n-> ${OUT}\n`);
}

main();
