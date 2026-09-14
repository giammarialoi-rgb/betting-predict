import { join } from "node:path";
import { loadCreditState042, remainingCredits042, saveCreditState042, canAffordRun042 } from "@/domain/eval/collector-042/credit";
import { loadGovernorConfig042 } from "@/domain/eval/collector-042/config";
import { labAStore044, permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import {
  appendJournal044,
  loadStore044,
  appendJsonl044,
  appendEvent044,
  type Store044,
} from "@/domain/eval/permanent-044/store";
import { discoverGoldenCandidates } from "@/domain/eval/betmind-runtime/golden-e2e/discover";
import { discoverFootballDataOrgFixtures } from "@/domain/eval/acquisition-engine/sources/football-data-org";
import { normalizeTeamName } from "@/domain/eval/data-intelligence/research/identity-normalize";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { bumpApiCalls045, loadDiscoveryState045, saveDiscoveryState045 } from "@/domain/eval/factory-045/config";
import { fetchSportsCatalog045, pullSportOddsMulti045 } from "@/domain/eval/factory-045/pull";
import { ingestDiscovered045 } from "@/domain/eval/factory-045/ingest";
import { selectSportsByFamily049 } from "@/domain/eval/factory-049/adapters";
import {
  loadExp049Config,
  saveSportCoverage049,
  type SportCoverageEntry049,
  type SportAvailability049,
} from "@/domain/eval/factory-049/config";

/**
 * Cross-source identity key for free-discovery dedup: same calendar day +
 * normalized home/away team names. football-data.org, ESPN, OpenLigaDB and
 * TheSportsDB each spell the same real match differently ("Torino" vs
 * "Torino FC", "Parma" vs "Parma Calcio 1913") -- appendEvent044's
 * fingerprint dedup is per-source and never catches this, so the same
 * fixture was showing up 2-4 times on the board. Strips a trailing
 * founding-year suffix (normalizeTeamName doesn't) on top of the shared
 * normalizer.
 */
function dedupTeamKey(name: string): string {
  return normalizeTeamName(name).replace(/\s+\d{3,4}$/, "").trim();
}

function eventIdentityKey(home: string, away: string, kickoffUtc: string | null): string {
  const day = kickoffUtc ? kickoffUtc.slice(0, 10) : "unknown";
  return `${day}|${dedupTeamKey(home)}|${dedupTeamKey(away)}`;
}

function existingIdentityKeys(store: Store044): Set<string> {
  const keys = new Set<string>();
  for (const e of store.events) {
    keys.add(eventIdentityKey(e.home_or_a, e.away_or_b, e.kickoff_utc));
  }
  return keys;
}

/** appendEvent044, but also skips a cross-source identity duplicate. */
function appendUniqueEvent049(
  store: Store044,
  seenKeys: Set<string>,
  event: PermanentEvent044,
): "ok" | "dup" {
  const key = eventIdentityKey(event.home_or_a, event.away_or_b, event.kickoff_utc);
  if (seenKeys.has(key)) return "dup";
  const result = appendEvent044(store, event);
  if (result === "ok") seenKeys.add(key);
  return result;
}

export type DiscoverResult049 = {
  sports_catalog: number;
  pull_queue_size: number;
  sports_pulled: number;
  events_inserted: number;
  quotes_inserted: number;
  duplicates: number;
  api_calls: number;
  credits_remaining: number | null;
  skipped_reason: string | null;
  stopped_gracefully: boolean;
  families: SportCoverageEntry049[];
  horizons: { TODAY: number; NEXT_24H: number; NEXT_72H: number; NEXT_7D: number };
  artificial_cap: false;
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
 * Massive multi-sport Lab B discovery.
 * No artificial event/sport caps — only budget + rate limits stop the pull.
 * NEVER writes Lab A.
 */
export async function runDiscover049(input: {
  labBRoot?: string;
  labARoot?: string;
  fetchImpl?: typeof fetch;
  force?: boolean;
  nowIso?: string;
}): Promise<DiscoverResult049> {
  loadExp049Config();
  const labB = input.labBRoot ?? permanentRoot044();
  const labA = input.labARoot ?? labAStore044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  let state = loadDiscoveryState045(labB);
  const cfg = loadGovernorConfig042();
  let credit = loadCreditState042(labA);

  const emptyFamilies = (): SportCoverageEntry049[] =>
    ["soccer", "tennis", "basketball", "volleyball", "hockey", "other"].map((family) => ({
      family,
      status: "UNKNOWN" as SportAvailability049,
      keys_active: 0,
      keys_pulled: 0,
      events_in_lab: 0,
      note: null,
    }));

  const freshHours =
    state.last_discovery_at != null ? (nowMs - Date.parse(state.last_discovery_at)) / 3600_000 : 99;
  if (!input.force && freshHours < 1.5) {
    const store = loadStore044(labB);
    return {
      sports_catalog: 0,
      pull_queue_size: 0,
      sports_pulled: 0,
      events_inserted: 0,
      quotes_inserted: 0,
      duplicates: 0,
      api_calls: 0,
      credits_remaining: remainingCredits042(credit),
      skipped_reason: "CATALOG_FRESH_SKIP_DISCOVERY",
      stopped_gracefully: false,
      families: emptyFamilies(),
      horizons: horizonCounts(
        store.events.map((e) => e.kickoff_utc),
        nowMs,
      ),
      artificial_cap: false,
    };
  }

  const afford = canAffordRun042(credit, 20, cfg);
  if (!afford.ok) {
    return {
      sports_catalog: 0,
      pull_queue_size: 0,
      sports_pulled: 0,
      events_inserted: 0,
      quotes_inserted: 0,
      duplicates: 0,
      api_calls: 0,
      credits_remaining: remainingCredits042(credit),
      skipped_reason: afford.reason,
      stopped_gracefully: true,
      families: emptyFamilies().map((f) => ({ ...f, status: "BUDGET_INSUFFICIENT", note: afford.reason })),
      horizons: { TODAY: 0, NEXT_24H: 0, NEXT_72H: 0, NEXT_7D: 0 },
      artificial_cap: false,
    };
  }

  let apiCalls = 0;
  const catalog = await fetchSportsCatalog045({ fetchImpl: input.fetchImpl, creditState: credit });
  credit = catalog.creditState;
  apiCalls += 1;
  state = bumpApiCalls045(state, 1);
  state.last_sports_catalog_at = nowIso;

  appendJsonl044(join(labB, "source-health.jsonl"), {
    kind: "SPORTS_CATALOG_049",
    at: nowIso,
    count: catalog.sports.length,
    error: catalog.error,
    hash: catalog.raw_hash,
  });

  if (catalog.error) {
    const status: SportAvailability049 = /429|rate/i.test(catalog.error)
      ? "RATE_LIMITED"
      : "DISCOVERY_FAILED";
    state.last_error = catalog.error;

    // No paid odds catalog (no key / provider down): fall back to free soccer
    // discovery. football-data.org (official API, token required) first when
    // configured — full-season fixtures for the EU5, not just a scoreboard
    // window. ESPN/OpenLigaDB/TheSportsDB (no key) fill in the rest (UCL/UEL,
    // smaller leagues). Identity + kickoff only — no odds, so nothing here
    // ever enters the model.
    let freeInserted = 0;
    let fdOrgInserted = 0;
    const freeSources: string[] = [];
    let freeStore = loadStore044(labB);
    const seenIdentityKeys = existingIdentityKeys(freeStore);
    if (status === "DISCOVERY_FAILED") {
      // football-data.org first: official per-competition API, richer and
      // more reliable than a scoreboard scrape, so it wins any cross-source
      // identity collision.
      try {
        const fdOrg = await discoverFootballDataOrgFixtures({ nowIso });
        for (const ev of fdOrg.events) {
          if (appendUniqueEvent049(freeStore, seenIdentityKeys, ev) === "ok") {
            freeInserted += 1;
            fdOrgInserted += 1;
          }
        }
        if (fdOrgInserted > 0) freeSources.push("football-data.org");
      } catch {
        /* free discovery is best-effort; fall through to the other free sources */
      }
      try {
        const { candidates } = await discoverGoldenCandidates(nowMs);
        let espnInserted = 0;
        for (const c of candidates) {
          if (appendUniqueEvent049(freeStore, seenIdentityKeys, c.event) === "ok") {
            freeInserted += 1;
            espnInserted += 1;
          }
        }
        if (espnInserted > 0) freeSources.push("ESPN/OpenLigaDB/TheSportsDB");
      } catch {
        /* free discovery is best-effort; keep the original DISCOVERY_FAILED status */
      }
    }

    saveDiscoveryState045(labB, state);
    saveCreditState042(credit, labA);
    const families = emptyFamilies().map((f) => {
      if (f.family === "soccer" && freeInserted > 0) {
        return {
          ...f,
          status: "FREE_SOURCE_FALLBACK" as SportAvailability049,
          events_in_lab: freeInserted,
          note: `The Odds API unavailable (${catalog.error}); used free discovery instead (${freeSources.join(", ")})`,
        };
      }
      return { ...f, status, note: catalog.error };
    });
    saveSportCoverage049(labB, { at: nowIso, sports: families });
    appendJournal044(labB, {
      kind: "discover_049_free_fallback",
      odds_api_error: catalog.error,
      freeInserted,
    });
    return {
      sports_catalog: 0,
      pull_queue_size: 0,
      sports_pulled: 0,
      events_inserted: freeInserted,
      quotes_inserted: 0,
      duplicates: 0,
      api_calls: apiCalls,
      credits_remaining: remainingCredits042(credit),
      skipped_reason: freeInserted > 0 ? null : catalog.error,
      stopped_gracefully: false,
      families,
      horizons: horizonCounts(
        freeStore.events.map((e) => e.kickoff_utc),
        nowMs,
      ),
      artificial_cap: false,
    };
  }

  const selected = selectSportsByFamily049(catalog.sports);
  const store = loadStore044(labB);
  let eventsInserted = 0;
  let quotesInserted = 0;
  let duplicates = 0;
  let sportsPulled = 0;
  let stopped_gracefully = false;
  const pulledByFamily = new Map<string, number>();
  const eventsPulledByFamily = new Map<string, number>();
  const unavailable: string[] = [];

  for (const item of selected.pullQueue) {
    if (!canAffordRun042(credit, cfg.estimatedOddsCreditsPerSport + 2, cfg).ok) {
      stopped_gracefully = true;
      appendJournal044(labB, {
        kind: "discover_049_stop_graceful",
        reason: "SAFE_REMAINING",
        remaining: remainingCredits042(credit),
        pulled: sportsPulled,
        queue_left: selected.pullQueue.length - sportsPulled,
      });
      break;
    }

    const pull = await pullSportOddsMulti045({
      sport: item.key,
      markets: item.markets,
      fetchImpl: input.fetchImpl,
      creditState: credit,
    });
    credit = pull.creditState;
    apiCalls += 1;
    state = bumpApiCalls045(state, 1);
    sportsPulled += 1;
    pulledByFamily.set(item.family, (pulledByFamily.get(item.family) ?? 0) + 1);

    if (pull.market_status === "SPORT_UNAVAILABLE") {
      unavailable.push(item.key);
      appendJsonl044(join(labB, "source-health.jsonl"), {
        kind: "SPORT_UNAVAILABLE",
        sport: item.key,
        family: item.family,
        at: nowIso,
      });
      continue;
    }

    if (pull.market_status === "ERROR") {
      unavailable.push(`${item.key}:ERROR`);
      continue;
    }

    const ing = ingestDiscovered045({
      store,
      sportKey: item.key,
      events: pull.events,
      quotes: pull.quotes,
      collectedAt: nowIso,
      rawHash: pull.raw_hash,
    });
    eventsInserted += ing.eventsInserted;
    quotesInserted += ing.quotesInserted;
    duplicates += ing.duplicates;
    eventsPulledByFamily.set(
      item.family,
      (eventsPulledByFamily.get(item.family) ?? 0) + pull.events.length,
    );

    appendJsonl044(join(labB, "markets.jsonl"), {
      kind: "DISCOVERY_PULL_049",
      sport: item.key,
      family: item.family,
      markets_requested: item.markets,
      events: pull.events.length,
      quotes: pull.quotes.length,
      status: pull.market_status,
      error: pull.error,
      at: nowIso,
      artificial_cap: false,
    });
  }

  const storeAfter = loadStore044(labB);
  const countBySport = (family: string) =>
    storeAfter.events.filter((e) => {
      const s = (e.sport || "").toLowerCase();
      if (family === "other") {
        return !["soccer", "tennis", "basketball", "volleyball", "hockey"].some((f) => s.includes(f));
      }
      if (family === "hockey") return s.includes("hockey");
      return s === family || s.includes(family);
    }).length;

  const families: SportCoverageEntry049[] = selected.families.map((f) => {
    const inLab = countBySport(f.family);
    const pulled = pulledByFamily.get(f.family) ?? 0;
    let status: SportAvailability049 = f.status === "PROVIDER_UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : "AVAILABLE";
    let note = f.note;
    if (f.status === "AVAILABLE" && pulled > 0 && (eventsPulledByFamily.get(f.family) ?? 0) === 0) {
      status = "AVAILABLE_NO_EVENTS_IN_WINDOW";
      note = "Provider keys active but no events in current odds window";
    }
    if (stopped_gracefully && f.keys.length > pulled) {
      note = note ?? "BUDGET_STOP — remaining keys deferred";
    }
    return {
      family: f.family,
      status,
      keys_active: f.keys.length,
      keys_pulled: pulled,
      events_in_lab: inLab,
      note,
    };
  });

  saveSportCoverage049(labB, { at: nowIso, sports: families });
  state.last_discovery_at = nowIso;
  state.sports_unavailable = [
    ...new Set([
      ...unavailable,
      ...families.filter((f) => f.status === "PROVIDER_UNAVAILABLE").map((f) => f.note!).filter(Boolean),
    ]),
  ];
  state.last_error = null;
  saveDiscoveryState045(labB, state);
  saveCreditState042(credit, labA);

  appendJournal044(labB, {
    kind: "discover_049",
    eventsInserted,
    quotesInserted,
    sportsPulled,
    pullQueue: selected.pullQueue.length,
    apiCalls,
    stopped_gracefully,
    artificial_cap: false,
  });

  return {
    sports_catalog: catalog.sports.length,
    pull_queue_size: selected.pullQueue.length,
    sports_pulled: sportsPulled,
    events_inserted: eventsInserted,
    quotes_inserted: quotesInserted,
    duplicates,
    api_calls: apiCalls,
    credits_remaining: remainingCredits042(credit),
    skipped_reason: null,
    stopped_gracefully,
    families,
    horizons: horizonCounts(
      storeAfter.events.map((e) => e.kickoff_utc),
      nowMs,
    ),
    artificial_cap: false,
  };
}
