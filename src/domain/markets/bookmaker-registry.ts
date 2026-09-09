/**
 * Bookmaker registry — operators that offer prices.
 * Distinct from data sources (technical origin / aggregators).
 */

export type BookmakerRecord = {
  slug: string;
  name: string;
  /** Verified presence in our datasets — never invent. */
  status: "VERIFIED" | "CATALOGUED" | "UNKNOWN";
};

export const BOOKMAKER_REGISTRY: readonly BookmakerRecord[] = Object.freeze([
  { slug: "pinnacle", name: "Pinnacle", status: "VERIFIED" },
  { slug: "bet365", name: "Bet365", status: "VERIFIED" },
  { slug: "william-hill", name: "William Hill", status: "VERIFIED" },
  { slug: "bet-and-win", name: "Bet&Win", status: "CATALOGUED" },
  { slug: "interwetten", name: "Interwetten", status: "CATALOGUED" },
  { slug: "vc-bet", name: "VC Bet", status: "CATALOGUED" },
  { slug: "unibet", name: "Unibet", status: "UNKNOWN" },
  { slug: "bwin", name: "Bwin", status: "UNKNOWN" },
  { slug: "ladbrokes", name: "Ladbrokes", status: "UNKNOWN" },
  { slug: "coral", name: "Coral", status: "UNKNOWN" },
  { slug: "10bet", name: "10Bet", status: "UNKNOWN" },
  { slug: "betway", name: "Betway", status: "UNKNOWN" },
  { slug: "betvictor", name: "BetVictor", status: "UNKNOWN" },
  { slug: "skybet", name: "Sky Bet", status: "UNKNOWN" },
  { slug: "888sport", name: "888sport", status: "UNKNOWN" },
  { slug: "marathon", name: "Marathonbet", status: "UNKNOWN" },
  { slug: "sbobet", name: "SBOBET", status: "UNKNOWN" },
  { slug: "1xbet", name: "1xBet", status: "UNKNOWN" },
  { slug: "betfair-ex", name: "Betfair Exchange", status: "UNKNOWN" },
  { slug: "matchbook", name: "Matchbook", status: "UNKNOWN" },
]);

export function getBookmaker(slug: string): BookmakerRecord | undefined {
  return BOOKMAKER_REGISTRY.find((b) => b.slug === slug);
}

export function listVerifiedBookmakers(): BookmakerRecord[] {
  return BOOKMAKER_REGISTRY.filter((b) => b.status === "VERIFIED");
}

/** Aggregates are never bookmakers. */
export function assertBookmakerNotAggregate(slug: string): void {
  const s = slug.toLowerCase();
  if (
    s === "max" ||
    s === "avg" ||
    s === "average" ||
    s.startsWith("max") ||
    s.startsWith("avg") ||
    s.startsWith("bbmax") ||
    s.startsWith("bbav")
  ) {
    throw new Error(`AGGREGATE_NOT_BOOKMAKER: ${slug}`);
  }
}
