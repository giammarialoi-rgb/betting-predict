/**
 * Comparative source audit. Probes are recorded; WAF/paywalls are never bypassed.
 */

import type { SourceAudit021 } from "@/domain/eval/capital-021/types";

export const SOURCE_AUDITS_021: readonly SourceAudit021[] = [
  {
    sourceId: "betfair-historical-data",
    url: "https://historicdata.betfair.com/",
    languages: ["en"],
    intended: "Exchange ticks with publishTime (pt)",
    probe: "paid / login archive",
    temporal: "EXACT_TIMESTAMP",
    format_verified: true,
    acquired: false,
    usable_strict: false,
    independence_cluster: "betfair-historicdata",
    reason: "Level A format verified (pt epoch ms). Bulk ToS-restricted; not ingested.",
  },
  {
    sourceId: "the-odds-api-historical",
    url: "https://the-odds-api.com/historical-odds-data/",
    languages: ["en"],
    intended: "Bookmaker snapshots with last_update ISO timestamps from 2020-06-06",
    probe: "paid plans only; unauthenticated historical → 401/403",
    temporal: "EXACT_TIMESTAMP",
    format_verified: true,
    acquired: false,
    usable_strict: false,
    independence_cluster: "the-odds-api",
    reason: "Public docs sample verifies last_update. Archive not licensed here.",
  },
  {
    sourceId: "football-data-co-uk",
    url: "https://www.football-data.co.uk/",
    languages: ["en"],
    intended: "OPEN/CLOSE bookmaker CSVs",
    probe: "live often HTTP 503; GitHub redistributions acquired in TASK 019/020",
    temporal: "DATE_ONLY",
    format_verified: true,
    acquired: true,
    usable_strict: false,
    independence_cluster: "football-data-co-uk",
    reason: "Calendar date / dataset notes only. Not EXACT_TIMESTAMP.",
  },
  {
    sourceId: "football-data-org",
    url: "https://www.football-data.org",
    languages: ["en"],
    intended: "Results API; match lastUpdated is not a bookmaker quote clock",
    probe: "existing adapter — not a historical odds archive",
    temporal: "UNKNOWN",
    format_verified: false,
    acquired: false,
    usable_strict: false,
    independence_cluster: "football-data-org",
    reason: "lastUpdated on match objects ≠ per-quote available_at.",
  },
  {
    sourceId: "openligadb",
    url: "https://api.openligadb.de/getmatchdata/bl1/2020/1",
    languages: ["de", "en"],
    intended: "Community results API",
    probe: "results/matchDateTime; no bookmaker odds fields",
    temporal: "n/a",
    format_verified: false,
    acquired: false,
    usable_strict: false,
    independence_cluster: "openligadb",
    reason: "Not an odds source.",
  },
  {
    sourceId: "kaggle-european-soccer",
    url: "https://www.kaggle.com/datasets/hugomathien/soccer",
    languages: ["en"],
    intended: "Match + odds research SQLite",
    probe: "no documented per-quote available_at",
    temporal: "UNKNOWN",
    format_verified: false,
    acquired: false,
    usable_strict: false,
    independence_cluster: "kaggle-soccer",
    reason: "Odds without a defensible quote clock.",
  },
  {
    sourceId: "github-anish-jokecamp",
    url: "https://github.com/AnishKhetani/premier-league-data",
    languages: ["en"],
    intended: "football-data.co.uk redistribution",
    probe: "acquired TASK 019 — DATE_ONLY",
    temporal: "DATE_ONLY",
    format_verified: true,
    acquired: true,
    usable_strict: false,
    independence_cluster: "football-data-co-uk",
    reason: "Same upstream cluster; not an independent timestamped feed.",
  },
  {
    sourceId: "academic-econstor-fdcu",
    url: "https://hdl.handle.net/10419/296679",
    languages: ["en"],
    intended: "Academic paper using football-data.co.uk odds",
    probe: "paper cites closing/pre-closing CSVs",
    temporal: "DATE_ONLY",
    format_verified: false,
    acquired: false,
    usable_strict: false,
    independence_cluster: "football-data-co-uk",
    reason: "Research reuse of DATE_ONLY odds, not a new clock.",
  },
  {
    sourceId: "api-football",
    url: "https://www.api-football.com",
    languages: ["en"],
    intended: "Live/recent odds API",
    probe: "commercial; not a free historical timestamp archive",
    temporal: "UNKNOWN",
    format_verified: false,
    acquired: false,
    usable_strict: false,
    independence_cluster: "api-football",
    reason: "Paid live feed; no licensed historical dump acquired.",
  },
  {
    sourceId: "oddspapi",
    url: "https://oddspapi.io",
    languages: ["en"],
    intended: "createdAt snapshots",
    probe: "not used — aggregator ToS/provenance unverified; no scrape",
    temporal: "UNKNOWN",
    format_verified: false,
    acquired: false,
    usable_strict: false,
    independence_cluster: "oddspapi",
    reason: "Rejected until licensed provenance is demonstrated.",
  },
];

async function probeStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/csv,text/plain,*/*",
        "User-Agent": "sports-prediction-engine-research/0.1",
      },
    });
    return res.status;
  } catch {
    return 0;
  }
}

export type Probe021 = { sourceId: string; url: string; status: number | null };

export async function probeTimestampedSources(): Promise<Probe021[]> {
  const targets: Array<{ sourceId: string; url: string }> = [
    {
      sourceId: "the-odds-api-historical",
      url: "https://api.the-odds-api.com/v4/historical/sports/soccer_epl/odds?regions=uk&markets=h2h&date=2021-10-18T12:00:00Z",
    },
    {
      sourceId: "football-data-co-uk-live",
      url: "https://www.football-data.co.uk/mmz4281/2324/E0.csv",
    },
    {
      sourceId: "openligadb",
      url: "https://api.openligadb.de/getmatchdata/bl1/2020/1",
    },
    {
      sourceId: "betfair-historical-data",
      url: "https://historicdata.betfair.com/",
    },
  ];
  const out: Probe021[] = [];
  for (const t of targets) {
    out.push({ ...t, status: await probeStatus(t.url) });
  }
  return out;
}

export function openLigaHasOdds(payload: unknown): boolean {
  const text = JSON.stringify(payload).toLowerCase();
  return /odds|bookmaker|quote/.test(text);
}
