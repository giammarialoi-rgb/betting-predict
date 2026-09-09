import { join } from "node:path";
import { loadCreditState042, remainingCredits042, saveCreditState042 } from "@/domain/eval/collector-042/credit";
import { canAffordRun042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { labAStore044, permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { appendJournal044, loadStore044, appendJsonl044 } from "@/domain/eval/permanent-044/store";
import {
  bumpApiCalls045,
  loadDiscoveryState045,
  loadExp045Config,
  ODDS_MARKETS_SOCCER_045,
  ODDS_MARKETS_TENNIS_045,
  saveDiscoveryState045,
} from "@/domain/eval/factory-045/config";
import {
  fetchSportsCatalog045,
  pullSportOddsMulti045,
  selectSportsForPull045,
} from "@/domain/eval/factory-045/pull";
import { ingestDiscovered045 } from "@/domain/eval/factory-045/ingest";

export type DiscoverResult045 = {
  sports_catalog: number;
  soccer_keys: number;
  tennis_keys: number;
  sports_unavailable: string[];
  events_inserted: number;
  quotes_inserted: number;
  duplicates: number;
  api_calls: number;
  credits_remaining: number | null;
  skipped_reason: string | null;
  horizons: { TODAY: number; NEXT_24H: number; NEXT_72H: number; NEXT_7D: number };
};

function horizonCounts(kickoffs: (string | null)[], nowMs: number) {
  const day = 24 * 3600_000;
  const ks = kickoffs.map((k) => (k ? Date.parse(k) : NaN)).filter((t) => Number.isFinite(t) && t >= nowMs);
  return {
    TODAY: ks.filter((t) => t < nowMs + day).length,
    NEXT_24H: ks.filter((t) => t < nowMs + day).length,
    NEXT_72H: ks.filter((t) => t < nowMs + 3 * day).length,
    NEXT_7D: ks.filter((t) => t < nowMs + 7 * day).length,
  };
}

/**
 * Independent Lab B discovery — NEVER writes Lab A decisions/events.
 * Credits tracked via Lab A credit-state file (shared API budget) for accounting only.
 */
export async function runDiscover045(input: {
  labBRoot?: string;
  labARoot?: string;
  fetchImpl?: typeof fetch;
  force?: boolean;
  maxSports?: number;
  nowIso?: string;
}): Promise<DiscoverResult045> {
  loadExp045Config();
  const labB = input.labBRoot ?? permanentRoot044();
  const labA = input.labARoot ?? labAStore044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  let state = loadDiscoveryState045(labB);
  const cfg = loadGovernorConfig042();
  let credit = loadCreditState042(labA);

  const freshHours =
    state.last_discovery_at != null ? (nowMs - Date.parse(state.last_discovery_at)) / 3600_000 : 99;
  if (!input.force && freshHours < 2) {
    const store = loadStore044(labB);
    return {
      sports_catalog: 0,
      soccer_keys: 0,
      tennis_keys: 0,
      sports_unavailable: state.sports_unavailable,
      events_inserted: 0,
      quotes_inserted: 0,
      duplicates: 0,
      api_calls: 0,
      credits_remaining: remainingCredits042(credit),
      skipped_reason: "CATALOG_FRESH_SKIP_DISCOVERY",
      horizons: horizonCounts(
        store.events.map((e) => e.kickoff_utc),
        nowMs,
      ),
    };
  }

  const afford = canAffordRun042(credit, 15, cfg);
  if (!afford.ok) {
    return {
      sports_catalog: 0,
      soccer_keys: 0,
      tennis_keys: 0,
      sports_unavailable: state.sports_unavailable,
      events_inserted: 0,
      quotes_inserted: 0,
      duplicates: 0,
      api_calls: 0,
      credits_remaining: remainingCredits042(credit),
      skipped_reason: afford.reason,
      horizons: { TODAY: 0, NEXT_24H: 0, NEXT_72H: 0, NEXT_7D: 0 },
    };
  }

  let apiCalls = 0;
  const catalog = await fetchSportsCatalog045({ fetchImpl: input.fetchImpl, creditState: credit });
  credit = catalog.creditState;
  apiCalls += 1;
  state = bumpApiCalls045(state, 1);
  state.last_sports_catalog_at = nowIso;

  appendJsonl044(join(labB, "source-health.jsonl"), {
    kind: "SPORTS_CATALOG",
    at: nowIso,
    count: catalog.sports.length,
    error: catalog.error,
    hash: catalog.raw_hash,
  });

  if (catalog.error) {
    state.last_error = catalog.error;
    saveDiscoveryState045(labB, state);
    saveCreditState042(credit, labA);
    return {
      sports_catalog: 0,
      soccer_keys: 0,
      tennis_keys: 0,
      sports_unavailable: [catalog.error],
      events_inserted: 0,
      quotes_inserted: 0,
      duplicates: 0,
      api_calls: apiCalls,
      credits_remaining: remainingCredits042(credit),
      skipped_reason: catalog.error,
      horizons: { TODAY: 0, NEXT_24H: 0, NEXT_72H: 0, NEXT_7D: 0 },
    };
  }

  const selected = selectSportsForPull045(catalog.sports);
  state.sports_unavailable = selected.unavailable_note;

  const maxSports = input.maxSports ?? 25;
  // Prefer major leagues first for budget, then remaining soccer, then tennis
  const preferredSoccer = [
    "soccer_epl",
    "soccer_italy_serie_a",
    "soccer_spain_la_liga",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
    "soccer_uefa_champs_league",
    "soccer_uefa_europa_league",
    "soccer_usa_mls",
    "soccer_netherlands_eredivisie",
    "soccer_portugal_primeira_liga",
  ];
  const soccerOrdered = [
    ...preferredSoccer.filter((k) => selected.soccer.includes(k)),
    ...selected.soccer.filter((k) => !preferredSoccer.includes(k)),
  ].slice(0, maxSports);
  const tennisOrdered = selected.tennis.slice(0, Math.max(0, maxSports - soccerOrdered.length));

  const store = loadStore044(labB);
  let eventsInserted = 0;
  let quotesInserted = 0;
  let duplicates = 0;
  const unavailable: string[] = [...selected.unavailable_note];

  for (const sport of soccerOrdered) {
    if (!canAffordRun042(credit, cfg.estimatedOddsCreditsPerSport + 2, cfg).ok) break;
    const pull = await pullSportOddsMulti045({
      sport,
      markets: ODDS_MARKETS_SOCCER_045,
      fetchImpl: input.fetchImpl,
      creditState: credit,
    });
    credit = pull.creditState;
    apiCalls += 1;
    state = bumpApiCalls045(state, 1);
    if (pull.market_status === "SPORT_UNAVAILABLE") {
      unavailable.push(sport);
      appendJsonl044(join(labB, "source-health.jsonl"), {
        kind: "SPORT_UNAVAILABLE",
        sport,
        at: nowIso,
      });
      continue;
    }
    const ing = ingestDiscovered045({
      store,
      sportKey: sport,
      events: pull.events,
      quotes: pull.quotes,
      collectedAt: nowIso,
      rawHash: pull.raw_hash,
    });
    eventsInserted += ing.eventsInserted;
    quotesInserted += ing.quotesInserted;
    duplicates += ing.duplicates;
    appendJsonl044(join(labB, "markets.jsonl"), {
      kind: "DISCOVERY_PULL",
      sport,
      markets_requested: ODDS_MARKETS_SOCCER_045,
      events: pull.events.length,
      quotes: pull.quotes.length,
      status: pull.market_status,
      error: pull.error,
      httpStatus: pull.httpStatus,
      at: nowIso,
    });
  }

  for (const sport of tennisOrdered) {
    if (!canAffordRun042(credit, cfg.estimatedOddsCreditsPerSport + 2, cfg).ok) break;
    const pull = await pullSportOddsMulti045({
      sport,
      markets: ODDS_MARKETS_TENNIS_045,
      fetchImpl: input.fetchImpl,
      creditState: credit,
    });
    credit = pull.creditState;
    apiCalls += 1;
    state = bumpApiCalls045(state, 1);
    if (pull.market_status === "SPORT_UNAVAILABLE") {
      unavailable.push(sport);
      appendJsonl044(join(labB, "source-health.jsonl"), {
        kind: "SPORT_UNAVAILABLE",
        sport,
        at: nowIso,
      });
      continue;
    }
    const ing = ingestDiscovered045({
      store,
      sportKey: sport,
      events: pull.events,
      quotes: pull.quotes,
      collectedAt: nowIso,
      rawHash: pull.raw_hash,
    });
    eventsInserted += ing.eventsInserted;
    quotesInserted += ing.quotesInserted;
    duplicates += ing.duplicates;
  }

  state.last_discovery_at = nowIso;
  state.sports_unavailable = [...new Set(unavailable)];
  state.last_error = null;
  saveDiscoveryState045(labB, state);
  saveCreditState042(credit, labA);

  appendJournal044(labB, {
    kind: "discover_045",
    eventsInserted,
    quotesInserted,
    soccer: soccerOrdered.length,
    tennis: tennisOrdered.length,
    apiCalls,
  });

  const storeAfter = loadStore044(labB);
  return {
    sports_catalog: catalog.sports.length,
    soccer_keys: soccerOrdered.length,
    tennis_keys: tennisOrdered.length,
    sports_unavailable: state.sports_unavailable,
    events_inserted: eventsInserted,
    quotes_inserted: quotesInserted,
    duplicates,
    api_calls: apiCalls,
    credits_remaining: remainingCredits042(credit),
    skipped_reason: null,
    horizons: horizonCounts(
      storeAfter.events.map((e) => e.kickoff_utc),
      nowMs,
    ),
  };
}
