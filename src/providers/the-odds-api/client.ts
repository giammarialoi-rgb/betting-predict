/**
 * Client The Odds API v4, con contabilita dei crediti.
 *
 * Il piano e a consumo, quindi il costo non si stima: si misura. Ogni risposta
 * porta x-requests-last (costo della chiamata), x-requests-used e
 * x-requests-remaining; il client li legge e li accumula, e ogni script che lo
 * usa deve stampare il totale speso.
 *
 * Costi, dal listino ufficiale:
 *   /sports                      0
 *   /sports/{s}/events           0
 *   /sports/{s}/odds             1 per regione per mercato (tutta la lega)
 *   /sports/{s}/events/{id}/odds 1 per regione per mercato EFFETTIVAMENTE
 *                                restituito, per evento
 * L'ultima riga e il motivo per cui sondare i mercati corner costa quasi nulla
 * quando non ci sono: un mercato assente non viene addebitato.
 */
const BASE = "https://api.the-odds-api.com/v4";

export type OddsApiSport = {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
};

export type OddsApiOutcome = { name: string; price: number; point?: number; description?: string };
export type OddsApiMarket = { key: string; last_update: string; outcomes: OddsApiOutcome[] };
export type OddsApiBookmaker = { key: string; title: string; last_update: string; markets: OddsApiMarket[] };
export type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
};

export type CreditLedger = {
  calls: number;
  spent: number;
  remaining: number | null;
  used: number | null;
  byEndpoint: Map<string, { calls: number; spent: number }>;
};

export class OddsApiClient {
  readonly ledger: CreditLedger = {
    calls: 0,
    spent: 0,
    remaining: null,
    used: null,
    byEndpoint: new Map(),
  };

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("THE_ODDS_API_KEY mancante");
  }

  private async get<T>(path: string, params: Record<string, string>, label: string): Promise<T> {
    const qs = new URLSearchParams({ ...params, apiKey: this.apiKey });
    const res = await fetch(`${BASE}${path}?${qs}`);
    const last = Number(res.headers.get("x-requests-last") ?? "0");
    const used = res.headers.get("x-requests-used");
    const remaining = res.headers.get("x-requests-remaining");
    this.ledger.calls += 1;
    this.ledger.spent += Number.isFinite(last) ? last : 0;
    if (used != null) this.ledger.used = Number(used);
    if (remaining != null) this.ledger.remaining = Number(remaining);
    const e = this.ledger.byEndpoint.get(label) ?? { calls: 0, spent: 0 };
    e.calls += 1;
    e.spent += Number.isFinite(last) ? last : 0;
    this.ledger.byEndpoint.set(label, e);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${label} -> HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  /** Gratis. */
  listSports(): Promise<OddsApiSport[]> {
    return this.get<OddsApiSport[]>("/sports", { all: "false" }, "sports");
  }

  /** Gratis: eventi in programma, con gli id necessari per i mercati aggiuntivi. */
  listEvents(sportKey: string, opts?: { from?: string; to?: string }): Promise<OddsApiEvent[]> {
    const p: Record<string, string> = { dateFormat: "iso" };
    if (opts?.from) p.commenceTimeFrom = opts.from;
    if (opts?.to) p.commenceTimeTo = opts.to;
    return this.get<OddsApiEvent[]>(`/sports/${sportKey}/events`, p, "events");
  }

  /** 1 credito per regione per mercato, per l'intera lega. */
  leagueOdds(
    sportKey: string,
    markets: string[],
    regions = "eu",
  ): Promise<OddsApiEvent[]> {
    return this.get<OddsApiEvent[]>(
      `/sports/${sportKey}/odds`,
      { regions, markets: markets.join(","), oddsFormat: "decimal", dateFormat: "iso" },
      "leagueOdds",
    );
  }

  /** 1 credito per regione per mercato RESTITUITO, per singolo evento. */
  eventOdds(
    sportKey: string,
    eventId: string,
    markets: string[],
    regions = "eu",
  ): Promise<OddsApiEvent> {
    return this.get<OddsApiEvent>(
      `/sports/${sportKey}/events/${eventId}/odds`,
      { regions, markets: markets.join(","), oddsFormat: "decimal", dateFormat: "iso" },
      "eventOdds",
    );
  }

  report(): string {
    const lines = [
      `crediti spesi in questa esecuzione: ${this.ledger.spent}  (${this.ledger.calls} chiamate)`,
    ];
    for (const [k, v] of this.ledger.byEndpoint) {
      lines.push(`  ${k.padEnd(12)} ${String(v.calls).padStart(4)} chiamate  ${String(v.spent).padStart(5)} crediti`);
    }
    if (this.ledger.used != null && this.ledger.remaining != null) {
      lines.push(`  quota: ${this.ledger.used} usati, ${this.ledger.remaining} residui`);
    }
    return lines.join("\n");
  }
}

/** Mercati principali: costano per lega, non per evento. */
export const FEATURED_MARKETS = ["h2h", "totals", "spreads"] as const;

/** Mercati aggiuntivi da sondare: si pagano solo se esistono davvero. */
export const CORNER_MARKETS = [
  "alternate_totals_corners",
  "alternate_team_totals_corners",
  "corners_1x2",
] as const;

export const CARD_MARKETS = ["alternate_totals_cards", "alternate_spreads_cards"] as const;
