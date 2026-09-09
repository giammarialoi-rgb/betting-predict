/**
 * ClubElo public CSV acquisition — http://api.clubelo.com/YYYY-MM-DD
 * Free documented API. No scraping of HTML.
 */

import { createHash } from "node:crypto";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { waitForProviderSlot, getMinIntervalMs } from "@/ingest/rate-limit";
import { classifyEloProvenance } from "@/domain/features/elo";
import type { ClubEloObservation } from "@/domain/features/clubelo-asof";

export const CLUBELO_SOURCE_ID = "clubelo";

export type ClubEloFetchResult = {
  sourceId: typeof CLUBELO_SOURCE_ID;
  url: string;
  http_status: number;
  provider_status: "OK" | "BLOCKED" | "INVALID" | "UNKNOWN";
  reason: string | null;
  content_hash: string | null;
  bytes: number;
  rating_date: string;
  observations: ClubEloObservation[];
  rawText: string | null;
};

export type ClubEloFetchDeps = {
  fetch?: typeof fetch;
  /** Inject CSV for offline/tests. */
  csvText?: string;
};

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function looksLikeClubEloCsv(text: string): boolean {
  const head = text.slice(0, 200).toLowerCase();
  return head.includes("rank") && head.includes("club") && head.includes("elo");
}

/**
 * Fetch one day's ranking. rating From/To used for available_at.
 */
export async function fetchClubEloDay(
  ratingDateIso: string,
  deps: ClubEloFetchDeps = {},
): Promise<ClubEloFetchResult> {
  const url = `http://api.clubelo.com/${ratingDateIso}`;
  await waitForProviderSlot(
    CLUBELO_SOURCE_ID,
    getMinIntervalMs(process.env.CLUBELO_MIN_INTERVAL_MS, 500),
  );

  let status = 200;
  let text: string;

  if (deps.csvText != null) {
    text = deps.csvText;
  } else {
    const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
    try {
      const res = await fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "text/csv,text/plain,*/*",
          "User-Agent": "sports-prediction-engine-research/0.1",
        },
      });
      status = res.status;
      text = await res.text();
    } catch {
      return {
        sourceId: CLUBELO_SOURCE_ID,
        url,
        http_status: 0,
        provider_status: "UNKNOWN",
        reason: "NETWORK_ERROR",
        content_hash: null,
        bytes: 0,
        rating_date: ratingDateIso,
        observations: [],
        rawText: null,
      };
    }
  }

  if (status === 503 || status === 502 || status === 403 || status === 429) {
    return {
      sourceId: CLUBELO_SOURCE_ID,
      url,
      http_status: status,
      provider_status: "BLOCKED",
      reason: `HTTP_${status}`,
      content_hash: null,
      bytes: text.length,
      rating_date: ratingDateIso,
      observations: [],
      rawText: null,
    };
  }
  if (status !== 200 || !looksLikeClubEloCsv(text)) {
    return {
      sourceId: CLUBELO_SOURCE_ID,
      url,
      http_status: status,
      provider_status: status === 200 ? "INVALID" : "BLOCKED",
      reason: status === 200 ? "INVALID_CSV" : `HTTP_${status}`,
      content_hash: hashText(text),
      bytes: text.length,
      rating_date: ratingDateIso,
      observations: [],
      rawText: null,
    };
  }

  const table = parseCsv(text);
  const ratingDate = new Date(`${ratingDateIso}T00:00:00.000Z`);
  const observations: ClubEloObservation[] = [];
  for (const row of table.rows) {
    const club = row.Club ?? row.club;
    const elo = Number(row.Elo ?? row.elo);
    if (!club || !Number.isFinite(elo)) continue;
    const from = row.From ? new Date(`${row.From}T00:00:00.000Z`) : ratingDate;
    observations.push({
      teamId: club.toLowerCase().replace(/\s+/g, ""),
      rating: elo,
      ratingDate: from,
      availableAt: from,
      provenance: classifyEloProvenance(ratingDateIso),
    });
  }

  return {
    sourceId: CLUBELO_SOURCE_ID,
    url,
    http_status: status,
    provider_status: "OK",
    reason: null,
    content_hash: hashText(text),
    bytes: Buffer.byteLength(text, "utf8"),
    rating_date: ratingDateIso,
    observations,
    rawText: text,
  };
}

/** Minimal fixture for offline tests (documented ClubElo CSV shape). */
export const CLUBELO_FIXTURE_CSV = `Rank,Club,Country,Level,Elo,From,To
1,Liverpool,ENG,1,2040.0,2019-08-01,2019-08-10
2,Man City,ENG,1,2010.0,2019-08-01,2019-08-10
3,Chelsea,ENG,1,1900.0,2019-08-01,2019-08-10
4,Arsenal,ENG,1,1850.0,2019-08-01,2019-08-10
5,Tottenham,ENG,1,1820.0,2019-08-01,2019-08-10
`;
