/**
 * Exchange e commissioni. Modulo senza dipendenze: lo usano anche gli script
 * che girano senza alias di percorso (clv-settle).
 */

/** Commissione sulle vincite nette, per piattaforma. */
export const EXCHANGE_COMMISSION: Record<string, number> = {
  betfair: 0.05,
  "betfair exchange": 0.05,
  smarkets: 0.02,
  matchbook: 0.015,
  betdaq: 0.02,
  prophetx: 0.03,
  novig: 0,
  rebet: 0,
};

/** Vero per gli exchange: prezzi al lordo di commissione, non confrontabili con i book. */
export function isExchangeBook(book: string): boolean {
  return EXCHANGE_COMMISSION[book.trim().toLowerCase()] != null;
}
