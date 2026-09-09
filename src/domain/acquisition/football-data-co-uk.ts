/**
 * Multi-division football-data.co.uk acquisition planner + fetcher.
 * discover → HTTP → validate → hash → (caller persists) → parse readiness.
 * HTTP 503 → BLOCKED. No bypass.
 */

import { createHash } from "node:crypto";
import {
  FOOTBALL_DATA_CO_UK_SOURCE_ID,
  footballDataCoUkCsvUrl,
  type FootballDataCoUkDivisionCode,
} from "@/providers/football-data-co-uk/bookmakers";
import {
  FOOTBALL_DATA_CO_UK_TARGET_DIVISIONS,
  recordProviderBlocked,
  type ProviderLiveStatus,
} from "@/domain/sources/provider-status";
import { waitForProviderSlot, getMinIntervalMs } from "@/ingest/rate-limit";

export type AcquisitionTarget = {
  division: string;
  seasonCode: string;
  url: string;
};

export type AcquisitionFileResult = {
  division: string;
  seasonCode: string;
  url: string;
  http_status: number;
  content_type: string | null;
  bytes: number;
  content_hash: string | null;
  provider_status: "OK" | "BLOCKED" | "NOT_FOUND" | "INVALID" | "UNKNOWN";
  reason: string | null;
  csvText: string | null;
};

const DEFAULT_SEASONS = [
  "1920",
  "2021",
  "2122",
  "2223",
  "2324",
  "2425",
] as const;

/**
 * Expand catalogued divisions × seasons. Does not claim files exist.
 */
export function discoverAcquisitionTargets(input?: {
  divisions?: readonly string[];
  seasonCodes?: readonly string[];
}): AcquisitionTarget[] {
  const divisions = input?.divisions ?? FOOTBALL_DATA_CO_UK_TARGET_DIVISIONS;
  const seasons = input?.seasonCodes ?? DEFAULT_SEASONS;
  const out: AcquisitionTarget[] = [];
  for (const seasonCode of seasons) {
    for (const division of divisions) {
      out.push({
        division,
        seasonCode,
        url: footballDataCoUkCsvUrl(
          seasonCode,
          division as FootballDataCoUkDivisionCode,
        ),
      });
    }
  }
  return out;
}

export function hashCsvContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function looksLikeFootballCsv(text: string): boolean {
  const head = text.slice(0, 500).toLowerCase();
  return (
    head.includes("div") &&
    (head.includes("hometeam") || head.includes("home")) &&
    (head.includes("fthg") || head.includes("ftr") || head.includes("date"))
  );
}

export type FetchAcquisitionDeps = {
  fetch?: typeof fetch;
  minIntervalMs?: number;
  /** Inject responses by URL for offline tests. */
  responsesByUrl?: ReadonlyMap<
    string,
    { status: number; text: string; contentType?: string }
  >;
};

/**
 * Single-file fetch with validation. Never scrapes alternatives on 503.
 */
