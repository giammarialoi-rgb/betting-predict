import type {
  CorpusLevel026,
  PaidAlternative026,
  SourceMatrixRow026,
} from "@/domain/eval/bottleneck-026/types";
import type { KaggleAhInspect026 } from "@/domain/eval/bottleneck-026/kaggle-ah";
import type { ZenodoInspect026 } from "@/domain/eval/bottleneck-026/zenodo";
import type { AcquisitionProbe026 } from "@/domain/eval/bottleneck-026/types";

function probe(probes: readonly AcquisitionProbe026[], channel: string): AcquisitionProbe026 | undefined {
  return [...probes].reverse().find((p) => p.channel === channel);
}

function httpOk(p: AcquisitionProbe026 | undefined): boolean {
  return p != null && p.http_status === 200;
}

export function sourceMatrix026(input: {
  probes: readonly AcquisitionProbe026[];
  kaggle: KaggleAhInspect026;
  zenodo: ZenodoInspect026;
  clubEvents: number;
  betfairExactEvents: number;
  betfairCapitalEvents: number;
}): SourceMatrixRow026[] {
  const p5 = probe(input.probes, "5dollar-status");
  const pOp4 = probe(input.probes, "oddspapi-v4-historical");
  const pOp5 = probe(input.probes, "oddspapi-v5-bookmakers");
  const pOl = probe(input.probes, "openligadb-leagues");
  const pElo = probe(input.probes, "clubelo-chelsea");
  const pFd = probe(input.probes, "football-data-co-uk-e0");
  const pNau = probe(input.probes, "nautilus-betfair-dir");
  const pKito = probe(input.probes, "github-kito-tree");
  const pPm = probe(input.probes, "github-petermclagan-tree");
  const pZen = probe(input.probes, "zenodo-12673394");

  const rows: SourceMatrixRow026[] = [
    {
      sourceId: "5dollarfootballapi",
      accessible: httpOk(p5),
      free: false,
      events: 0,
      quotes: 0,
      timestamp_exact: null,
      opening_timestamp: null,
      closing_timestamp: null,
      tick_history: null,
      markets: "docs: 1X2 AH goals corners cards BTTS HT (Bet365); ticks=Ultra",
      license: "ToS; Bearer key; no signup performed",
      corpus_level: "UNUSABLE",
      strict_events: 0,
      note: `probe HTTP ${p5?.http_status ?? "—"} — 401 without key. Free plan exists in docs; key not obtained (€0 / no account).`,
    },
    {
      sourceId: "oddspapi",
      accessible: httpOk(pOp4) || httpOk(pOp5),
      free: false,
      events: 0,
      quotes: 0,
      timestamp_exact: null,
      opening_timestamp: null,
      closing_timestamp: null,
      tick_history: null,
      markets: "docs: historical odds / createdAt|changedAt — unverified rows",
      license: "B2B; all HTTP requires apiKey",
      corpus_level: "UNUSABLE",
      strict_events: 0,
      note: `v4 historical HTTP ${pOp4?.http_status ?? "—"}; v5 bookmakers HTTP ${pOp5?.http_status ?? "—"}. No public unauthenticated historical dump.`,
    },
    {
      sourceId: "kaggle-realsingwong-ah",
      accessible: input.kaggle.zip_present,
      free: true,
      events: input.kaggle.exact_timestamp_events,
      quotes: input.kaggle.quote_rows,
      timestamp_exact: input.kaggle.exact_timestamp_events > 0,
      opening_timestamp: true,
      closing_timestamp: true,
      tick_history: true,
      markets: "Asian Handicap only (sample zip)",
      license: "UNKNOWN (Kaggle) / README personal use / titan007.com — not capital",
      corpus_level: "RESEARCH_STRICT",
      strict_events: 0,
      note: input.kaggle.note,
    },
    {
      sourceId: "zenodo-12673394-ucd",
      accessible: input.zenodo.zip_present || httpOk(pZen),
      free: true,
      events: input.zenodo.raw_rows,
      quotes: input.zenodo.raw_rows,
      timestamp_exact: false,
      opening_timestamp: false,
      closing_timestamp: false,
      tick_history: false,
      markets: "1X2 / AH columns from football-data.co.uk (DATE_ONLY)",
      license: "CC-BY-4.0",
      corpus_level: "RESEARCH_DATE_ONLY",
      strict_events: 0,
      note: input.zenodo.note,
    },
    {
      sourceId: "betfair-historic-basic-github-mirror",
      accessible: true,
      free: true,
      events: input.betfairExactEvents,
      quotes: input.betfairExactEvents * 3,
      timestamp_exact: input.betfairExactEvents > 0,
      opening_timestamp: null,
      closing_timestamp: null,
      tick_history: true,
      markets: "MATCH_ODDS",
      license: "Betfair terms; GitHub SAMPLE/MIRROR — not licensed historic capital",
      corpus_level: "RESEARCH_STRICT",
      strict_events: input.betfairCapitalEvents,
      note: "petermclagan football-basic-sample / committed ndjson. OPTIONAL_HIGH_QUALITY. Provenance=MIRROR.",
    },
    {
      sourceId: "club-football-match-data",
      accessible: input.clubEvents > 0,
      free: true,
      events: input.clubEvents,
      quotes: input.clubEvents,
      timestamp_exact: false,
      opening_timestamp: false,
      closing_timestamp: false,
      tick_history: false,
      markets: "1X2 Odd* DATE_ONLY",
      license: "upstream clone",
      corpus_level: "RESEARCH_DATE_ONLY",
      strict_events: 0,
      note: "Research corpus A — never capital.",
    },
    {
      sourceId: "openligadb",
      accessible: httpOk(pOl),
      free: true,
      events: null,
      quotes: 0,
      timestamp_exact: false,
      opening_timestamp: false,
      closing_timestamp: false,
      tick_history: false,
      markets: "none",
      license: "OpenLigaDB",
      corpus_level: "INDEX",
      strict_events: 0,
      note: `HTTP ${pOl?.http_status ?? "—"}. Fixtures/leagues index, not bookmaker quote clocks.`,
    },
    {
      sourceId: "clubelo",
      accessible: httpOk(pElo),
      free: true,
      events: null,
      quotes: 0,
      timestamp_exact: false,
      opening_timestamp: false,
      closing_timestamp: false,
      tick_history: false,
      markets: "none (ratings)",
      license: "ClubElo",
      corpus_level: httpOk(pElo) ? "SECONDARY" : "UNUSABLE",
      strict_events: 0,
      note: `HTTP ${pElo?.http_status ?? "timeout/error"}. Ratings only.`,
    },
    {
      sourceId: "football-data-co-uk",
      accessible: httpOk(pFd),
      free: true,
      events: null,
      quotes: null,
      timestamp_exact: false,
      opening_timestamp: false,
      closing_timestamp: false,
      tick_history: false,
      markets: "1X2 DATE_ONLY",
      license: "football-data.co.uk",
      corpus_level: "RESEARCH_DATE_ONLY",
      strict_events: 0,
      note:
        pFd?.http_status === 503
          ? "BLOCKED HTTP 503 — optional, laboratory continues."
          : `HTTP ${pFd?.http_status ?? "—"}`,
    },
    {
      sourceId: "nautilus-trader-betfair-sample",
      accessible: false,
      free: true,
      events: 0,
      quotes: 0,
      timestamp_exact: null,
      opening_timestamp: null,
      closing_timestamp: null,
      tick_history: null,
      markets: "docs: football MATCH_ODDS ~82k MCM / 18 days",
      license: "LGPL-3.0 code; Betfair data gitignored / not shipped",
      corpus_level: "UNUSABLE",
      strict_events: 0,
      note: `GitHub contents HTTP ${pNau?.http_status ?? "—"}. Path tests/test_data/local/betfair is gitignored. Docs are not a download.`,
    },
    {
      sourceId: "kito129-betfair-raw-conversion",
      accessible: pKito?.http_status === 200,
      free: true,
      events: 0,
      quotes: 0,
      timestamp_exact: null,
      opening_timestamp: null,
      closing_timestamp: null,
      tick_history: null,
      markets: "inspected tree: tennis MATCH_ODDS JSON, not football",
      license: "third-party conversion",
      corpus_level: "UNUSABLE",
      strict_events: 0,
      note: "GitHub tree listed tennis player markets. Not a football timestamp corpus.",
    },
    {
      sourceId: "petermclagan-betfair-historical",
      accessible: pPm?.http_status === 200 || true,
      free: true,
      events: 1,
      quotes: 3,
      timestamp_exact: true,
      opening_timestamp: null,
      closing_timestamp: null,
      tick_history: true,
      markets: "MATCH_ODDS sample bz2",
      license: "MIRROR/SAMPLE",
      corpus_level: "RESEARCH_STRICT",
      strict_events: 0,
      note: "Only football-basic-sample.bz2 in the repo tree. No extra BASIC-*.bz2 football dump.",
    },
  ];
  return rows;
}

