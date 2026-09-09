import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { SourceClass029, SourceRow029 } from "@/domain/eval/incremental-029/types";
import { booksOverlayPath } from "@/domain/eval/incremental-029/overlay";

const CACHE = join(process.cwd(), "audit", "external", "task-029");

type Probe = {
  channel: string;
  url: string;
  http_status: number | null;
  acquired: boolean;
  snippet: string;
  license: string;
  bytes: number;
};

async function httpProbe(url: string, timeoutMs = 12_000): Promise<Omit<Probe, "channel" | "license">> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "betting-predict-task-029-probe" },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      url,
      http_status: res.status,
      acquired: res.ok && buf.length > 0,
      snippet: buf.subarray(0, 100).toString("latin1").replace(/[\u0000-\u001F]/g, " "),
      bytes: buf.length,
    };
  } catch (e) {
    return {
      url,
      http_status: null,
      acquired: false,
      snippet: e instanceof Error ? e.message : "error",
      bytes: 0,
    };
  }
}

export function clusterSources(rows: readonly SourceRow029[]): SourceRow029[] {
  const seen = new Set<string>();
  const out: SourceRow029[] = [];
  for (const r of rows) {
    if (seen.has(r.cluster)) continue;
    seen.add(r.cluster);
    out.push(r);
  }
  return out;
}

