import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PI_DIVISIONS, PI_SEASONS, piDatasetsRoot, sha256Hex } from "@/domain/eval/predictive-intelligence/config";

const APEX = "https://football-data.co.uk/mmz4281";
const WWW = "https://www.football-data.co.uk/mmz4281";

export type PiDownloadAttempt = {
  url: string;
  ok: boolean;
  status: number | null;
  bytes: number;
  error: string | null;
};

export type PiDownloadResult = {
  league: string;
  season: string;
  ok: boolean;
  rawPath: string | null;
  sha256: string | null;
  attempts: PiDownloadAttempt[];
  from_cache: boolean;
};

function looksLikeCsv(text: string): boolean {
  const head = text.slice(0, 200).toLowerCase();
  if (head.includes("<html") || head.includes("503") || head.includes("service temporarily")) {
    return false;
  }
  return head.includes("div") || head.includes("date") || head.includes("hometeam");
}

async function tryFetch(url: string, fetchImpl: typeof fetch): Promise<PiDownloadAttempt & { text?: string }> {
  try {
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BettingPredictResearch/1.0)",
        Accept: "text/csv,text/plain,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    const ok = res.ok && looksLikeCsv(text) && text.length > 500;
    return {
      url,
      ok,
      status: res.status,
      bytes: text.length,
      error: ok ? null : `HTTP ${res.status} or non-CSV body`,
      text: ok ? text : undefined,
    };
  } catch (e) {
    return {
      url,
      ok: false,
      status: null,
      bytes: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Non-aggressive download: apex host first (known 200), then www. Idempotent via cache. */
export async function downloadFootballDataCsv(input: {
  league: string;
  season: string;
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  force?: boolean;
}): Promise<PiDownloadResult> {
  const root = join(piDatasetsRoot(input.labBRoot), "raw");
  mkdirSync(root, { recursive: true });
  const rawPath = join(root, `${input.league}-${input.season}.csv`);
  const attempts: PiDownloadAttempt[] = [];

  if (!input.force && existsSync(rawPath)) {
    const buf = readFileSync(rawPath);
    if (buf.length > 500 && looksLikeCsv(buf.toString("utf8"))) {
      return {
        league: input.league,
        season: input.season,
        ok: true,
        rawPath,
        sha256: sha256Hex(buf),
        attempts: [{ url: "cache", ok: true, status: 200, bytes: buf.length, error: null }],
        from_cache: true,
      };
    }
  }

  // Also accept pre-verified sample under data-foundation
  const foundation = join(
    process.cwd(),
    "audit",
    "external",
    "task-044",
    "data-foundation",
    "football-data",
    `${input.league}-${input.season}.csv`,
  );
  if (!input.force && existsSync(foundation)) {
    const buf = readFileSync(foundation);
    writeFileSync(rawPath, buf);
    return {
      league: input.league,
      season: input.season,
      ok: true,
      rawPath,
      sha256: sha256Hex(buf),
      attempts: [{ url: foundation, ok: true, status: 200, bytes: buf.length, error: null }],
      from_cache: true,
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const urls = [
    `${APEX}/${input.season}/${input.league}.csv`,
    `${WWW}/${input.season}/${input.league}.csv`,
  ];

  for (const url of urls) {
    const r = await tryFetch(url, fetchImpl);
    attempts.push({
      url: r.url,
      ok: r.ok,
      status: r.status,
      bytes: r.bytes,
      error: r.error,
    });
    if (r.ok && r.text) {
      writeFileSync(rawPath, r.text, "utf8");
      // polite pause between remote hits
      await new Promise((res) => setTimeout(res, 400));
      return {
        league: input.league,
        season: input.season,
        ok: true,
        rawPath,
        sha256: sha256Hex(r.text),
        attempts,
        from_cache: false,
      };
    }
    await new Promise((res) => setTimeout(res, 400));
  }

  return {
    league: input.league,
    season: input.season,
    ok: false,
    rawPath: null,
    sha256: null,
    attempts,
    from_cache: false,
  };
}

export async function downloadAllPiDatasets(input?: {
  labBRoot?: string;
  fetchImpl?: typeof fetch;
  force?: boolean;
}): Promise<PiDownloadResult[]> {
  const out: PiDownloadResult[] = [];
  for (const season of PI_SEASONS) {
    for (const league of PI_DIVISIONS) {
      out.push(
        await downloadFootballDataCsv({
          league,
          season,
          labBRoot: input?.labBRoot,
          fetchImpl: input?.fetchImpl,
          force: input?.force,
        }),
      );
    }
  }
  return out;
}
