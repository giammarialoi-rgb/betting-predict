/**
 * CLV IN AVANTI — una misura che puo dire "no".
 *
 * La versione precedente prendeva come "prezzo preso" il MASSIMO fra tutte le
 * osservazioni prepartita e come "chiusura" l'ULTIMA di quelle stesse
 * osservazioni. Il massimo di un insieme e sempre >= ogni suo membro, quindi
 * CLV >= 0 per costruzione: piu istantanee si accumulavano, piu il numero saliva
 * (+1,2% con 2 istantanee, +5,1% con 17 o piu), senza che il mercato avesse
 * detto nulla. In piu scartava i casi in cui il massimo coincideva con l'ultima
 * osservazione, cioe proprio quelli sfavorevoli.
 *
 * Qui le due quantita sono indipendenti:
 *
 *   presa    = prezzo netto alla PRIMA volta che la selezione ha superato i
 *              filtri (quello che si poteva davvero giocare in quel momento);
 *   chiusura = prezzo EQUO (consenso Pinnacle de-viggato, Shin) dell'ultima
 *              osservazione prepartita SUCCESSIVA alla presa.
 *
 *   CLV = presa / chiusura_equa - 1        (puo essere negativo)
 *
 * Fonti della chiusura:
 *  - "marks": l'istantanea registra il prezzo equo di TUTTI gli esiti degli
 *    eventi entro l'orizzonte, anche quando l'edge e sotto soglia. E la fonte
 *    pulita: non dipende dal fatto che la selezione resti sopra soglia.
 *  - "rows": per le istantanee vecchie esiste solo la riga sopra soglia. Una
 *    selezione esce dalle righe proprio quando il consenso si muove contro di
 *    lei, quindi l'ultimo prezzo equo visto e anteriore a quel movimento: la
 *    stima e distorta verso l'alto. Si riporta, ma non entra nel verdetto.
 */
import { GATE_DEFAULTS } from "@/domain/markets/scan-gates";

export type SnapshotRow = {
  eventId: string;
  outcome: string;
  commence: string;
  home: string;
  away: string;
  bestBook: string;
  priceNet: number;
  fairPrice: number;
  edge: number;
  nBooks: number;
  consensus?: string;
};

export type SnapshotMark = {
  eventId: string;
  outcome: string;
  commence: string;
  fairPrice: number;
  nBooks: number;
  consensus?: string;
};

export type Snapshot = {
  run_at: string;
  rows: SnapshotRow[];
  marks?: SnapshotMark[];
};

export type ClvOptions = {
  /** Distanza minima fra presa e chiusura, in minuti. */
  minGapMinutes?: number;
  /** Una chiusura piu lontana di cosi dal via non vale come chiusura (ore). */
  maxCloseGapHours?: number;
  /** Orizzonte massimo della presa rispetto al via (ore). */
  maxTakeHorizonHours?: number;
  /** Edge oltre il quale la riga e trattata come quota guasta. */
  maxEdge?: number;
  minBooks?: number;
  /** La chiusura vale solo se il consenso e Pinnacle de-viggato (non una mediana). */
  requireSharp?: boolean;
};

export const CLV_DEFAULTS: Required<ClvOptions> = {
  minGapMinutes: 30,
  maxCloseGapHours: 6,
  maxTakeHorizonHours: GATE_DEFAULTS.horizonHours,
  maxEdge: GATE_DEFAULTS.maxEdge,
  minBooks: GATE_DEFAULTS.minBooks,
  requireSharp: true,
};

export type ClvEntry = {
  eventId: string;
  event: string;
  outcome: string;
  book: string;
  takenAt: string;
  takePrice: number;
  closedAt: string;
  closeFair: number;
  closeSource: "marks" | "rows";
  closeToKickoffH: number;
  takeToKickoffH: number;
  clv: number;
};

export type ClvSummary = {
  n: number;
  events: number;
  mean: number;
  median: number;
  share_positive: number;
  share_negative: number;
  share_zero: number;
  ci95: [number, number] | null;
};

export type ClvResult = {
  entries: ClvEntry[];
  /** Selezioni prese ma senza una chiusura valida: l'attrito va dichiarato. */
  taken: number;
  withoutClose: number;
  excludedRows: Record<string, number>;
  clean: ClvSummary | null;
  legacy: ClvSummary | null;
  byBand: Record<string, ClvSummary | null>;
};