export async function fetchAcquisitionFile(
  target: AcquisitionTarget,
  deps: FetchAcquisitionDeps = {},
): Promise<AcquisitionFileResult> {
  await waitForProviderSlot(
    FOOTBALL_DATA_CO_UK_SOURCE_ID,
    deps.minIntervalMs ??
      getMinIntervalMs(process.env.FOOTBALL_DATA_CO_UK_MIN_INTERVAL_MS, 800),
  );

  const injected = deps.responsesByUrl?.get(target.url);
  let status: number;
  let text: string;
  let contentType: string | null = null;

  if (injected) {
    status = injected.status;
    text = injected.text;
    contentType = injected.contentType ?? "text/csv";
  } else {
    const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
    try {
      const response = await fetchImpl(target.url, {
        method: "GET",
        headers: {
          Accept: "text/csv,text/plain,*/*",
          "User-Agent": "sports-prediction-engine-research/0.1",
        },
      });
      status = response.status;
      text = await response.text();
      contentType = response.headers.get("content-type");
    } catch {
      return {
        division: target.division,
        seasonCode: target.seasonCode,
        url: target.url,
        http_status: 0,
        content_type: null,
        bytes: 0,
        content_hash: null,
        provider_status: "UNKNOWN",
        reason: "NETWORK_ERROR",
        csvText: null,
      };
    }
  }

  if (status === 503) {
    return {
      division: target.division,
      seasonCode: target.seasonCode,
      url: target.url,
      http_status: 503,
      content_type: contentType,
      bytes: text.length,
      content_hash: null,
      provider_status: "BLOCKED",
      reason: "HTTP_503",
      csvText: null,
    };
  }
  if (status === 404) {
    return {
      division: target.division,
      seasonCode: target.seasonCode,
      url: target.url,
      http_status: 404,
      content_type: contentType,
      bytes: text.length,
      content_hash: null,
      provider_status: "NOT_FOUND",
      reason: "HTTP_404",
      csvText: null,
    };
  }
  if (status !== 200) {
    return {
      division: target.division,
      seasonCode: target.seasonCode,
      url: target.url,
      http_status: status,
      content_type: contentType,
      bytes: text.length,
      content_hash: null,
      provider_status: "BLOCKED",
      reason: `HTTP_${status}`,
      csvText: null,
    };
  }

  if (!looksLikeFootballCsv(text)) {
    return {
      division: target.division,
      seasonCode: target.seasonCode,
      url: target.url,
      http_status: status,
      content_type: contentType,
      bytes: text.length,
      content_hash: hashCsvContent(text),
      provider_status: "INVALID",
      reason: "INVALID_CSV_CONTENT",
      csvText: null,
    };
  }

  return {
    division: target.division,
    seasonCode: target.seasonCode,
    url: target.url,
    http_status: 200,
    content_type: contentType,
    bytes: Buffer.byteLength(text, "utf8"),
    content_hash: hashCsvContent(text),
    provider_status: "OK",
    reason: null,
    csvText: text,
  };
}

/**
 * Batch discover+fetch. Continues on BLOCKED/NOT_FOUND (offline path remains).
 */
export async function runAcquisitionBatch(
  targets: readonly AcquisitionTarget[],
  deps: FetchAcquisitionDeps = {},
): Promise<{
  results: AcquisitionFileResult[];
  ok: number;
  blocked: number;
  not_found: number;
  invalid: number;
  liveStatus: ProviderLiveStatus | null;
}> {
  const results: AcquisitionFileResult[] = [];
  let ok = 0;
  let blocked = 0;
  let not_found = 0;
  let invalid = 0;
  let liveStatus: ProviderLiveStatus | null = null;

  for (const t of targets) {
    const r = await fetchAcquisitionFile(t, deps);
    results.push(r);
    if (r.provider_status === "OK") ok += 1;
    else if (r.provider_status === "BLOCKED") {
      blocked += 1;
      if (r.http_status === 503) {
        liveStatus = recordProviderBlocked(
          FOOTBALL_DATA_CO_UK_SOURCE_ID,
          503,
        );
      }
    } else if (r.provider_status === "NOT_FOUND") not_found += 1;
    else if (r.provider_status === "INVALID") invalid += 1;
  }

  return { results, ok, blocked, not_found, invalid, liveStatus };
}

/** Offline archive entry — used when live is BLOCKED. */
export type OfflineArchiveEntry = {
  division: string;
  seasonCode: string;
  csvText: string;
  source: "offline_pack" | "fixture";
};

export function materializeOfflineArchive(
  entries: readonly OfflineArchiveEntry[],
): AcquisitionFileResult[] {
  return entries.map((e) => ({
    division: e.division,
    seasonCode: e.seasonCode,
    url: `offline://${e.source}/${e.seasonCode}/${e.division}.csv`,
    http_status: 200,
    content_type: "text/csv",
    bytes: Buffer.byteLength(e.csvText, "utf8"),
    content_hash: hashCsvContent(e.csvText),
    provider_status: "OK" as const,
    reason: null,
    csvText: e.csvText,
  }));
}
