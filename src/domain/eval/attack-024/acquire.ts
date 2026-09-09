/**
 * Legitimate GET/HEAD probes only. No WAF bypass, no user credentials, no paid download.
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TASK024_CACHE_DIR, SOCCER_PARQUET_FILES } from "@/domain/eval/attack-024/soccer-audit";
import { CLOSING_ODDS_CACHE } from "@/domain/eval/recovery-022/acquire";
import { matchOddsFixturePath } from "@/domain/eval/temporal-023/config";
import type { AcquisitionProbe024, IndependenceClass024 } from "@/domain/eval/attack-024/types";

export const URLS_024 = {
  btb_repo: "https://github.com/Lisandro79/BeatTheBookie",
  btb_readme: "https://raw.githubusercontent.com/Lisandro79/BeatTheBookie/master/README.md",
  btb_php: "https://raw.githubusercontent.com/Lisandro79/BeatTheBookie/master/src/generate_odds_series_csv.php",
  btb_figure2b: "https://raw.githubusercontent.com/Lisandro79/BeatTheBookie/master/src/Figure2B.m",
  dropbox_series: "https://www.dropbox.com/s/gqp3m6o5zsd8v63/odds_series.zip?dl=1",
  dropbox_series_b: "https://www.dropbox.com/s/t26rwzvlwtt6xnb/odds_series_b.zip?dl=1",
  drive_folder: "https://drive.google.com/drive/folders/0B3zgn2ueCERNWnJRSnpIQTBDWEU",
  tilenkopac_data: "https://api.github.com/repos/TilenKopac/beat-the-bookie-kaggle/contents/data",
  soccer_hf: "https://huggingface.co/datasets/eatpizzanot/soccer-dataset",
  soccer_odds:
    "https://huggingface.co/datasets/eatpizzanot/soccer-dataset/resolve/main/odds.parquet",
  soccer_dict:
    "https://huggingface.co/datasets/eatpizzanot/soccer-dataset/raw/main/data_dictionary.md",
  betfair_portal: "https://historicdata.betfair.com/",
  petermclagan: "https://github.com/petermclagan/betfair-historical",
  zenodo: "https://zenodo.org/api/records/12673394",
} as const;

const HF_RESOLVE =
  "https://huggingface.co/datasets/eatpizzanot/soccer-dataset/resolve/main/";

function local(
  channel: string,
  path: string,
  url: string,
  source_class: IndependenceClass024,
  note: string,
): AcquisitionProbe024 {
  const ok = existsSync(path);
  return {
    channel,
    url,
    http_status: ok ? 200 : null,
    content_type: null,
    bytes: ok ? statSync(path).size : null,
    acquired: ok,
    source_class,
    note: ok ? note : `not on disk: ${path}`,
  };
}

async function probe(input: {
  channel: string;
  url: string;
  source_class: IndependenceClass024;
  method?: "GET" | "HEAD";
  maxBytes?: number;
}): Promise<AcquisitionProbe024> {
  try {
    const res = await fetch(input.url, {
      method: input.method ?? "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent": "betting-predict-task-024-probe",
        ...(input.maxBytes != null ? { Range: `bytes=0-${input.maxBytes}` } : {}),
      },
    });
    const buf = input.method === "HEAD" ? null : Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type");
    const snippet = buf ? buf.subarray(0, 160).toString("utf8").replace(/\s+/g, " ") : "";
    const looksZip = buf != null && buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
    const looksHtml = /<html|<!DOCTYPE/i.test(snippet);
    return {
      channel: input.channel,
      url: input.url,
      http_status: res.status,
      content_type: ct,
      bytes: buf?.length ?? (res.headers.get("content-length") ? Number(res.headers.get("content-length")) : null),
      acquired: false,
      source_class: input.source_class,
      note: `${res.status} zip=${looksZip} html=${looksHtml} ${(ct ?? "")} ${snippet.slice(0, 100)}`.trim(),
    };
  } catch (err) {
    return {
      channel: input.channel,
      url: input.url,
      http_status: null,
      content_type: null,
      bytes: null,
      acquired: false,
      source_class: input.source_class,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function probeTask024(allowNetwork: boolean): Promise<AcquisitionProbe024[]> {
  const probes: AcquisitionProbe024[] = [
    local(
      "betfair-mcm-fixture",
      matchOddsFixturePath(),
      "https://github.com/petermclagan/betfair-historical",
      "MIRROR",
      "TASK 023 committed MATCH_ODDS ndjson (1 EPL event)",
    ),
    local(
      "btb-closing-odds-csv",
      CLOSING_ODDS_CACHE,
      "https://raw.githubusercontent.com/TilenKopac/beat-the-bookie-kaggle/main/data/closing_odds.csv",
      "REDISTRIBUTION",
      "TASK 022 cache closing_odds.csv (DATE_ONLY)",
    ),
    ...SOCCER_PARQUET_FILES.map((file) =>
      local(
        `soccer-${file}`,
        join(TASK024_CACHE_DIR, file),
        `${HF_RESOLVE}${file}`,
        "DERIVED",
        "Hugging Face parquet cache",
      ),
    ),
  ];
  if (!allowNetwork) return probes;

  probes.push(
    await probe({
      channel: "btb-readme",
      url: URLS_024.btb_readme,
      source_class: "OFFICIAL",
    }),
    await probe({
      channel: "btb-generate_odds_series_csv.php",
      url: URLS_024.btb_php,
      source_class: "OFFICIAL",
    }),
    await probe({
      channel: "btb-Figure2B.m",
      url: URLS_024.btb_figure2b,
      source_class: "OFFICIAL",
    }),
    await probe({
      channel: "dropbox-odds_series.zip",
      url: URLS_024.dropbox_series,
      source_class: "OFFICIAL",
      maxBytes: 512,
    }),
    await probe({
      channel: "dropbox-odds_series_b.zip",
      url: URLS_024.dropbox_series_b,
      source_class: "OFFICIAL",
      maxBytes: 512,
    }),
    await probe({
      channel: "google-drive-btb-folder",
      url: URLS_024.drive_folder,
      source_class: "OFFICIAL",
      method: "HEAD",
    }),
    await probe({
      channel: "tilenkopac-data-listing",
      url: URLS_024.tilenkopac_data,
      source_class: "MIRROR",
    }),
    await probe({
      channel: "hf-soccer-odds.parquet",
      url: URLS_024.soccer_odds,
      source_class: "DERIVED",
      method: "HEAD",
    }),
    await probe({
      channel: "hf-soccer-dictionary",
      url: URLS_024.soccer_dict,
      source_class: "DERIVED",
    }),
    await probe({
      channel: "betfair-historic-portal",
      url: URLS_024.betfair_portal,
      source_class: "OFFICIAL",
    }),
    await probe({
      channel: "zenodo-12673394",
      url: URLS_024.zenodo,
      source_class: "REDISTRIBUTION",
    }),
  );
  return probes;
}

export async function acquireSoccerParquetIfMissing(allowNetwork: boolean): Promise<{
  downloaded: string[];
  skipped: string[];
  failed: { file: string; note: string }[];
}> {
  const downloaded: string[] = [];
  const skipped: string[] = [];
  const failed: { file: string; note: string }[] = [];
  mkdirSync(TASK024_CACHE_DIR, { recursive: true });
  for (const file of SOCCER_PARQUET_FILES) {
    const path = join(TASK024_CACHE_DIR, file);
    if (existsSync(path) && statSync(path).size > 1000) {
      skipped.push(file);
      continue;
    }
    if (!allowNetwork) {
      failed.push({ file, note: "network disabled and cache empty" });
      continue;
    }
    try {
      const res = await fetch(`${HF_RESOLVE}${file}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(180_000),
        headers: { "User-Agent": "betting-predict-task-024-acquire" },
      });
      if (!res.ok) {
        failed.push({ file, note: `HTTP ${res.status}` });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000 || buf.subarray(0, 15).toString("utf8").includes("<!")) {
        failed.push({ file, note: `not parquet (${buf.length} bytes)` });
        continue;
      }
      writeFileSync(path, buf);
      downloaded.push(file);
    } catch (err) {
      failed.push({ file, note: err instanceof Error ? err.message : String(err) });
    }
  }
  return { downloaded, skipped, failed };
}

export function seriesBulkAcquired(): boolean {
  return (
    existsSync(join(TASK024_CACHE_DIR, "odds_series.zip")) ||
    existsSync(join(process.cwd(), "audit", "external", "task-022", "odds_series"))
  );
}
