import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TASK031_CACHE_DIR } from "@/domain/eval/breakthrough-031/config";
import { inspectFiveDollarCsv, inspectJulienOddsCsv } from "@/domain/eval/breakthrough-031/classify";
import type { Probe031, SourceRow031 } from "@/domain/eval/breakthrough-031/types";
import { FROZEN_028_SHA256_031 } from "@/domain/eval/breakthrough-031/types";
import { strictCandidatesPath } from "@/domain/eval/breakthrough-027/config";

async function httpProbe(url: string, timeoutMs = 12_000): Promise<Omit<Probe031, "channel" | "license">> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "betting-predict-task-031-probe" },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      url,
      http_status: res.status,
      acquired: res.ok && buf.length > 0,
      snippet: buf.subarray(0, 120).toString("latin1").replace(/[\u0000-\u001F]/g, " "),
      bytes: buf.length,
      sha256: buf.length > 0 ? createHash("sha256").update(buf).digest("hex") : null,
    };
  } catch (e) {
    return {
      url,
      http_status: null,
      acquired: false,
      snippet: e instanceof Error ? e.message : "error",
      bytes: 0,
      sha256: null,
    };
  }
}

async function downloadIfMissing(dest: string, url: string, timeoutMs: number): Promise<Probe031> {
  if (existsSync(dest)) {
    const buf = readFileSync(dest);
    return {
      channel: dest,
      url,
      http_status: 200,
      acquired: true,
      snippet: "ON_DISK",
      license: "see sources.json",
      bytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
  }
  const p = await httpProbe(url, timeoutMs);
  if (p.acquired && p.bytes > 0) {
    mkdirSync(TASK031_CACHE_DIR, { recursive: true });
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "betting-predict-task-031-acquire" },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    return {
      channel: dest,
      url,
      http_status: res.status,
      acquired: res.ok,
      snippet: "DOWNLOADED",
      license: "see sources.json",
      bytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
  }
  return { channel: dest, license: "see sources.json", ...p };
}

function shaPath(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export async function acquireTask031(input: { skipHeavy: boolean }): Promise<{
  probes: Probe031[];
  sources: SourceRow031[];
  five_dollar: ReturnType<typeof inspectFiveDollarCsv> | null;
  julien: ReturnType<typeof inspectJulienOddsCsv> | null;
  base_sha256: string | null;
  added_strict_events: 0;
  hunt_exhausted: boolean;
}> {
  mkdirSync(TASK031_CACHE_DIR, { recursive: true });
  const probes: Probe031[] = [];
  const add = (channel: string, license: string, p: Omit<Probe031, "channel" | "license">) => {
    probes.push({ channel, license, ...p });
  };

  const julienPath = join(TASK031_CACHE_DIR, "julien-soccer-odds.csv");
  const fivePath = join(TASK031_CACHE_DIR, "5dollar-data.csv");
  const zenodoReadme = join(TASK031_CACHE_DIR, "zenodo-readme.txt");

  if (!input.skipHeavy) {
    add(
      "betfair-historic",
      "Betfair Historic (account)",
      await httpProbe("https://historicdata.betfair.com/", 12_000),
    );
    add(
      "football-charts",
      "paid one-off licence €199 — not purchased",
      await httpProbe("https://www.football-charts.com/data", 12_000),
    );
    add(
      "oddspapi-v4-historical",
      "OddsPapi apiKey required; docs say history from 2026-01 only",
      await httpProbe(
        "https://api.oddspapi.io/v4/historical-odds?fixtureId=id1000000758265379&bookmakers=pinnacle,bet365",
        12_000,
      ),
    );
    add(
      "5dollar-status",
      "5DollarFootballAPI key required",
      await httpProbe("https://api.5dollarfootballapi.com/v1/status", 12_000),
    );
    add(
      "football-data-co-uk-E0-1516",
      "football-data.co.uk terms — DATE_ONLY / Friday-afternoon collection",
      await httpProbe("https://www.football-data.co.uk/mmz4281/1516/E0.csv", 12_000),
    );
    add(
      "huggingface-julien-soccer-stats",
      "Apache-2.0",
      await httpProbe("https://huggingface.co/api/datasets/JulienDelavande/soccer_stats", 12_000),
    );
    add(
      "huggingface-5dollar-pl-sample",
      "HF sample terms",
      await httpProbe(
        "https://huggingface.co/api/datasets/5dollarfootballapi/premier-league-2025-26-football-api-sample",
        12_000,
      ),
    );
    add(
      "zenodo-12673394",
      "CC BY 4.0 — football-data.co.uk lineage",
      await httpProbe("https://zenodo.org/api/records/12673394", 12_000),
    );
    probes.push(
      await downloadIfMissing(
        julienPath,
        "https://huggingface.co/datasets/JulienDelavande/soccer_stats/resolve/main/soccer_odds.csv",
        25_000,
      ),
    );
    probes.push(
      await downloadIfMissing(
        fivePath,
        "https://huggingface.co/datasets/5dollarfootballapi/premier-league-2025-26-football-api-sample/resolve/main/data.csv",
        25_000,
      ),
    );
    probes.push(
      await downloadIfMissing(
        zenodoReadme,
        "https://zenodo.org/api/records/12673394/files/ReadMe.txt/content",
        20_000,
      ),
    );
  }

  const fiveText = existsSync(fivePath) ? readFileSync(fivePath, "utf8") : null;
  const julienText = existsSync(julienPath) ? readFileSync(julienPath, "utf8") : null;
  const five = fiveText ? inspectFiveDollarCsv(fiveText) : null;
  const julien = julienText ? inspectJulienOddsCsv(julienText) : null;
  const basePath = strictCandidatesPath();
  const base_sha256 = shaPath(basePath);

  const sources: SourceRow031[] = [
    {
      source: "DATASET_031_BASE / TASK 028 STRICT",
      url: "https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset",
      dataset: "BeatTheBookie odds_series T-1h + soccer-dataset date_utc",
      license: "GPL-3.0 upstream; dump gitignored",
      events: 10499,
      quotes: 31497,
      markets: "1X2",
      bookmakers: "32 (frozen file)",
      kickoff: "soccer-dataset date_utc SOURCE UTC",
      quote_timestamp: "PHP hours_before=1 DERIVED",
      timestamp_type: "RELATIVE / BIN_DOCUMENTED",
      timezone: "kickoff UTC documented; quote derived",
      matching: "MATCH_EXACT date+home+away",
      strict_events: 10499,
      status: "STRICT_FROZEN",
      sha256: base_sha256 ?? FROZEN_028_SHA256_031,
      level: "LEVEL_B",
      cluster: "beatthebookie-kaggle-austro",
    },
    {
      source: "JulienDelavande/soccer_stats soccer_odds.csv",
      url: "https://huggingface.co/datasets/JulienDelavande/soccer_stats",
      dataset: "soccer_odds.csv (~18KB sample)",
      license: "Apache-2.0",
      events: julien?.matches ?? null,
      quotes: julien?.rows ?? null,
      markets: "h2h",
      bookmakers: "Odds-API-like keys",
      kickoff: "commence_time naive",
      quote_timestamp: "bookmaker_last_update naive; datetime_insert post-match",
      timestamp_type: "ABSOLUTE_NAIVE",
      timezone: "undocumented — not invented as UTC",
      matching: "match_id; outcomes not joined for capital",
      strict_events: 0,
      status: "RESEARCH",
      sha256: shaPath(julienPath),
      level: "UNKNOWN",
      cluster: "julien-hf-odds-api-sample",
    },
    {
      source: "5dollarfootballapi PL 2025/26 HF sample",
      url: "https://huggingface.co/datasets/5dollarfootballapi/premier-league-2025-26-football-api-sample",
      dataset: "data.csv opening/closing 1X2",
      license: "HF sample; full API is paid $5/mo + key",
      events: five?.events ?? null,
      quotes: five?.events != null ? five.events * 3 : null,
      markets: "1X2 opening/closing labels",
      bookmakers: "unspecified in sample",
      kickoff: "kickoff_utc ISO +00:00",
      quote_timestamp: "none",
      timestamp_type: "OPEN_CLOSE_LABEL",
      timezone: "kickoff UTC documented",
      matching: "fixture_id",
      strict_events: 0,
      status: "RESEARCH",
      sha256: shaPath(fivePath),
      level: "UNKNOWN",
      cluster: "5dollar-hf-sample",
    },
    {
      source: "Zenodo 12673394 Hegarty/Whelan",
      url: "https://zenodo.org/records/12673394",
      dataset: "football-data.co.uk combined CSV",
      license: "CC BY 4.0",
      events: 131432,
      quotes: null,
      markets: "1X2 opening-ish / closing C*",
      bookmakers: "football-data set",
      kickoff: "Date + Time local undocumented collection TZ",
      quote_timestamp: "Friday afternoon / Tuesday afternoon window",
      timestamp_type: "DATE_ONLY / DATASET_WINDOW",
      timezone: "not a quote clock",
      matching: "teams/date",
      strict_events: 0,
      status: "DATE_ONLY",
      sha256: shaPath(zenodoReadme),
      level: "DATE_ONLY",
      cluster: "football-data-co-uk",
    },
    {
      source: "football-data.co.uk CSVs",
      url: "https://www.football-data.co.uk/data.php",
      dataset: "divisional season CSVs 1993–",
      license: "site terms",
      events: null,
      quotes: null,
      markets: "1X2 / OU / AH",
      bookmakers: "B365, Pinnacle, WH, …",
      kickoff: "Date + Time",
      quote_timestamp: "collection window, not T-1h",
      timestamp_type: "DATE_ONLY / DATASET_WINDOW",
      timezone: "undocumented for quotes",
      matching: "teams/date",
      strict_events: 0,
      status: "DATE_ONLY",
      sha256: null,
      level: "DATE_ONLY",
      cluster: "football-data-co-uk",
    },
    {
      source: "Betfair Historic",
      url: "https://historicdata.betfair.com/",
      dataset: "BASIC/ADVANCED/PRO stream bz2 MATCH_ODDS",
      license: "Betfair account; BASIC listed free of charge after login",
      events: null,
      quotes: null,
      markets: "MATCH_ODDS",
      bookmakers: "Betfair Exchange",
      kickoff: "marketTime / marketStartTime",
      quote_timestamp: "pt publishTime ms UTC",
      timestamp_type: "ABSOLUTE",
      timezone: "UTC (pt millis)",
      matching: "eventId + runners",
      strict_events: 0,
      status: "ACCOUNT_REQUIRED",
      sha256: null,
      level: "LEVEL_A",
      cluster: "betfair-historic",
    },
    {
      source: "OddsPapi /historical-odds",
      url: "https://api.oddspapi.io/v4/historical-odds",
      dataset: "per-fixture snapshot list createdAt",
      license: "free tier requires apiKey; no signup performed",
      events: null,
      quotes: null,
      markets: "1X2 + others",
      bookmakers: "max 3 per call",
      kickoff: "fixture clock via other endpoint",
      quote_timestamp: "createdAt with Z",
      timestamp_type: "ABSOLUTE",
      timezone: "UTC documented in examples",
      matching: "fixtureId",
      strict_events: 0,
      status: "API_KEY_REQUIRED",
      sha256: null,
      level: "LEVEL_A",
      cluster: "oddspapi",
    },
    {
      source: "Football Charts archive",
      url: "https://www.football-charts.com/data",
      dataset: "paid odds history",
      license: "€199 — not purchased",
      events: null,
      quotes: null,
      markets: "unknown until purchase",
      bookmakers: "unknown",
      kickoff: "unknown",
      quote_timestamp: "claimed history",
      timestamp_type: "UNKNOWN",
      timezone: "unknown",
      matching: "unknown",
      strict_events: 0,
      status: "PAID",
      sha256: null,
      level: "UNKNOWN",
      cluster: "football-charts",
    },
    {
      source: "Club-Football-Match-Data",
      url: "https://github.com/xgabora/Club-Football-Match-Data",
      dataset: "Odd* columns",
      license: "repo terms",
      events: 238000,
      quotes: null,
      markets: "1X2",
      bookmakers: "aggregated",
      kickoff: "MatchTime CET-1 label (TASK 018)",
      quote_timestamp: "none",
      timestamp_type: "DATE_ONLY",
      timezone: "not a quote clock",
      matching: "teams/date",
      strict_events: 0,
      status: "DATE_ONLY",
      sha256: null,
      level: "DATE_ONLY",
      cluster: "club-football",
    },
    {
      source: "Kaggle realsingwong Asian handicap ticks",
      url: "https://www.kaggle.com/datasets/realsingwong/european-football-asian-handicap-odds-time-series",
      dataset: "90-match SAMPLE YYYYMMDDHHmmss",
      license: "UNKNOWN — not CAPITAL",
      events: 90,
      quotes: null,
      markets: "AH not 1X2",
      bookmakers: "Chinese books",
      kickoff: "absent",
      quote_timestamp: "compact clock; TZ undocumented",
      timestamp_type: "ABSOLUTE_UNDOCUMENTED_TZ",
      timezone: "undocumented",
      matching: "ambiguous Chinese names",
      strict_events: 0,
      status: "RESEARCH",
      sha256: null,
      level: "UNKNOWN",
      cluster: "kaggle-ah",
    },
    {
      source: "5DollarFootballAPI odds/history",
      url: "https://5dollarfootballapi.com/docs/odds",
      dataset: "GET /v1/fixtures/{id}/odds/history",
      license: "paid $5/mo + API key — not purchased, no signup",
      events: null,
      quotes: null,
      markets: "1X2 history claimed",
      bookmakers: "Bet365 + paid extras",
      kickoff: "kickoff_utc",
      quote_timestamp: "history endpoint (not acquired)",
      timestamp_type: "ABSOLUTE (claimed)",
      timezone: "UTC for kickoff",
      matching: "fixture id",
      strict_events: 0,
      status: "API_KEY_REQUIRED",
      sha256: null,
      level: "UNKNOWN",
      cluster: "5dollar-api",
    },
  ];

  return {
    probes,
    sources,
    five_dollar: five,
    julien,
    base_sha256,
    added_strict_events: 0,
    hunt_exhausted: !input.skipHeavy,
  };
}
