/**
 * The Odds API historical snapshot format (public documentation).
 * last_update is EXACT_TIMESTAMP when present.
 * Bulk historical archive is paid — not ingested for STRICT capital.
 */

import type { SportId020 } from "@/domain/eval/capital-020/types";
import type { MarketObservationLedger } from "@/domain/eval/capital-021/types";
import { assertIndividualBookmaker } from "@/domain/eval/capital-021/ledger";

type OddsApiOutcome = { name?: string; price?: number; point?: number };
type OddsApiMarket = {
  key?: string;
  last_update?: string;
  outcomes?: OddsApiOutcome[];
};
type OddsApiBook = {
  key?: string;
  title?: string;
  last_update?: string;
  markets?: OddsApiMarket[];
};
type OddsApiEvent = {
  id?: string;
  sport_key?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OddsApiBook[];
};
export type OddsApiHistoricalSnapshot = {
  timestamp?: string;
  previous_timestamp?: string;
  next_timestamp?: string;
  data?: OddsApiEvent[];
};

function sportFromKey(key: string | undefined): SportId020 {
  if (!key) return "other";
  if (key.startsWith("soccer")) return "football";
  if (key.startsWith("basketball")) return "basketball";
  if (key.startsWith("tennis")) return "tennis";
  if (key.startsWith("baseball")) return "baseball";
  if (key.startsWith("icehockey") || key.startsWith("ice_hockey")) return "ice_hockey";
  if (key.startsWith("americanfootball")) return "american_football";
  return "other";
}

function marketFromKey(key: string | undefined): string {
  if (key === "h2h") return "1X2";
  if (key === "totals") return "TOTAL_GOALS";
  if (key === "spreads") return "ASIAN_HANDICAP";
  return key ?? "UNKNOWN";
}

function selectionName(name: string | undefined, home: string | undefined, away: string | undefined): string {
  if (!name) return "UNKNOWN";
  if (home && name === home) return "HOME";
  if (away && name === away) return "AWAY";
  const n = name.toLowerCase();
  if (n === "draw" || n === "tie") return "DRAW";
  if (n === "over") return "OVER";
  if (n === "under") return "UNDER";
  return name;
}

/**
 * Parse a documented historical snapshot.
 * `usable_strict_capital` is false unless the caller marks a licensed acquisition.
 */
export function parseOddsApiHistoricalSnapshot(
  snap: OddsApiHistoricalSnapshot,
  opts: { usableStrictCapital?: boolean; sourceUrl?: string } = {},
): MarketObservationLedger[] {
  const out: MarketObservationLedger[] = [];
  const observedAt = snap.timestamp ?? new Date().toISOString();
  for (const ev of snap.data ?? []) {
    for (const book of ev.bookmakers ?? []) {
      const bookId = (book.key ?? book.title ?? "").toLowerCase();
      if (!bookId) continue;
      assertIndividualBookmaker(bookId);
      for (const m of book.markets ?? []) {
        const last = m.last_update ?? book.last_update ?? null;
        const exact = last != null && Number.isFinite(Date.parse(last));
        for (const o of m.outcomes ?? []) {
          if (o.price == null || o.price <= 1) continue;
          out.push({
            sport: sportFromKey(ev.sport_key),
            event: ev.id ?? `${ev.home_team}|${ev.away_team}`,
            market: marketFromKey(m.key),
            line: o.point ?? null,
            selection: selectionName(o.name, ev.home_team, ev.away_team),
            bookmaker: bookId,
            price: o.price,
            timestamp: exact ? last : null,
            temporal_precision: exact ? "EXACT_TIMESTAMP" : "UNKNOWN",
            source: "the-odds-api-historical",
            source_url: opts.sourceUrl ?? "https://the-odds-api.com/liveapi/guides/v4/",
            observed_at: observedAt,
            available_at: exact ? last : null,
            usable_strict_capital: Boolean(opts.usableStrictCapital) && exact,
            observationKind: "intermediate",
            upstreamCluster: "the-odds-api",
          });
        }
      }
    }
  }
  return out;
}

/** Public documentation example from The Odds API v4 historical endpoint. */
export const ODDS_API_DOCS_SAMPLE: OddsApiHistoricalSnapshot = {
  timestamp: "2021-10-18T11:55:00Z",
  previous_timestamp: "2021-10-18T11:45:00Z",
  next_timestamp: "2021-10-18T12:05:00Z",
  data: [
    {
      id: "4edd5ce090a3ec6192053b10d27b87b0",
      sport_key: "americanfootball_nfl",
      home_team: "Tennessee Titans",
      away_team: "Buffalo Bills",
      bookmakers: [
        {
          key: "draftkings",
          title: "DraftKings",
          last_update: "2021-10-18T11:48:09Z",
          markets: [
            {
              key: "h2h",
              last_update: "2021-10-18T11:48:09Z",
              outcomes: [
                { name: "Tennessee Titans", price: 1.91 },
                { name: "Buffalo Bills", price: 1.91 },
              ],
            },
          ],
        },
      ],
    },
  ],
};
