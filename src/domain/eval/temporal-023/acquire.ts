/**
 * Probe Betfair Historic without credentials or purchase.
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AcquisitionProbe023 } from "@/domain/eval/temporal-023/types";

export const TASK023_CACHE_DIR = join(process.cwd(), "audit", "external", "task-023");
export const FOOTBALL_JSON_CACHE = join(TASK023_CACHE_DIR, "football-basic-sample.json");
export const FOOTBALL_BZ2_CACHE = join(TASK023_CACHE_DIR, "football-basic-sample.bz2");
export const TENNIS_JSON_CACHE = join(TASK023_CACHE_DIR, "1.187528277.bz2.json");

export const URLS_023 = {
  portal: "https://historicdata.betfair.com/",
  pdf: "https://historicdata.betfair.com/Betfair-Historical-Data-Feed-Specification.pdf",
  api: "https://historicdata.betfair.com/api/",
  github_tooling: "https://github.com/petermclagan/betfair-historical",
  github_sample_bz2:
    "https://raw.githubusercontent.com/petermclagan/betfair-historical/master/tests/sample_data/football-basic-sample.bz2",
  hub: "https://betfair-datascientists.github.io/data/usingHistoricDataSite/",
  pricing:
    "https://support.developer.betfair.com/hc/en-us/articles/360019984158-Are-bulk-purchase-discounts-available",
} as const;

async function getProbe(input: {
  channel: string;
  url: string;
  source_class: AcquisitionProbe023["source_class"];
  method?: "GET" | "HEAD";
}): Promise<AcquisitionProbe023> {
  try {
    const res = await fetch(input.url, {
      method: input.method ?? "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "betting-predict-task-023-probe" },
    });
    const buf = input.method === "HEAD" ? null : Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type");
    const snippet = buf ? buf.subarray(0, 180).toString("utf8").replace(/\s+/g, " ") : "";
    return {
      channel: input.channel,
      url: input.url,
      http_status: res.status,
      content_type: ct,
      bytes: buf?.length ?? (res.headers.get("content-length") ? Number(res.headers.get("content-length")) : null),
      acquired: false,
      source_class: input.source_class,
      note: `${res.status} ${ct ?? ""} ${snippet.slice(0, 120)}`.trim(),
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

function localProbe(
  channel: string,
  path: string,
  url: string,
  source_class: AcquisitionProbe023["source_class"],
  note: string,
): AcquisitionProbe023 {
  const ok = existsSync(path);
  return {
    channel,
    url,
    http_status: ok ? 200 : null,
    content_type: path.endsWith(".json") || path.endsWith(".ndjson") ? "application/x-ndjson" : "application/octet-stream",
    bytes: ok ? statSync(path).size : null,
    acquired: ok,
    source_class,
    note: ok ? note : "not on disk",
  };
}

export async function probeTask023(allowNetwork: boolean): Promise<AcquisitionProbe023[]> {
  const probes: AcquisitionProbe023[] = [
    localProbe(
      "local-cache-football-basic-json",
      FOOTBALL_JSON_CACHE,
      URLS_023.github_sample_bz2,
      "MIRROR",
      "petermclagan tests/sample_data football BASIC decompressed; not official licensed bulk",
    ),
    localProbe(
      "local-cache-football-basic-bz2",
      FOOTBALL_BZ2_CACHE,
      URLS_023.github_sample_bz2,
      "MIRROR",
      "original bz2 sample from GitHub tooling tests",
    ),
    localProbe(
      "local-cache-tennis-basic-json",
      TENNIS_JSON_CACHE,
      "https://github.com/kito129/betfairHitoricalRawDataConversion",
      "MIRROR",
      "tennis MATCH_ODDS BASIC format confirmation — not EPL soccer",
    ),
  ];
  if (!allowNetwork) return probes;
  probes.push(
    await getProbe({ channel: "official-portal", url: URLS_023.portal, source_class: "OFFICIAL" }),
    await getProbe({ channel: "official-pdf-spec", url: URLS_023.pdf, source_class: "OFFICIAL" }),
    await getProbe({
      channel: "official-api-unauthenticated",
      url: URLS_023.api,
      source_class: "OFFICIAL",
    }),
    await getProbe({
      channel: "github-football-basic-bz2",
      url: URLS_023.github_sample_bz2,
      source_class: "MIRROR",
      method: "HEAD",
    }),
    await getProbe({ channel: "betfair-automation-hub", url: URLS_023.hub, source_class: "OFFICIAL" }),
    await getProbe({ channel: "official-pricing-table", url: URLS_023.pricing, source_class: "OFFICIAL" }),
  );
  return probes;
}

export function officialBulkBlocked(probes: readonly AcquisitionProbe023[]): boolean {
  const portal = probes.find((p) => p.channel === "official-portal");
  const api = probes.find((p) => p.channel === "official-api-unauthenticated");
  const noCreds = true;
  if (!portal && !api) return true;
  const htmlError =
    portal?.content_type?.includes("text/html") === true ||
    (portal?.note ?? "").toLowerCase().includes("something went wrong") ||
    (portal?.note ?? "").toLowerCase().includes("login");
  const apiDenied = api != null && api.http_status != null && api.http_status >= 400;
  return noCreds && (htmlError || apiDenied || portal?.acquired === false);
}
