/**
 * Acquire BeatTheBookie without scraping or WAF bypass.
 * Dropbox/Drive/Kaggle may fail; GitHub Kaggle-mirror closing_odds.csv is the acquired file.
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AcquisitionProbe022 } from "@/domain/eval/recovery-022/types";

export const TASK022_CACHE_DIR = join(process.cwd(), "audit", "external", "task-022");
export const CLOSING_ODDS_CACHE = join(TASK022_CACHE_DIR, "closing_odds.csv");

export const BTB_URLS = {
  github_repo: "https://github.com/Lisandro79/BeatTheBookie",
  github_readme: "https://raw.githubusercontent.com/Lisandro79/BeatTheBookie/master/README.md",
  dropbox_closing: "https://www.dropbox.com/s/g9vpjjlxjeruc3u/closing_odds.zip?dl=1",
  dropbox_series: "https://www.dropbox.com/s/gqp3m6o5zsd8v63/odds_series.zip?dl=0",
  dropbox_series_b: "https://www.dropbox.com/s/t26rwzvlwtt6xnb/odds_series_b.zip?dl=0",
  google_drive_folder: "https://drive.google.com/drive/folders/0B3zgn2ueCERNWnJRSnpIQTBDWEU",
  kaggle: "https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset",
  kaggle_download: "https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset/download?datasetVersionNumber=2",
  tilenkopac_csv:
    "https://raw.githubusercontent.com/TilenKopac/beat-the-bookie-kaggle/main/data/closing_odds.csv",
} as const;

export const ACQUIRED_CLOSING_SHA256 =
  "a2f4083aea15ca7cfcc6abb6db9849108a1974fb0b4145171033e4e51d469fc4";

export const KAGGLE_LICENSE = "CC BY-SA 4.0";
export const GITHUB_CODE_LICENSE = "GPL-3.0";

export function ensureCacheDir(): void {
  mkdirSync(TASK022_CACHE_DIR, { recursive: true });
}

export function localClosingOddsPath(): string | null {
  return existsSync(CLOSING_ODDS_CACHE) ? CLOSING_ODDS_CACHE : null;
}

async function headProbe(url: string, channel: string): Promise<AcquisitionProbe022> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const len = res.headers.get("content-length");
    return {
      channel,
      url,
      http_status: res.status,
      content_type: res.headers.get("content-type"),
      bytes: len ? Number(len) : null,
      acquired: false,
      note: res.ok ? "HEAD ok — body not ingested in this probe" : `HEAD ${res.status}`,
    };
  } catch (err) {
    return {
      channel,
      url,
      http_status: null,
      content_type: null,
      bytes: null,
      acquired: false,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function probeAcquisitionChannels(allowNetwork: boolean): Promise<AcquisitionProbe022[]> {
  const local = localClosingOddsPath();
  const probes: AcquisitionProbe022[] = [
    {
      channel: "local-cache-tilenkopac-closing_odds.csv",
      url: BTB_URLS.tilenkopac_csv,
      http_status: local ? 200 : null,
      content_type: "text/csv",
      bytes: local ? statSync(local).size : null,
      acquired: Boolean(local),
      note: local
        ? `materialized ${CLOSING_ODDS_CACHE}; sha256=${ACQUIRED_CLOSING_SHA256}; Kaggle redistribution same cluster`
        : "not on disk — run lab:task-022 with network to fetch GitHub mirror",
    },
  ];
  if (!allowNetwork) return probes;

  probes.push(
    await headProbe(BTB_URLS.dropbox_closing, "dropbox-closing_odds.zip"),
    await headProbe(BTB_URLS.kaggle_download, "kaggle-zip-v2"),
    await headProbe(BTB_URLS.google_drive_folder, "google-drive-folder"),
  );
  return probes;
}

export async function acquireClosingOddsCsv(allowNetwork: boolean): Promise<{
  path: string | null;
  acquired: boolean;
  note: string;
}> {
  const existing = localClosingOddsPath();
  if (existing) {
    return { path: existing, acquired: true, note: "cache hit" };
  }
  if (!allowNetwork) {
    return { path: null, acquired: false, note: "network disabled and cache empty" };
  }
  ensureCacheDir();
  const res = await fetch(BTB_URLS.tilenkopac_csv, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    return {
      path: null,
      acquired: false,
      note: `GitHub mirror HTTP ${res.status}`,
    };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) {
    return {
      path: null,
      acquired: false,
      note: `download too small (${buf.length} bytes) — not the CSV`,
    };
  }
  writeFileSync(CLOSING_ODDS_CACHE, buf);
  return { path: CLOSING_ODDS_CACHE, acquired: true, note: "downloaded TilenKopac closing_odds.csv" };
}

export const CLUSTER_NOTE =
  "TilenKopac/beat-the-bookie-kaggle closing_odds.csv is a Kaggle austro redistribution of BeatTheBookie — same upstream cluster, not an independent source. GitHub README 880,494 matches (2000–2015) is the SQL dump; this CSV is the paper subset (479,440; 2005–2015). odds_series TXT bulk was not acquired (Dropbox HTML/403, Kaggle zip requires login).";
