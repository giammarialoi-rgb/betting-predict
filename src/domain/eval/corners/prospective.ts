/**
 * Regolazione e verdetto delle osservazioni corner prospettiche.
 *
 * Il ledger registra linea, prezzo e probabilita del modello prima del calcio
 * d'inizio; qui si chiude il cerchio con i corner davvero giocati e si confronta
 * il modello con il mercato DE-VIGGATO alle quote realmente offerte. Non contro
 * una media di lega: quella dice solo se il modello sa qualcosa, non se quel
 * qualcosa sopravvive al prezzo.
 *
 * Tutto quello che sta qui e puro, cosi la logica si verifica senza aspettare
 * che le partite finiscano.
 */

export type CornerObs = {
  division: string;
  event_id: string;
  commence_time: string;
  home: string;
  away: string;
  bookmaker: string;
  market: string;
  scope: "total" | "home" | "away";
  side: "OVER" | "UNDER";
  line: number;
  price: number;
  model_probability: number;
  settled: boolean;
  result_corners_home: number | null;
  result_corners_away: number | null;
};

export type CornerResult = { hc: number; ac: number; dayMs: number };

export const MIN_SELEZIONI = 300;

export function resultKey(division: string, home: string, away: string): string {
  return `${division}\u0000${home}\u0000${away}`;
}

/** Corner che contano per questa riga: totale partita oppure di una sola squadra. */
export function countForScope(scope: CornerObs["scope"], r: CornerResult): number {
  if (scope === "home") return r.hc;
  if (scope === "away") return r.ac;
  return r.hc + r.ac;
}

/**
 * Riempie il risultato nelle righe ancora aperte. Una riga si chiude solo se
 * esiste UNA sola partita compatibile entro due giorni dal calcio d'inizio:
 * un abbinamento ambiguo resta aperto invece di indovinare.
 */
export function settleObservations(
  oss: CornerObs[],
  risultati: ReadonlyMap<string, readonly CornerResult[]>,
): number {
  let n = 0;
  for (const o of oss) {
    if (o.settled) continue;
    const t = Date.parse(o.commence_time);
    if (!Number.isFinite(t)) continue;
    const cands = (risultati.get(resultKey(o.division, o.home, o.away)) ?? []).filter(
      (r) => Math.abs(r.dayMs - t) <= 2 * 86_400_000,
    );
    if (cands.length !== 1) continue;
    o.result_corners_home = cands[0]!.hc;
    o.result_corners_away = cands[0]!.ac;
    o.settled = true;
    n += 1;
  }
  return n;
}

/** Margine tolto in proporzione alle implicite. Due esiti, partizione vera. */
export function devigTwoWay(priceOver: number, priceUnder: number): number | null {
  if (!(priceOver > 1) || !(priceUnder > 1)) return null;
  const s = 1 / priceOver + 1 / priceUnder;
  if (!(s > 0.98)) return null;
  return 1 / priceOver / s;
}

export function logLoss(rows: ReadonlyArray<{ p: number; hit: boolean }>): number {
  if (!rows.length) return NaN;
  return -rows.reduce((a, r) => a + Math.log(Math.max(1e-12, r.hit ? r.p : 1 - r.p)), 0) / rows.length;
}

export type Selezione = {
  eventId: string;
  line: number;
  modelOver: number;
  marketOver: number;
  hitOver: boolean;
  margin: number;
  bestOver: number;
  bestUnder: number;
};

/**
 * Una selezione per (partita, linea): il mercato e il consenso de-viggato fra i
 * book, il prezzo giocabile e il migliore disponibile. Le linee finite in
 * pareggio esatto sono rimborsi, non esiti, e vengono escluse.
 */
export function buildSelections(chiuse: readonly CornerObs[]): Selezione[] {
  type Blocco = { over?: CornerObs; under?: CornerObs };
  const blocchi = new Map<string, Blocco>();
  for (const o of chiuse) {
    if (o.scope !== "total" || !o.settled) continue;
    if (o.result_corners_home == null || o.result_corners_away == null) continue;
    const k = `${o.event_id}|${o.line}|${o.bookmaker}`;
    const b = blocchi.get(k) ?? {};
    if (o.side === "OVER") b.over = o;
    else b.under = o;
    blocchi.set(k, b);
  }

  const per = new Map<string, Selezione & { _mk: number[]; _mg: number[] }>();
  for (const b of blocchi.values()) {
    if (!b.over || !b.under) continue;
    const pm = devigTwoWay(b.over.price, b.under.price);
    if (pm == null) continue;
    const conta = countForScope(b.over.scope, {
      hc: b.over.result_corners_home!,
      ac: b.over.result_corners_away!,
      dayMs: 0,
    });
    if (conta === b.over.line) continue;
    const k = `${b.over.event_id}|${b.over.line}`;
    const cur =
      per.get(k) ??
      {
        eventId: b.over.event_id, line: b.over.line,
        modelOver: b.over.model_probability, marketOver: 0,
        hitOver: conta > b.over.line, margin: 0, bestOver: 0, bestUnder: 0,
        _mk: [], _mg: [],
      };
    cur._mk.push(pm);
    cur._mg.push(1 / b.over.price + 1 / b.under.price - 1);
    cur.bestOver = Math.max(cur.bestOver, b.over.price);
    cur.bestUnder = Math.max(cur.bestUnder, b.under.price);
    per.set(k, cur);
  }

  const out: Selezione[] = [];
  for (const v of per.values()) {
    const mean = (xs: number[]) => xs.reduce((a, b2) => a + b2, 0) / xs.length;
    out.push({
      eventId: v.eventId, line: v.line, modelOver: v.modelOver,
      marketOver: mean(v._mk), hitOver: v.hitOver, margin: mean(v._mg),
      bestOver: v.bestOver, bestUnder: v.bestUnder,
    });
  }
  return out;
}

export type Verdetto = {
  n: number;
  meanMargin: number;
  logLossModel: number;
  logLossMarket: number;
  deltaMillesimi: number;
  simulation: Array<{ soglia: number; giocate: number; rendimento: number }>;
};

/** null finche il campione e troppo piccolo: meglio nessuna cifra di una rumorosa. */
export function buildVerdict(sel: readonly Selezione[], minN = MIN_SELEZIONI): Verdetto | null {
  if (sel.length < minN) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const llMd = logLoss(sel.map((s) => ({ p: s.modelOver, hit: s.hitOver })));
  const llMk = logLoss(sel.map((s) => ({ p: s.marketOver, hit: s.hitOver })));
  const simulation = [0.02, 0.04, 0.06].map((soglia) => {
    let giocate = 0;
    let pnl = 0;
    for (const s of sel) {
      for (const lato of ["OVER", "UNDER"] as const) {
        const prezzo = lato === "OVER" ? s.bestOver : s.bestUnder;
        const p = lato === "OVER" ? s.modelOver : 1 - s.modelOver;
        if (!(prezzo > 1) || p * prezzo - 1 < soglia) continue;
        giocate += 1;
        const vinta = lato === "OVER" ? s.hitOver : !s.hitOver;
        pnl += vinta ? prezzo - 1 : -1;
      }
    }
    return { soglia, giocate, rendimento: giocate ? pnl / giocate : 0 };
  });
  return {
    n: sel.length,
    meanMargin: mean(sel.map((s) => s.margin)),
    logLossModel: llMd,
    logLossMarket: llMk,
    deltaMillesimi: (llMd - llMk) * 1000,
    simulation,
  };
}
