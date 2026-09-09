import { getMarket } from "@/domain/markets/catalog";
import { marketIdentityKey } from "@/domain/markets/lines";
import type { MarketReadiness } from "@/domain/markets/types";

/**
 * Observed market discovery — what was actually offered, not catalogue theory.
 */

export type ObservedMarketOffer = {
  eventId: string;
  sportId: string;
  competitionId?: string;
  bookmakerSlug: string;
  providerSlug: string;
  marketId: string;
  line: number | null;
  selection: string;
  teamRef?: string | null;
  playerRef?: string | null;
  observedAt: Date;
  availableAt: Date;
  oddsDecimal: number;
};

export type MarketDiscoveryRecord = {
  key: string;
  eventId: string;
  bookmakerSlug: string;
  providerSlug: string;
  marketId: string;
  line: number | null;
  selectionsSeen: string[];
  readiness: MarketReadiness;
  firstAvailableAt: Date;
  lastAvailableAt: Date;
  quoteCount: number;
};

export function discoverMarketsFromOffers(
  offers: readonly ObservedMarketOffer[],
): MarketDiscoveryRecord[] {
  const map = new Map<string, MarketDiscoveryRecord>();
  for (const offer of offers) {
    const catalog = getMarket(offer.marketId);
    const key = [
      offer.eventId,
      offer.bookmakerSlug,
      offer.marketId,
      offer.line === null ? "" : String(offer.line),
    ].join("|");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        eventId: offer.eventId,
        bookmakerSlug: offer.bookmakerSlug,
        providerSlug: offer.providerSlug,
        marketId: offer.marketId,
        line: offer.line,
        selectionsSeen: [offer.selection],
        readiness: catalog ? "DISCOVERED" : "DISCOVERED",
        firstAvailableAt: offer.availableAt,
        lastAvailableAt: offer.availableAt,
        quoteCount: 1,
      });
      continue;
    }
    if (!existing.selectionsSeen.includes(offer.selection)) {
      existing.selectionsSeen.push(offer.selection);
    }
    existing.quoteCount += 1;
    if (offer.availableAt < existing.firstAvailableAt) {
      existing.firstAvailableAt = offer.availableAt;
    }
    if (offer.availableAt > existing.lastAvailableAt) {
      existing.lastAvailableAt = offer.availableAt;
    }
    if (existing.quoteCount >= 3 && catalog) {
      existing.readiness = "OBSERVED";
    }
  }
  return [...map.values()];
}

export function listBookmakerMarketsForEvent(
  records: readonly MarketDiscoveryRecord[],
  eventId: string,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of records) {
    if (r.eventId !== eventId) continue;
    const arr = out.get(r.bookmakerSlug) ?? [];
    const label =
      r.line === null ? r.marketId : `${r.marketId}@${r.line}`;
    if (!arr.includes(label)) arr.push(label);
    out.set(r.bookmakerSlug, arr);
  }
  return out;
}

export function offerIdentity(offer: ObservedMarketOffer): string {
  return marketIdentityKey({
    marketType: offer.marketId,
    selection: offer.selection,
    line: offer.line,
    teamRef: offer.teamRef,
    playerRef: offer.playerRef,
  });
}
