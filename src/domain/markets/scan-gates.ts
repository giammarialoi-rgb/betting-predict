/**
 * FILTRI DELLA SCANSIONE — cosa non deve mai entrare nel registro.
 *
 * Le scansioni di ottobre avevano tre difetti che gonfiavano il registro:
 *  1. partite gia iniziate (prezzi live, non prepartita);
 *  2. mercati lontani nel tempo e sottili (il 90% delle righe era oltre 48 ore),
 *     dove nascono le quote guaste;
 *  3. righe con edge del 25-60% o con tutti gli esiti di una partita sopra
 *     soglia, che non sono vantaggio ma prezzi rotti.
 *
 * Modulo senza dipendenze: lo usano la scansione e il calcolo del CLV, cosi i
 * due non possono divergere.
 */

export type GateConfig = {
  minEdge: number;
  /** Edge pari o superiore: quota guasta, in quarantena. */
  maxEdge: number;
  /** Sotto questo numero di book il consenso e troppo fragile. */
  minBooks: number;
  /** Solo eventi che iniziano entro questo numero di ore. */
  horizonHours: number;
  /** Un evento che inizia fra meno di cosi e gia troppo vicino per giocarlo. */
  startBufferMinutes: number;
};

export const GATE_DEFAULTS: GateConfig = {
  minEdge: 0.02,
  maxEdge: 0.2,
  minBooks: 8,
  horizonHours: 48,
  startBufferMinutes: 10,
};

export type EventWindow = "ok" | "iniziata" | "oltre_orizzonte" | "data_non_valida";

export function eventWindow(commenceIso: string, nowMs: number, cfg: Pick<GateConfig, "horizonHours" | "startBufferMinutes">): EventWindow {
  const via = Date.parse(commenceIso);
  if (!Number.isFinite(via)) return "data_non_valida";
  if (via - nowMs < cfg.startBufferMinutes * 60_000) return "iniziata";
  if (via - nowMs > cfg.horizonHours * 3_600_000) return "oltre_orizzonte";
  return "ok";
}

export type GateReason = "pochi_book" | "tutti_gli_esiti" | "edge_oltre_soglia";

export function gateEdges<T extends { edge: number }>(
  edges: readonly T[],
  nBooks: number,
  cfg: Pick<GateConfig, "minEdge" | "maxEdge" | "minBooks">,
): { accepted: T[]; quarantined: Array<{ item: T; reason: GateReason }> } {
  const candidates = edges.filter((e) => e.edge >= cfg.minEdge);
  const accepted: T[] = [];
  const quarantined: Array<{ item: T; reason: GateReason }> = [];
  if (!candidates.length) return { accepted, quarantined };
  if (nBooks < cfg.minBooks) {
    return { accepted, quarantined: candidates.map((item) => ({ item, reason: "pochi_book" as const })) };
  }
  // Tutti gli esiti sopra soglia: la somma dei migliori prezzi scende sotto 1, cioe un arbitraggio.
  if (edges.length >= 3 && edges.every((e) => e.edge >= cfg.minEdge)) {
    return { accepted, quarantined: candidates.map((item) => ({ item, reason: "tutti_gli_esiti" as const })) };
  }
  for (const item of candidates) {
    if (item.edge >= cfg.maxEdge) quarantined.push({ item, reason: "edge_oltre_soglia" });
    else accepted.push(item);
  }
  return { accepted, quarantined };
}
