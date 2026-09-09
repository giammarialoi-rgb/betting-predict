/**
 * Legitimate GET only. No WAF bypass, no credentials, no purchase, no signup.
 */

import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { matchOddsFixturePath } from "@/domain/eval/temporal-023/config";
import { TASK026_CACHE_DIR } from "@/domain/eval/bottleneck-026/config";
import type { AcquisitionProbe026 } from "@/domain/eval/bottleneck-026/types";

export const URLS_026 = {
  five_dollar_status: "https://api.5dollarfootballapi.com/v1/status",
  five_dollar_leagues: "https://api.5dollarfootballapi.com/v1/leagues",
  five_dollar_docs: "https://5dollarfootballapi.com/docs",
  oddspapi_v4_historical:
    "https://api.oddspapi.io/v4/historical-odds?fixtureId=id1000000758265379&bookmakers=pinnacle,bet365",
  oddspapi_v4_sports: "https://api.oddspapi.io/v4/sports",
  oddspapi_v5_bookmakers: "https://v5.oddspapi.io/en/bookmakers",
  oddspapi_docs: "https://docs.oddspapi.io/",
  kaggle_ah_view: "https://www.kaggle.com/api/v1/datasets/view/realsingwong/european-football-asian-handicap-odds-time-series",
  kaggle_ah_download:
    "https://www.kaggle.com/api/v1/datasets/download/realsingwong/european-football-asian-handicap-odds-time-series",
  zenodo_record: "https://zenodo.org/api/records/12673394",
  zenodo_raw_zip: "https://zenodo.org/api/records/12673394/files/Raw%20to%20Tidy%20Data.zip/content",
  zenodo_notes: "https://zenodo.org/api/records/12673394/files/notes.txt/content",
  openligadb: "https://api.openligadb.de/getavailableleagues",
  clubelo: "https://api.clubelo.com/Chelsea",
  petermclagan_tree: "https://api.github.com/repos/petermclagan/betfair-historical/git/trees/master?recursive=1",
  kito_tree: "https://api.github.com/repos/kito129/betfairHitoricalRawDataConversion/git/trees/main?recursive=1",
  nautilus_betfair_dir: "https://api.github.com/repos/nautechsystems/nautilus_trader/contents/tests/test_data/local/betfair",
  nautilus_docs: "https://nautilustrader.io/docs/latest/tutorials/backtest_book_imbalance_betfair/",
  football_data_e0: "https://www.football-data.co.uk/mmz4281/2425/E0.csv",
} as const;

export function kaggleAhZipPath(): string {
  return join(TASK026_CACHE_DIR, "kaggle-ah.zip");
}

export function zenodoRawZipPath(): string {
  return join(TASK026_CACHE_DIR, "zenodo-raw-to-tidy.zip");
}

function local(channel: string, path: string, url: string, note: string, license = "local"): AcquisitionProbe026 {
  const ok = existsSync(path);
  return {
    channel,
    url,
    http_status: ok ? 200 : null,
    acquired: ok,
    license,
    note: ok ? `${note} bytes=${statSync(path).size}` : `NOT_ON_DISK ${path}`,
  };
}