export async function acquireTask029(input: { skipHeavy: boolean }): Promise<{
  probes: Probe[];
  sources: SourceRow029[];
  overlay_sha256: string | null;
  overlay_rows: number;
  extract_ran: boolean;
}> {
  mkdirSync(CACHE, { recursive: true });
  const probes: Probe[] = [];
  const add = (channel: string, license: string, p: Omit<Probe, "channel" | "license">) => {
    probes.push({ channel, license, ...p });
  };

  let club: Omit<Probe, "channel" | "license"> = {
    url: "http://api.clubelo.com/2016-06-01",
    http_status: null,
    acquired: false,
    snippet: "skipHeavy",
    bytes: 0,
  };
  if (!input.skipHeavy) {
    club = await httpProbe("http://api.clubelo.com/2016-06-01", 10_000);
    add("clubelo-2016-06-01", "ClubElo terms", club);
    if (club.acquired && club.http_status === 200) {
      writeFileSync(join(CACHE, "clubelo-2016-06-01.csv"), club.snippet);
    }
    add(
      "open-meteo-archive-london-sample",
      "CC BY 4.0 (Open-Meteo)",
      await httpProbe(
        "https://archive-api.open-meteo.com/v1/archive?latitude=51.47&longitude=-0.45&start_date=2016-06-01&end_date=2016-06-01&hourly=temperature_2m,precipitation,wind_speed_10m",
        15_000,
      ),
    );
    add(
      "openligadb-leagues",
      "OpenLigaDB",
      await httpProbe("https://api.openligadb.de/getavailableleagues", 12_000),
    );
    add(
      "football-data-co-uk-E0-1516",
      "football-data.co.uk terms",
      await httpProbe("https://www.football-data.co.uk/mmz4281/1516/E0.csv", 12_000),
    );
    add(
      "football-charts-archive",
      "paid one-off licence €199 — not purchased",
      await httpProbe("https://www.football-charts.com/data", 12_000),
    );
    add(
      "huggingface-soccer-dataset",
      "CC BY 4.0",
      await httpProbe("https://huggingface.co/api/datasets/eatpizzanot/soccer-dataset", 12_000),
    );
    add(
      "historicdata-betfair",
      "Betfair Historic (account)",
      await httpProbe("https://historicdata.betfair.com/", 12_000),
    );
  }

  let extract_ran = false;
  const prodOverlay = join(CACHE, "books-t1h.csv");
  if (!input.skipHeavy && !existsSync(prodOverlay)) {
    const py = spawnSync("python", [join(process.cwd(), "src", "scripts", "extract-task-029-books.py")], {
      encoding: "utf8",
    });
    extract_ran = py.status === 0;
  } else if (existsSync(prodOverlay)) {
    extract_ran = true;
  }

  const overlayPath = booksOverlayPath(input.skipHeavy);
  let overlay_sha256: string | null = null;
  let overlay_rows = 0;
  if (existsSync(overlayPath)) {
    const buf = readFileSync(overlayPath);
    overlay_sha256 = createHash("sha256").update(buf).digest("hex");
    overlay_rows = Math.max(0, buf.toString("utf8").split(/\r?\n/).filter((l) => l.length > 0).length - 1);
  }

  const localZip = existsSync(join(process.cwd(), "audit", "external", "task-027", "kaggle-austro.zip"));
  const sources: SourceRow029[] = clusterSources([
    {
      source: "TASK 028 STRICT (frozen)",
      cluster: "beatthebookie-kaggle-austro",
      url: "https://www.kaggle.com/datasets/austro/beat-the-bookie-worldwide-football-dataset",
      access: localZip ? "ON_DISK" : "MISSING_ZIP",
      data: "10499 MATCH_EXACT T-1h 1X2 LEVEL B",
      timestamp: "PHP hours_before=1 DERIVED",
      kickoff: "soccer-dataset date_utc UTC",
      license: "GPL-3.0 upstream + Kaggle redistribution; dump gitignored",
      match_rate: "1.0 on frozen file",
      classification: "A_STRICT",
    },
    {
      source: "BeatTheBookie multi-book T-1h overlay",
      cluster: "dataset-029-a-t1h-books",
      url: "file://audit/external/task-029/books-t1h.csv",
      access: overlay_rows > 0 ? "EXTRACTED" : "NOT_EXTRACTED",
      data: `${overlay_rows} book-rows at hours_before=1`,
      timestamp: "same PHP bin 70 as STRICT",
      kickoff: "joined by frozen match_id",
      license: "same lineage as 028",
      match_rate: overlay_rows > 0 ? "joined on match_id" : "0",
      classification: overlay_rows > 0 ? "A_STRICT" : "REJECTED",
    },
    {
      source: "ClubElo daily ratings",
      cluster: "clubelo",
      url: "http://api.clubelo.com/2016-06-01",
      access: club.acquired ? String(club.http_status) : "TIMEOUT",
      data: "club,country,level,elo,rank,from,to",
      timestamp: "DATE_ONLY rating window",
      kickoff: "not a fixture clock",
      license: "ClubElo",
      match_rate: "not MATCH_EXACT to this corpus (no forced join)",
      classification: "B_RESEARCH",
    },
    {
      source: "Open-Meteo ERA5-derived archive",
      cluster: "open-meteo",
      url: "https://archive-api.open-meteo.com/v1/archive",
      access: probes.find((p) => p.channel.startsWith("open-meteo"))?.http_status?.toString() ?? "FAIL",
      data: "hourly weather given lat/lon",
      timestamp: "EXACT if coordinates verified",
      kickoff: "n/a",
      license: "CC BY 4.0",
      match_rate: "0 stadium MATCH_EXACT in this task",
      classification: "C_CONTEXT",
    },
    {
      source: "OpenLigaDB",
      cluster: "openligadb",
      url: "https://api.openligadb.de/getavailableleagues",
      access: probes.find((p) => p.channel === "openligadb-leagues")?.http_status?.toString() ?? "FAIL",
      data: "German league fixtures index",
      timestamp: "API match datetime",
      kickoff: "present for BL",
      license: "OpenLigaDB",
      match_rate: "not overlayed on worldwide 028 corpus",
      classification: "B_RESEARCH",
    },
    {
      source: "football-data.co.uk",
      cluster: "football-data-co-uk",
      url: "https://www.football-data.co.uk/mmz4281/1516/E0.csv",
      access: probes.find((p) => p.channel.includes("football-data"))?.http_status?.toString() ?? "FAIL",
      data: "closing / date-labelled odds",
      timestamp: "DATE_ONLY; closing C* not T-1h",
      kickoff: "date",
      license: "site terms",
      match_rate: "research cluster only",
      classification: "B_RESEARCH",
    },
    {
      source: "Football Charts archive",
      cluster: "football-charts",
      url: "https://www.football-charts.com/data",
      access: "PAYWALL",
      data: "open/close timestamps 2020-21→ 91 leagues",
      timestamp: "unix+ISO claimed",
      kickoff: "claimed",
      license: "€199 one-off — not purchased",
      match_rate: "0 (not acquired)",
      classification: "REJECTED",
    },
    {
      source: "eatpizzanot/soccer-dataset",
      cluster: "huggingface-soccer",
      url: "https://huggingface.co/datasets/eatpizzanot/soccer-dataset",
      access: "ON_DISK fixtures used in 027",
      data: "fixtures + odds.known_at",
      timestamp: "odds.known_at = kickoff (closing)",
      kickoff: "date_utc UTC SOURCE",
      license: "CC BY 4.0",
      match_rate: "kickoff overlay only",
      classification: "B_RESEARCH",
    },
    {
      source: "Betfair Historic",
      cluster: "betfair-historic",
      url: "https://historicdata.betfair.com/",
      access: "ACCOUNT",
      data: "MCM publishTime",
      timestamp: "SOURCE",
      kickoff: "marketTime",
      license: "Betfair",
      match_rate: "0",
      classification: "REJECTED",
    },
    {
      source: "public news / GDELT / lineups",
      cluster: "news-lineups",
      url: "n/a",
      access: "NOT_JOINED",
      data: "no MATCH_EXACT injury/lineup clock for 2015-16 worldwide STRICT",
      timestamp: "unknown availability",
      kickoff: "n/a",
      license: "n/a",
      match_rate: "0",
      classification: "C_CONTEXT",
    },
  ]);

  return { probes, sources, overlay_sha256, overlay_rows, extract_ran };
}

export function classifyDateOnly(precision: string): SourceClass029 {
  if (precision === "exact" || precision === "EXACT_TIMESTAMP") return "A_STRICT";
  if (precision === "DATE_ONLY" || precision === "date") return "B_RESEARCH";
  return "C_CONTEXT";
}