export function paidAlternativesAfterFreeExhausted(): PaidAlternative026[] {
  return [
    {
      source: "5DollarFootballAPI Ultra",
      cost: "$25/month (public docs, not purchased)",
      events: "claimed tick history per fixture; volume unverified without key",
      timestamp_quality: "docs: recorded ticks; opening/closing labels ≠ STRICT until rows inspected",
      markets: "1X2, AH, goals, corners, cards, BTTS, HT; Bet365 on lower plans, 19 books on Ultra",
      historical_depth: "docs: back to 2014 on Ultra; Free=3 months fixtures, ticks=Ultra-only (403 otherwise)",
      license: "ToS; no raw-feed resale",
      cost_per_event: "unknown until a key probe returns a real event count",
    },
    {
      source: "OddsPapi (B2B)",
      cost: "not listed publicly; contact sales — not purchased",
      events: "docs: historical odds since ~2026-01 on some pages; unverified",
      timestamp_quality: "docs: createdAt / changedAt epoch ms — unverified (401 without apiKey)",
      markets: "aggregated 350+ books including Pinnacle/Bet365 if the plan allows",
      historical_depth: "REST historical / CLV; depth unverified",
      license: "B2B operator terms",
      cost_per_event: "unknown",
    },
    {
      source: "Betfair Historic BASIC/Advanced/Pro",
      cost: "account + product fees (not purchased)",
      events: "official BASIC files with pt / marketTime — still the best STRICT model",
      timestamp_quality: "SOURCE publishTime — suitable for STRICT if licensed",
      markets: "exchange MATCH_ODDS and others in the product",
      historical_depth: "official archive",
      license: "Betfair historic data terms",
      cost_per_event: "unknown; OPTIONAL_HIGH_QUALITY_SOURCE not SINGLE_BLOCKER",
    },
  ];
}

export function corpusLevelFromMatrix(sourceId: string, rows: readonly SourceMatrixRow026[]): CorpusLevel026 {
  return rows.find((r) => r.sourceId === sourceId)?.corpus_level ?? "UNUSABLE";
}
