/**
 * SOURCE_LINEAGE + UPSTREAM_CLUSTER.
 * A GitHub mirror of football-data.co.uk is one cluster, not four sources.
 */

import type { GithubRepoAudit, SourceLineage } from "@/domain/eval/capital-020/types";

export const UPSTREAM_CLUSTERS = {
  FOOTBALL_DATA_CO_UK: "football-data-co-uk",
  CLUB_FOOTBALL: "xgabora-club-football-match-data",
  BETFAIR_HISTORIC: "betfair-historicdata",
  CLUBELO: "clubelo",
} as const;

export function lineageFor019Source(
  sourceId: string,
  retrievedAt: string,
): SourceLineage {
  if (
    sourceId === "anishkhetani-epl-archive" ||
    sourceId.startsWith("jokecamp") ||
    sourceId === "offline-pack-e0" ||
    sourceId === "football-data-co-uk-live" ||
    sourceId === "fdcu-fix"
  ) {
    return {
      sourceId,
      upstreamSource: "football-data.co.uk",
      publisher: "Joseph Buchdahl / football-data.co.uk",
      dataset: "mmz4281 season CSVs",
      repository:
        sourceId === "anishkhetani-epl-archive"
          ? "AnishKhetani/premier-league-data"
          : sourceId.startsWith("jokecamp")
            ? "jokecamp/FootballData"
            : sourceId === "offline-pack-e0"
              ? "local-offline-pack"
              : null,
      license: "public football-data.co.uk files; redistribution credit required",
      retrievedAt,
      upstreamCluster: UPSTREAM_CLUSTERS.FOOTBALL_DATA_CO_UK,
      independence:
        sourceId === "football-data-co-uk-live" ? "BLOCKED" : "REDISTRIBUTION",
    };
  }
  if (sourceId === "club-football-match-data") {
    return {
      sourceId,
      upstreamSource: "xgabora/Club-Football-Match-Data",
      publisher: "xgabora",
      dataset: "Matches.csv",
      repository: "xgabora/Club-Football-Match-Data",
      license: "see upstream repo",
      retrievedAt,
      upstreamCluster: UPSTREAM_CLUSTERS.CLUB_FOOTBALL,
      independence: "SECONDARY_INDEX",
    };
  }
  return {
    sourceId,
    upstreamSource: "unknown",
    publisher: "unknown",
    dataset: sourceId,
    repository: null,
    license: "unknown",
    retrievedAt,
    upstreamCluster: sourceId,
    independence: "PRIMARY",
  };
}

export const GITHUB_REPO_AUDITS: readonly GithubRepoAudit[] = [
  {
    repository: "AnishKhetani/premier-league-data",
    author: "AnishKhetani",
    license: "see repo; data from football-data.co.uk",
    original_source: "football-data.co.uk",
    coverage: "EPL 1993–present",
    sports: ["football"],
    competitions: "E0",
    markets: "1X2, OU2.5, AH (observed)",
    bookmakers: "many named books; Max/Avg excluded by us",
    timestamps: "match date only",
    open_close_semantics: "documented OPEN vs _close",
    historical_depth: "1993+",
    granularity: "one open + one close per book/market",
    provenance: "redistribution",
    independence: "same cluster as football-data.co.uk",
    access: "GitHub raw CSV",
    legal: "credit football-data.co.uk",
    usable_strict: false,
  },
  {
    repository: "jokecamp/FootballData",
    author: "jokecamp",
    license: "see repo",
    original_source: "football-data.co.uk",
    coverage: "multi-country, older dump (~2014)",
    sports: ["football"],
    competitions: "E0, I1, D1 samples acquired",
    markets: "1X2, OU2.5, AH when columns exist",
    bookmakers: "B365, Pinnacle, WH, …",
    timestamps: "match date only",
    open_close_semantics: "pre-closing columns; close sparse",
    historical_depth: "through mid-2010s in dump",
    granularity: "season CSV",
    provenance: "redistribution",
    independence: "same cluster as football-data.co.uk",
    access: "GitHub raw CSV",
    legal: "public CSV mirror",
    usable_strict: false,
  },
  {
    repository: "footballcsv/cache.footballdata",
    author: "footballcsv",
    license: "see repo",
    original_source: "football-data.co.uk",
    coverage: "results 1993+",
    sports: ["football"],
    competitions: "many",
    markets: "none (results only)",
    bookmakers: "none",
    timestamps: "match date",
    open_close_semantics: "n/a",
    historical_depth: "1993+",
    granularity: "match row",
    provenance: "converted football.csv",
    independence: "same cluster (results only)",
    access: "GitHub",
    legal: "public",
    usable_strict: false,
  },
  {
    repository: "xgabora/Club-Football-Match-Data",
    author: "xgabora",
    license: "see repo",
    original_source: "compiled match database",
    coverage: "~238k matches, many divisions",
    sports: ["football"],
    competitions: "E0–E3, I1, SP1, D1, F1, extras",
    markets: "Odd* undocumented",
    bookmakers: "unknown / not individual",
    timestamps: "UNKNOWN for odds",
    open_close_semantics: "undocumented",
    historical_depth: "2000s–2026",
    granularity: "one row per match",
    provenance: "secondary index",
    independence: "not a STRICT odds source",
    access: "local clone",
    legal: "audit/secondary only",
    usable_strict: false,
  },
  {
    repository: "kito129/betfairHitoricalRawDataConversion",
    author: "kito129",
    license: "code MIT-like / data is Betfair historic (paid)",
    original_source: "historicdata.betfair.com",
    coverage: "parser + one tennis BASIC sample in repo",
    sports: ["tennis", "other"],
    competitions: "sample MATCH_ODDS",
    markets: "exchange MATCH_ODDS",
    bookmakers: "betfair-exchange",
    timestamps: "publishTime (pt) — Level A format",
    open_close_semantics: "stream ticks",
    historical_depth: "paid archive; sample only public",
    granularity: "per update",
    provenance: "paid Betfair historic format",
    independence: "PRIMARY format, LICENSE restricted for bulk",
    access: "paid official; sample redistributed on GitHub",
    legal: "Betfair historic ToS — bulk not ingested; format adapter only",
    usable_strict: false,
  },
  {
    repository: "tarb/betfair_data",
    author: "tarb",
    license: "parser library",
    original_source: "Betfair historic files you already own",
    coverage: "parser only",
    sports: ["any on Betfair"],
    competitions: "n/a",
    markets: "n/a",
    bookmakers: "exchange",
    timestamps: "yes, if you have files",
    open_close_semantics: "stream",
    historical_depth: "n/a",
    granularity: "tick",
    provenance: "tool",
    independence: "not a dataset",
    access: "PyPI",
    legal: "requires licensed historic files",
    usable_strict: false,
  },
  {
    repository: "sosthene14/footballdataset",
    author: "sosthene14",
    license: "downloader",
    original_source: "football-data.co.uk",
    coverage: "same CSVs",
    sports: ["football"],
    competitions: "top EU",
    markets: "same as FD.co.uk",
    bookmakers: "same",
    timestamps: "date only",
    open_close_semantics: "same notes.txt",
    historical_depth: "1993–2025",
    granularity: "season",
    provenance: "downloader — not independent",
    independence: "same cluster",
    access: "hits live site (503 here)",
    legal: "public CSVs",
    usable_strict: false,
  },
];

export function uniqueUpstreamClusters(rows: readonly SourceLineage[]): string[] {
  return [...new Set(rows.map((r) => r.upstreamCluster))].sort();
}