async function probe(input: {
  channel: string;
  url: string;
  license: string;
  maxBytes?: number;
}): Promise<AcquisitionProbe026> {
  try {
    const res = await fetch(input.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(input.url.includes("clubelo") ? 8_000 : 12_000),
      headers: {
        "User-Agent": "betting-predict-task-026-probe",
        ...(input.maxBytes != null ? { Range: `bytes=0-${input.maxBytes}` } : {}),
      },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const snippet = buf.subarray(0, 120).toString("latin1").replace(/[\u0000-\u001F]/g, " ");
    const looksZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    return {
      channel: input.channel,
      url: input.url,
      http_status: res.status,
      acquired: res.ok && (looksZip || res.headers.get("content-type")?.includes("json") === true || buf.length > 0),
      license: input.license,
      note: `HTTP ${res.status} zip=${looksZip} bytes=${buf.length} ${snippet.slice(0, 180)}`,
    };
  } catch (err) {
    return {
      channel: input.channel,
      url: input.url,
      http_status: null,
      acquired: false,
      license: input.license,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

async function downloadIfMissing(input: {
  channel: string;
  url: string;
  dest: string;
  license: string;
  timeoutMs: number;
}): Promise<AcquisitionProbe026> {
  if (existsSync(input.dest)) {
    return local(input.channel, input.dest, input.url, "already cached (gitignored)", input.license);
  }
  mkdirSync(TASK026_CACHE_DIR, { recursive: true });
  try {
    const res = await fetch(input.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(input.timeoutMs),
      headers: { "User-Agent": "betting-predict-task-026-acquire" },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
    if (!res.ok || !isZip) {
      return {
        channel: input.channel,
        url: input.url,
        http_status: res.status,
        acquired: false,
        license: input.license,
        note: `not persisted HTTP ${res.status} zip=${isZip} bytes=${buf.length}`,
      };
    }
    writeFileSync(input.dest, buf);
    return {
      channel: input.channel,
      url: input.url,
      http_status: res.status,
      acquired: true,
      license: input.license,
      note: `saved ${input.dest} bytes=${buf.length} (gitignored, not capital)`,
    };
  } catch (err) {
    return {
      channel: input.channel,
      url: input.url,
      http_status: null,
      acquired: false,
      license: input.license,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

export function localProbes026(): AcquisitionProbe026[] {
  return [
    local(
      "betfair-mcm-fixture",
      matchOddsFixturePath(),
      "https://github.com/petermclagan/betfair-historical",
      "Committed MATCH_ODDS ndjson (1 EPL event). MIRROR — format/temporal validation only",
      "Betfair terms / GitHub MIRROR",
    ),
    local(
      "kaggle-ah-zip",
      kaggleAhZipPath(),
      URLS_026.kaggle_ah_download,
      "Kaggle AH public zip (sample, not claimed 7494)",
      "Kaggle License Unknown",
    ),
    local(
      "zenodo-raw-zip",
      zenodoRawZipPath(),
      URLS_026.zenodo_raw_zip,
      "Zenodo UCD Raw to Tidy Data.zip",
      "CC-BY-4.0",
    ),
    local(
      "club-football-matches",
      CLUB_FOOTBALL_MATCHES_CSV,
      "https://github.com/xgabora/Club-Football-Match-Data",
      "Club-Football Matches.csv RESEARCH_DATE_ONLY",
      "upstream clone",
    ),
  ];
}

export async function probeTask026(allowNetwork: boolean): Promise<AcquisitionProbe026[]> {
  const locals = localProbes026();
  if (!allowNetwork) return locals;
  const remote = await Promise.all([
    probe({ channel: "5dollar-status", url: URLS_026.five_dollar_status, license: "ToS; key required" }),
    probe({ channel: "5dollar-leagues", url: URLS_026.five_dollar_leagues, license: "ToS; key required" }),
    probe({ channel: "oddspapi-v4-historical", url: URLS_026.oddspapi_v4_historical, license: "B2B; apiKey required" }),
    probe({ channel: "oddspapi-v4-sports", url: URLS_026.oddspapi_v4_sports, license: "B2B; apiKey required" }),
    probe({ channel: "oddspapi-v5-bookmakers", url: URLS_026.oddspapi_v5_bookmakers, license: "B2B; apiKey required" }),
    probe({ channel: "kaggle-ah-view", url: URLS_026.kaggle_ah_view, license: "Unknown" }),
    probe({ channel: "zenodo-12673394", url: URLS_026.zenodo_record, license: "CC-BY-4.0" }),
    probe({
      channel: "openligadb-leagues",
      url: URLS_026.openligadb,
      license: "OpenLigaDB",
      maxBytes: 4095,
    }),
    probe({ channel: "clubelo-chelsea", url: URLS_026.clubelo, license: "ClubElo" }),
    probe({
      channel: "github-petermclagan-tree",
      url: URLS_026.petermclagan_tree,
      license: "repo",
      maxBytes: 8191,
    }),
    probe({ channel: "github-kito-tree", url: URLS_026.kito_tree, license: "repo", maxBytes: 8191 }),
    probe({ channel: "nautilus-betfair-dir", url: URLS_026.nautilus_betfair_dir, license: "LGPL-3.0; data gitignored" }),
    probe({
      channel: "football-data-co-uk-e0",
      url: URLS_026.football_data_e0,
      license: "football-data.co.uk",
    }),
  ]);
  return [...locals, ...remote];
}

export async function acquirePublicZips(): Promise<AcquisitionProbe026[]> {
  return Promise.all([
    downloadIfMissing({
      channel: "kaggle-ah-download",
      url: URLS_026.kaggle_ah_download,
      dest: kaggleAhZipPath(),
      license: "Kaggle License Unknown — DOWNLOAD ≠ USE for capital",
      timeoutMs: 90_000,
    }),
    downloadIfMissing({
      channel: "zenodo-raw-download",
      url: URLS_026.zenodo_raw_zip,
      dest: zenodoRawZipPath(),
      license: "CC-BY-4.0",
      timeoutMs: 120_000,
    }),
  ]);
}
