/**
 * Legitimate source probes and local archive loaders.
 * HTTP 503/WAF is recorded, never bypassed. No scraping.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REAL_TRUTH_LAB_E0_CSV } from "@/domain/eval/real-lab/pack-csv";
import { loadClubMatchesLite } from "@/domain/eval/actuarial-018/load-matches";
import { buildNormalizedEvent } from "@/domain/eval/acquisition-019/event-matching";
import {
  emptyFailureBudget,
  parseAnishEpl,
  parseFdcuCsv,
  type ParsedBundle,
} from "@/domain/eval/acquisition-019/parse";
import {
  TEMPORAL_BASIS_CLUB,
  type FailureBudget,
  type NormalizedEvent,
  type SourceCoverageRow019,
} from "@/domain/eval/acquisition-019/types";

export const TASK019_CACHE_DIR = join(
  process.cwd(),
  "audit",
  "external",
  "task-019",
);

export type ResearchedSource = {
  sourceId: string;
  languages: string[];
  url: string;
  intended: string;
  result: string;
  usableStrict: false;
};

/** Data-gap research log — catalog expansion is not success. */
export const RESEARCHED_SOURCES: readonly ResearchedSource[] = [
  {
    sourceId: "football-data-co-uk-live",
    languages: ["en"],
    url: "https://www.football-data.co.uk/mmz4281/{season}/{div}.csv",
    intended: "Primary multi-league bookmaker CSVs with documented OPEN/CLOSE",
    result: "HTTP 503 — BLOCKED; no WAF bypass",
    usableStrict: false,
  },
  {
    sourceId: "anishkhetani-epl-archive",
    languages: ["en"],
    url: "https://github.com/AnishKhetani/premier-league-data",
    intended: "Public redistribution of football-data.co.uk EPL odds (OPEN/CLOSE renamed)",
    result: "ACQUIRED if cache present — Level B/C date precision, not exact",
    usableStrict: false,
  },
  {
    sourceId: "jokecamp-footballdata",
    languages: ["en"],
    url: "https://github.com/jokecamp/FootballData",
    intended: "Older original-column football-data.co.uk dumps (multi-country)",
    result: "Partial ACQUIRED (E0 2014/15, I1 2012/13, D1 2013/14) — Level B/C",
    usableStrict: false,
  },
  {
    sourceId: "footballcsv-cache",
    languages: ["en"],
    url: "https://github.com/footballcsv/cache.footballdata",
    result: "Results-only football.csv — no bookmaker columns",
    intended: "Event index",
    usableStrict: false,
  },
  {
    sourceId: "club-football-match-data",
    languages: ["en"],
    url: "https://github.com/xgabora/Club-Football-Match-Data",
    intended: "Event identification / result cross-check",
    result: "LOCAL SECONDARY INDEX — Odd* TEMPORALLY_UNKNOWN",
    usableStrict: false,
  },
  {
    sourceId: "clubelo",
    languages: ["en"],
    url: "http://api.clubelo.com/YYYY-MM-DD",
    intended: "asOf Elo snapshots",
    result: "HTTP 502 at probe time — Elo not used as odds",
    usableStrict: false,
  },
  {
    sourceId: "football-data-org",
    languages: ["en"],
    url: "https://api.football-data.org",
    intended: "Results API",
    result: "Not a historical bookmaker-odds archive",
    usableStrict: false,
  },
  {
    sourceId: "oddsportal-historical",
    languages: ["en", "it", "es", "de", "fr"],
    url: "https://www.oddsportal.com/",
    intended: "Timestamped historical odds",
    result: "Would require unauthorized scrape / WAF bypass — REJECTED",
    usableStrict: false,
  },
  {
    sourceId: "betfair-historic",
    languages: ["en"],
    url: "https://historicdata.betfair.com/",
    intended: "Exchange ticks (Level A)",
    result: "Paid / login archive — not acquired; no scrape",
    usableStrict: false,
  },
  {
    sourceId: "kaggle-european-soccer",
    languages: ["en"],
    url: "https://www.kaggle.com/datasets/hugomathien/soccer",
    intended: "Match + odds research",
    result: "No documented per-quote available_at — Level D if used",
    usableStrict: false,
  },
  {
    sourceId: "figc-lega-serie-a",
    languages: ["it"],
    url: "https://www.legaseriea.it/",
    intended: "Risultati / calendario",
    result: "No historical bookmaker timestamp feed; site is not an odds archive",
    usableStrict: false,
  },
  {
    sourceId: "lfp-rfef",
    languages: ["es"],
    url: "https://www.laliga.com/",
    intended: "Resultados",
    result: "No historical bookmaker OPEN/CLOSE archive",
    usableStrict: false,
  },
  {
    sourceId: "dffl-kicker",
    languages: ["de"],
    url: "https://www.kicker.de/",
    intended: "Archiv Ergebnisse",
    result: "Editorial / WAF — no authorized bulk odds dump used",
    usableStrict: false,
  },
];

