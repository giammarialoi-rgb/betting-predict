/**
 * Source abstraction — Odds API is one adapter; catalogs can be swapped later.
 * No scraping of sites that forbid access.
 */

export type SportCatalogRow053 = {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights: boolean;
};

export type SourceAdapter053 = {
  name: string;
  discoverSports(): Promise<{ sports: SportCatalogRow053[]; error: string | null }>;
  discoverEvents?(sportKey: string): Promise<{ events: unknown[]; error: string | null }>;
  collectOdds?(sportKey: string, markets: string): Promise<{ events: unknown[]; quotes: unknown[]; error: string | null }>;
};

/** Placeholder for future external event catalogs (no aggressive scraping). */
export type ExternalEventCatalogAdapter053 = {
  name: string;
  listEvents(): Promise<
    {
      sport: string;
      league: string;
      home: string;
      away: string;
      kickoff_utc: string | null;
      source_event_id: string;
    }[]
  >;
};

export const ODDS_API_ADAPTER_NAME_053 = "OddsApiAdapter";
export const EXTERNAL_CATALOG_ADAPTER_NAME_053 = "ExternalEventCatalogAdapter";