const H = 3_600_000;
const sharpOk = (consensus: string | undefined, o: Required<ClvOptions>): boolean =>
  !o.requireSharp || consensus == null || consensus === "Pinnacle";
const key = (eventId: string, outcome: string): string => `${eventId}|${outcome}`;

/** Righe che non devono contare come "prese": quote guaste, mercati sottili, exchange. */
export function isExcludedRow(
  r: SnapshotRow,
  runAtMs: number,
  allRowsOfEvent: readonly SnapshotRow[],
  minEdge: number,
  o: Required<ClvOptions>,
  isExchange: (book: string) => boolean,
): string | null {
  const via = Date.parse(r.commence);
  if (!Number.isFinite(via) || runAtMs >= via) return "gia_iniziata";
  if (via - runAtMs > o.maxTakeHorizonHours * H) return "oltre_orizzonte";
  if (!(r.edge < o.maxEdge)) return "edge_oltre_soglia";
  if (r.nBooks < o.minBooks) return "pochi_book";
  if (isExchange(r.bestBook)) return "exchange";
  // Tutti gli esiti sopra soglia sulla stessa partita: prezzi guasti, non edge.
  if (allRowsOfEvent.length >= 3 && allRowsOfEvent.every((x) => x.edge >= minEdge)) return "tutti_gli_esiti";
  return null;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Media con IC 95% bootstrap a blocchi: il blocco e l'evento, non la selezione. */
export function summarise(entries: readonly ClvEntry[], seed = 7, draws = 2000): ClvSummary | null {
  if (!entries.length) return null;
  const xs = entries.map((e) => e.clv).sort((a, b) => a - b);
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? xs[(n - 1) / 2]! : (xs[n / 2 - 1]! + xs[n / 2]!) / 2;
  const byEvent = new Map<string, number[]>();
  for (const e of entries) {
    const a = byEvent.get(e.eventId) ?? [];
    a.push(e.clv);
    byEvent.set(e.eventId, a);
  }
  const groups = [...byEvent.values()];
  let ci: [number, number] | null = null;
  if (groups.length >= 5) {
    const rnd = mulberry32(seed);
    const means: number[] = [];
    for (let d = 0; d < draws; d++) {
      let s = 0;
      let c = 0;
      for (let i = 0; i < groups.length; i++) {
        const g = groups[Math.floor(rnd() * groups.length)]!;
        for (const v of g) {
          s += v;
          c += 1;
        }
      }
      means.push(s / c);
    }
    means.sort((a, b) => a - b);
    ci = [means[Math.floor(0.025 * draws)]!, means[Math.floor(0.975 * draws)]!];
  }
  const eps = 1e-12;
  return {
    n,
    events: groups.length,
    mean,
    median,
    share_positive: xs.filter((x) => x > eps).length / n,
    share_negative: xs.filter((x) => x < -eps).length / n,
    share_zero: xs.filter((x) => Math.abs(x) <= eps).length / n,
    ci95: ci,
  };
}

export function priceBand(p: number): string {
  if (p <= 2.5) return "<=2.50";
  if (p <= 5) return "2.50-5.00";
  return ">5.00";
}

export function computeClv(
  snapshots: readonly Snapshot[],
  isExchange: (book: string) => boolean,
  minEdge: number,
  opts: ClvOptions = {},
): ClvResult {
  const o = { ...CLV_DEFAULTS, ...opts };
  const snaps = [...snapshots].sort((a, b) => Date.parse(a.run_at) - Date.parse(b.run_at));

  const excludedRows: Record<string, number> = {};
  const take = new Map<string, { row: SnapshotRow; at: string }>();
  // Riferimenti equi per selezione: [tempo, prezzo equo, fonte]
  const refs = new Map<string, Array<{ at: string; t: number; fair: number; source: "marks" | "rows" }>>();

  for (const s of snaps) {
    const t = Date.parse(s.run_at);
    const perEvent = new Map<string, SnapshotRow[]>();
    for (const r of s.rows ?? []) {
      const a = perEvent.get(r.eventId) ?? [];
      a.push(r);
      perEvent.set(r.eventId, a);
    }
    for (const r of s.rows ?? []) {
      const via = Date.parse(r.commence);
      if (Number.isFinite(via) && t < via && r.fairPrice > 1 && sharpOk(r.consensus, o)) {
        const k = key(r.eventId, r.outcome);
        const a = refs.get(k) ?? [];
        a.push({ at: s.run_at, t, fair: r.fairPrice, source: "rows" });
        refs.set(k, a);
      }
      const why = isExcludedRow(r, t, perEvent.get(r.eventId) ?? [], minEdge, o, isExchange);
      if (why) {
        excludedRows[why] = (excludedRows[why] ?? 0) + 1;
        continue;
      }
      const k = key(r.eventId, r.outcome);
      if (!take.has(k)) take.set(k, { row: r, at: s.run_at }); // PRIMA presa, non la migliore
    }
    for (const m of s.marks ?? []) {
      const via = Date.parse(m.commence);
      if (!Number.isFinite(via) || t >= via || !(m.fairPrice > 1) || !sharpOk(m.consensus, o)) continue;
      const k = key(m.eventId, m.outcome);
      const a = refs.get(k) ?? [];
      a.push({ at: s.run_at, t, fair: m.fairPrice, source: "marks" });
      refs.set(k, a);
    }
  }

  const entries: ClvEntry[] = [];
  let withoutClose = 0;
  for (const [k, tk] of take) {
    const t0 = Date.parse(tk.at);
    const via = Date.parse(tk.row.commence);
    const cands = (refs.get(k) ?? []).filter(
      (x) => x.t - t0 >= o.minGapMinutes * 60_000 && via - x.t <= o.maxCloseGapHours * H,
    );
    if (!cands.length) {
      withoutClose += 1;
      continue;
    }
    // L'ultima osservazione utile; a parita di istante vince "marks".
    cands.sort((a, b) => a.t - b.t || (a.source === "marks" ? 1 : -1));
    const close = cands[cands.length - 1]!;
    entries.push({
      eventId: tk.row.eventId,
      event: `${tk.row.home} - ${tk.row.away}`,
      outcome: tk.row.outcome,
      book: tk.row.bestBook,
      takenAt: tk.at,
      takePrice: tk.row.priceNet,
      closedAt: close.at,
      closeFair: close.fair,
      closeSource: close.source,
      closeToKickoffH: (via - close.t) / H,
      takeToKickoffH: (via - t0) / H,
      clv: tk.row.priceNet / close.fair - 1,
    });
  }

  const clean = entries.filter((e) => e.closeSource === "marks");
  const byBand: Record<string, ClvSummary | null> = {};
  for (const band of ["<=2.50", "2.50-5.00", ">5.00"]) {
    byBand[band] = summarise(clean.filter((e) => priceBand(e.takePrice) === band));
  }
  return {
    entries,
    taken: take.size,
    withoutClose,
    excludedRows,
    clean: summarise(clean),
    legacy: summarise(entries.filter((e) => e.closeSource === "rows")),
    byBand,
  };
}

export const CLV_MIN_N = 300;
export const CLV_MIN_EVENTS = 100;

/** Il verdetto esiste solo sul campione pulito e abbastanza grande. */
export function clvVerdict(
  clean: ClvSummary | null,
): { ready: false; missing: number } | { ready: true; supports_backtest: boolean | null; reading: string } {
  if (!clean || clean.n < CLV_MIN_N || clean.events < CLV_MIN_EVENTS) {
    return { ready: false, missing: Math.max(CLV_MIN_N - (clean?.n ?? 0), 0) };
  }
  const [lo, hi] = clean.ci95 ?? [NaN, NaN];
  if (!Number.isFinite(lo)) return { ready: true, supports_backtest: null, reading: "IC non calcolabile" };
  if (lo > 0) return { ready: true, supports_backtest: true, reading: "IC 95% interamente sopra zero" };
  if (hi < 0) return { ready: true, supports_backtest: false, reading: "IC 95% interamente sotto zero" };
  return { ready: true, supports_backtest: null, reading: "IC 95% attraversa lo zero: nessuna conclusione" };
}