export type Acquire019Options = {
  allowNetwork?: boolean;
  /** Tests: do not read audit/external/task-019 caches. */
  skipLocalCache?: boolean;
  /** Tests: do not stream Club-Football Matches.csv. */
  skipClubIndex?: boolean;
  now?: Date;
  eplResultsText?: string;
  eplOddsText?: string;
  extraFdcu?: ReadonlyArray<{
    csvText: string;
    originalFile: string;
    sourceUrl: string;
    sourceId: string;
  }>;
};

export type Acquired019 = {
  retrievedAt: string;
  budget: FailureBudget;
  bundles: ParsedBundle[];
  clubIndex: NormalizedEvent[];
  clubIndexPresent: boolean;
  sourceRows: SourceCoverageRow019[];
  liveFdStatus: number | null;
};

async function probeStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "User-Agent": "sports-prediction-engine-research/0.1",
      },
    });
    return res.status;
  } catch {
    return 0;
  }
}

function readCache(name: string): string | null {
  const p = join(TASK019_CACHE_DIR, name);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

function clubLiteToNormalized(): Promise<{
  present: boolean;
  events: NormalizedEvent[];
}> {
  return loadClubMatchesLite().then((loaded) => {
    if (!loaded.present) return { present: false, events: [] };
    const events: NormalizedEvent[] = [];
    for (const m of loaded.matches) {
      const iso = m.matchDate.toISOString().slice(0, 10);
      const ev = buildNormalizedEvent({
        sourceId: "club-football-match-data",
        sourceEventId: m.eventId,
        competitionRaw: m.division,
        matchDate: iso,
        year: m.year,
        season: `${iso.slice(0, 4)}`,
        homeRaw: m.home,
        awayRaw: m.away,
        ftHome: m.ftHome,
        ftAway: m.ftAway,
      });
      events.push(ev);
    }
    return { present: true, events };
  });
}

export async function acquireTask019(options: Acquire019Options = {}): Promise<Acquired019> {
  const retrievedAt = (options.now ?? new Date()).toISOString();
  const budget = emptyFailureBudget();
  const bundles: ParsedBundle[] = [];
  const sourceRows: SourceCoverageRow019[] = [];

  let liveFdStatus: number | null = null;
  if (options.allowNetwork) {
    liveFdStatus = await probeStatus(
      "https://www.football-data.co.uk/mmz4281/2324/E0.csv",
    );
    if (liveFdStatus !== 200) {
      budget.HTTP_ERROR += 1;
    }
  }

  sourceRows.push({
    sourceId: "football-data-co-uk-live",
    role: "PRIMARY_BLOCKED",
    http_status: liveFdStatus,
    acquired: liveFdStatus === 200,
    parsed: false,
    events: 0,
    observations: 0,
    books: 0,
    markets: [],
    precision: "n/a",
    licenseStatus: "blocked",
    blocker:
      liveFdStatus == null
        ? "not_probed"
        : liveFdStatus === 200
          ? null
          : `HTTP_${liveFdStatus}`,
  });

  // Offline pack — always available
  const pack = parseFdcuCsv({
    csvText: REAL_TRUTH_LAB_E0_CSV,
    sourceId: "offline-pack-e0",
    sourceUrl: "offline://real_truth_lab_v1_e0_2019_2024",
    originalFile: "src/domain/eval/real-lab/pack-csv.ts",
    datasetVersion: "real_truth_lab_v1_e0_2019_2024",
    licenseStatus: "offline_pack",
    retrievedAt,
    defaultCompetition: "E0",
    budget,
  });
  bundles.push(pack);
  sourceRows.push({
    sourceId: "offline-pack-e0",
    role: "FIXTURE_PACK",
    http_status: 200,
    acquired: true,
    parsed: true,
    events: pack.events.length,
    observations: pack.observations.length,
    books: new Set(pack.observations.map((o) => o.bookmakerId)).size,
    markets: [...new Set(pack.observations.map((o) => o.marketType))],
    precision: "date (OPEN) / unknown (CLOSE)",
    licenseStatus: "offline_pack",
    blocker: null,
  });

  const eplResults =
    options.eplResultsText ??
    (options.skipLocalCache ? null : readCache("epl-results.csv"));
  const eplOdds =
    options.eplOddsText ??
    (options.skipLocalCache ? null : readCache("epl-results-with-odds.csv"));
  if (eplResults && eplOdds) {
    const epl = parseAnishEpl({
      resultsCsv: eplResults,
      oddsCsv: eplOdds,
      sourceUrl:
        "https://github.com/AnishKhetani/premier-league-data/tree/main/data/processed",
      originalFile: "epl-results-with-odds.csv",
      retrievedAt,
      budget,
    });
    bundles.push(epl);
    sourceRows.push({
      sourceId: "anishkhetani-epl-archive",
      role: "LEGITIMATE_PUBLIC_REDISTRIBUTION",
      http_status: 200,
      acquired: true,
      parsed: true,
      events: epl.events.length,
      observations: epl.observations.length,
      books: new Set(epl.observations.map((o) => o.bookmakerId)).size,
      markets: [...new Set(epl.observations.map((o) => o.marketType))],
      precision: "date (OPEN) / unknown (CLOSE)",
      licenseStatus: "public_redistribution",
      blocker: null,
    });
  } else {
    sourceRows.push({
      sourceId: "anishkhetani-epl-archive",
      role: "LEGITIMATE_PUBLIC_REDISTRIBUTION",
      http_status: null,
      acquired: false,
      parsed: false,
      events: 0,
      observations: 0,
      books: 0,
      markets: [],
      precision: "n/a",
      licenseStatus: "public_redistribution",
      blocker: "CACHE_MISSING",
    });
  }

  const jokecampFiles = [
    {
      file: "jokecamp-e0-2014-15.csv",
      url: "https://github.com/jokecamp/FootballData/blob/master/football-data.co.uk/england/2014-2015/Premier.csv",
      id: "jokecamp-e0-2014-15",
    },
    {
      file: "jokecamp-i1-a.csv",
      url: "https://github.com/jokecamp/FootballData/blob/master/football-data.co.uk/italy/I1%20(1).csv",
      id: "jokecamp-i1",
    },
    {
      file: "jokecamp-d1.csv",
      url: "https://github.com/jokecamp/FootballData/blob/master/football-data.co.uk/germany/D1.csv",
      id: "jokecamp-d1",
    },
  ];
  for (const jf of jokecampFiles) {
    const text = options.skipLocalCache ? null : readCache(jf.file);
    if (!text) {
      sourceRows.push({
        sourceId: jf.id,
        role: "LEGITIMATE_PUBLIC_REDISTRIBUTION",
        http_status: null,
        acquired: false,
        parsed: false,
        events: 0,
        observations: 0,
        books: 0,
        markets: [],
        precision: "n/a",
        licenseStatus: "public_redistribution",
        blocker: "CACHE_MISSING",
      });
      continue;
    }
    const parsed = parseFdcuCsv({
      csvText: text,
      sourceId: jf.id,
      sourceUrl: jf.url,
      originalFile: jf.file,
      datasetVersion: "jokecamp/FootballData",
      licenseStatus: "public_redistribution",
      retrievedAt,
      budget,
    });
    bundles.push(parsed);
    sourceRows.push({
      sourceId: jf.id,
      role: "LEGITIMATE_PUBLIC_REDISTRIBUTION",
      http_status: 200,
      acquired: true,
      parsed: true,
      events: parsed.events.length,
      observations: parsed.observations.length,
      books: new Set(parsed.observations.map((o) => o.bookmakerId)).size,
      markets: [...new Set(parsed.observations.map((o) => o.marketType))],
      precision: "date (OPEN) / unknown (CLOSE)",
      licenseStatus: "public_redistribution",
      blocker: null,
    });
  }

  for (const extra of options.extraFdcu ?? []) {
    bundles.push(
      parseFdcuCsv({
        csvText: extra.csvText,
        sourceId: extra.sourceId,
        sourceUrl: extra.sourceUrl,
        originalFile: extra.originalFile,
        datasetVersion: "injected",
        licenseStatus: "offline_pack",
        retrievedAt,
        budget,
      }),
    );
  }

  const club = options.skipClubIndex
    ? { present: false, events: [] }
    : await clubLiteToNormalized();
  if (club.present) {
    budget.TEMPORAL_UNKNOWN += club.events.length;
  }

  sourceRows.push({
    sourceId: "club-football-match-data",
    role: "SECONDARY_INDEX",
    http_status: club.present ? 200 : null,
    acquired: club.present,
    parsed: club.present,
    events: club.events.length,
    observations: 0,
    books: 0,
    markets: [],
    precision: "unknown",
    licenseStatus: "local_secondary",
    blocker: club.present ? TEMPORAL_BASIS_CLUB : "FILE_MISSING",
  });

  return {
    retrievedAt,
    budget,
    bundles,
    clubIndex: club.events,
    clubIndexPresent: club.present,
    sourceRows,
    liveFdStatus,
  };
}
