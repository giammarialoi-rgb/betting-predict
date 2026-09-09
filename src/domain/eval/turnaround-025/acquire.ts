/**
 * Legitimate GET/HEAD only. No WAF bypass, no credentials, no purchase.
 * football-data.co.uk is optional: 503 = BLOCKED, laboratory continues.
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { TASK024_CACHE_DIR } from "@/domain/eval/attack-024/soccer-audit";
import { CLOSING_ODDS_CACHE } from "@/domain/eval/recovery-022/acquire";
import { matchOddsFixturePath } from "@/domain/eval/temporal-023/config";
import { KAGGLE_CACHE } from "@/domain/eval/turnaround-025/config";
import type { AcquisitionProbe025 } from "@/domain/eval/turnaround-025/types";

export const URLS_025 = {
  kaggle_dataset: "https://www.kaggle.com/datasets/zygmunt/betfair-sports",
  kaggle_api: "https://www.kaggle.com/api/v1/datasets/view/zygmunt/betfair-sports",
  kaggle_download: "https://www.kaggle.com/api/v1/datasets/download/zygmunt/betfair-sports",
  betfair_portal: "https://historicdata.betfair.com/",
  betfair_data: "http://data.betfair.com/",
  betfair_hub: "https://betfair-datascientists.github.io/data/usingHistoricDataSite/",
  workbook: "https://github.com/betfair/historic-data-workbook",
  petermclagan: "https://github.com/petermclagan/betfair-historical",
  mzaja: "https://github.com/mzaja/betfair-database",
  ucd_pdf: "https://www.ucd.ie/economics/t4media/WP2025_22.pdf",
  football_data_e0: "https://www.football-data.co.uk/mmz4281/2425/E0.csv",
  zenodo: "https://zenodo.org/api/records/12673394",
} as const;

function local(channel: string, path: string, url: string, note: string): AcquisitionProbe025 {
  const ok = existsSync(path);
  return {
    channel,
    url,
    http_status: ok ? 200 : null,
    acquired: ok,
    license: "local cache / committed fixture",
    note: ok ? `${note} bytes=${statSync(path).size}` : `NOT_ON_DISK ${path}`,
  };
}

async function probe(input: {
  channel: string;
  url: string;
  license: string;
  method?: "GET" | "HEAD";
  maxBytes?: number;
}): Promise<AcquisitionProbe025> {
  try {
    const res = await fetch(input.url, {
      method: input.method ?? "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent": "betting-predict-task-025-probe",
        ...(input.maxBytes != null ? { Range: `bytes=0-${input.maxBytes}` } : {}),
      },
    });
    const buf = input.method === "HEAD" ? null : Buffer.from(await res.arrayBuffer());
    const snippet = buf
      ? buf.subarray(0, 80).toString("latin1").replace(/[\u0000-\u001F]/g, " ")
      : "";
    const looksZip = buf != null && buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    const blocked = res.status === 503;
    return {
      channel: input.channel,
      url: input.url,
      http_status: res.status,
      acquired: false,
      license: input.license,
      note: blocked
        ? `BLOCKED HTTP 503 — optional source, laboratory continues. ${snippet}`
        : `HTTP ${res.status} zip=${looksZip} ${snippet}`,
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

export function localProbes025(): AcquisitionProbe025[] {
  const sample023 = join(process.cwd(), "audit", "external", "task-023", "football-basic-sample.json");
  return [
    local(
      "betfair-mcm-fixture",
      matchOddsFixturePath(),
      "https://github.com/petermclagan/betfair-historical",
      "Committed MATCH_ODDS ndjson (1 EPL event, STRICT candidate)",
    ),
    local(
      "betfair-basic-sample-json",
      sample023,
      "https://github.com/petermclagan/betfair-historical",
      "petermclagan football-basic-sample extracted JSON (gitignored)",
    ),
    local(
      "kaggle-betfair-sports-csv",
      KAGGLE_CACHE,
      URLS_025.kaggle_dataset,
      "Kaggle weekly CSV cache",
    ),
    local(
      "club-football-matches",
      CLUB_FOOTBALL_MATCHES_CSV,
      "https://github.com/xgabora/Club-Football-Match-Data",
      "Club-Football Matches.csv RESEARCH_ONLY",
    ),
    local(
      "btb-closing-odds",
      CLOSING_ODDS_CACHE,
      "https://github.com/Lisandro79/BeatTheBookie",
      "BeatTheBookie closing_odds.csv DATE_ONLY",
    ),
    local(
      "soccer-odds-parquet",
      join(TASK024_CACHE_DIR, "odds.parquet"),
      "https://huggingface.co/datasets/eatpizzanot/soccer-dataset",
      "soccer-dataset odds.parquet CLOSING_AT_KICKOFF",
    ),
  ];
}

export async function probeTask025(allowNetwork: boolean): Promise<AcquisitionProbe025[]> {
  const locals = localProbes025();
  if (!allowNetwork) return locals;
  const remote = await Promise.all([
    probe({ channel: "kaggle-api-view", url: URLS_025.kaggle_api, license: "Kaggle Other" }),
    probe({
      channel: "kaggle-download",
      url: URLS_025.kaggle_download,
      license: "Kaggle Other",
      maxBytes: 63,
    }),
    probe({ channel: "betfair-historic-portal", url: URLS_025.betfair_portal, license: "Betfair terms" }),
    probe({ channel: "betfair-data-sample-host", url: URLS_025.betfair_data, license: "Betfair" }),
    probe({ channel: "betfair-automation-hub", url: URLS_025.betfair_hub, license: "public docs" }),
    probe({
      channel: "football-data-co-uk-e0",
      url: URLS_025.football_data_e0,
      license: "football-data.co.uk",
    }),
    probe({ channel: "ucd-wp2025-22-pdf", url: URLS_025.ucd_pdf, license: "paper" }),
    probe({ channel: "zenodo-12673394", url: URLS_025.zenodo, license: "CC-BY-4.0" }),
  ]);
  return [...locals, ...remote];
}

export async function acquireKaggleWeekly(): Promise<AcquisitionProbe025> {
  if (existsSync(KAGGLE_CACHE)) {
    return local(
      "kaggle-bulk-acquire",
      KAGGLE_CACHE,
      URLS_025.kaggle_dataset,
      "Kaggle weekly CSV already cached (gitignored). License Other — local research only, not redistributed.",
    );
  }
  const dir = join(process.cwd(), "audit", "external", "task-025");
  mkdirSync(dir, { recursive: true });
  const zipPath = join(dir, "betfair-sports.zip");
  try {
    const res = await fetch(URLS_025.kaggle_download, {
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
      headers: { "User-Agent": "betting-predict-task-025-acquire" },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
    if (!res.ok || !isZip) {
      return {
        channel: "kaggle-bulk-acquire",
        url: URLS_025.kaggle_download,
        http_status: res.status,
        acquired: false,
        license: "Kaggle Other",
        note: `bulk not persisted HTTP ${res.status} zip=${isZip} bytes=${buf.length}`,
      };
    }
    writeFileSync(zipPath, buf);
    execFileSync("tar", ["-xf", zipPath, "-C", dir], { stdio: "ignore" });
    const csv = readdirSync(dir).find((f) => f.toLowerCase().endsWith(".csv") && f !== "betfair-sports.csv");
    const found = csv
      ? join(dir, csv)
      : readdirSync(dir)
          .filter((f) => f.toLowerCase().endsWith(".csv"))
          .map((f) => join(dir, f))[0];
    if (!found || !existsSync(found)) {
      return {
        channel: "kaggle-bulk-acquire",
        url: URLS_025.kaggle_download,
        http_status: res.status,
        acquired: false,
        license: "Kaggle Other",
        note: `zip saved (${buf.length} bytes) but no CSV inside`,
      };
    }
    if (found !== KAGGLE_CACHE) copyFileSync(found, KAGGLE_CACHE);
    return {
      channel: "kaggle-bulk-acquire",
      url: URLS_025.kaggle_dataset,
      http_status: res.status,
      acquired: true,
      license: "Kaggle Other — local gitignored cache, not committed",
      note: `extracted ${found} bytes=${statSync(KAGGLE_CACHE).size}. One-week sample. Classify; do not force STRICT.`,
    };
  } catch (err) {
    return {
      channel: "kaggle-bulk-acquire",
      url: URLS_025.kaggle_download,
      http_status: null,
      acquired: false,
      license: "Kaggle Other",
      note: err instanceof Error ? err.message : String(err),
    };
  }
}
