import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GithubAudit025 } from "@/domain/eval/turnaround-025/types";

export const GITHUB_REPOS_025 = [
  {
    repo: "betfair/historic-data-workbook",
    url: "https://github.com/betfair/historic-data-workbook",
    licenseUrl: "https://raw.githubusercontent.com/betfair/historic-data-workbook/master/LICENSE",
    noteStatic:
      "Official workbook (xlsm/docx). No market JSON/BZ2. License unspecified on GitHub. BASIC download still requires a Betfair account.",
    hasRawDataStatic: false,
    provenance: "OFFICIAL_DOCS",
    redistributionOk: false,
  },
  {
    repo: "petermclagan/betfair-historical",
    url: "https://github.com/petermclagan/betfair-historical",
    licenseUrl: "https://raw.githubusercontent.com/petermclagan/betfair-historical/master/LICENSE",
    noteStatic:
      "Parser/downloader plus football-basic-sample.bz2. MIRROR of historicdata.betfair.com — not an independent bookmaker. Redistribution of the sample is not a license to republish the full historic archive.",
    hasRawDataStatic: true,
    provenance: "MIRROR",
    redistributionOk: null,
  },
  {
    repo: "mzaja/betfair-database",
    url: "https://github.com/mzaja/betfair-database",
    licenseUrl: "https://raw.githubusercontent.com/mzaja/betfair-database/master/LICENSE",
    noteStatic: "MIT indexer. No soccer dump in the repo. Needs local Betfair files the user already owns.",
    hasRawDataStatic: false,
    provenance: "TOOLING",
    redistributionOk: true,
  },
  {
    repo: "AnishKhetani/premier-league-data",
    url: "https://github.com/AnishKhetani/premier-league-data",
    licenseUrl: "https://raw.githubusercontent.com/AnishKhetani/premier-league-data/main/LICENSE",
    noteStatic: "EPL 1993–present odds. football-data.co.uk cluster — not an independent bookmaker source.",
    hasRawDataStatic: true,
    provenance: "FD_CLUSTER",
    redistributionOk: null,
  },
  {
    repo: "Lisandro79/BeatTheBookie",
    url: "https://github.com/Lisandro79/BeatTheBookie",
    licenseUrl: "https://raw.githubusercontent.com/Lisandro79/BeatTheBookie/master/LICENSE",
    noteStatic: "Generator + MATLAB. Bulk odds_series on Dropbox/Drive, not in git. DATE_ONLY / relative bins.",
    hasRawDataStatic: false,
    provenance: "RESEARCH_CODE",
    redistributionOk: null,
  },
] as const;

function localClubFootball(): GithubAudit025 | null {
  const root = join(process.cwd(), "audit", "external", "Club-Football-Match-Data");
  if (!existsSync(join(root, "data", "Matches.csv"))) return null;
  let license: string | null = null;
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) {
    const p = join(root, name);
    if (existsSync(p)) {
      license = readFileSync(p, "utf8").slice(0, 200).replace(/\s+/g, " ");
      break;
    }
  }
  return {
    repo: "xgabora/Club-Football-Match-Data (local clone)",
    license,
    hasRawData: true,
    provenance: "LOCAL_CLONE RESEARCH_ONLY DATE_ONLY odds",
    redistributionOk: null,
    note: "Inspected Matches.csv on disk. Odd* are not STRICT quote clocks. Form*/C_*/Max* forbidden in STRICT.",
  };
}

export function githubAuditsOffline(): GithubAudit025[] {
  const rows: GithubAudit025[] = GITHUB_REPOS_025.map((r) => ({
    repo: r.repo,
    license: null,
    hasRawData: r.hasRawDataStatic,
    provenance: r.provenance,
    redistributionOk: r.redistributionOk,
    note: r.noteStatic,
  }));
  const club = localClubFootball();
  if (club) rows.push(club);
  return rows;
}

export async function githubAuditsOnline(): Promise<GithubAudit025[]> {
  const rows: GithubAudit025[] = [];
  for (const r of GITHUB_REPOS_025) {
    try {
      const res = await fetch(r.licenseUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "betting-predict-task-025" },
      });
      const text = res.ok ? (await res.text()).slice(0, 240).replace(/\s+/g, " ") : null;
      rows.push({
        repo: r.repo,
        license: text ?? `HTTP ${res.status}`,
        hasRawData: r.hasRawDataStatic,
        provenance: r.provenance,
        redistributionOk: r.redistributionOk,
        note: `${r.noteStatic} LICENSE fetch ${res.status}.`,
      });
    } catch (err) {
      rows.push({
        repo: r.repo,
        license: null,
        hasRawData: r.hasRawDataStatic,
        provenance: r.provenance,
        redistributionOk: r.redistributionOk,
        note: `${r.noteStatic} LICENSE fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  const club = localClubFootball();
  if (club) rows.push(club);
  return rows;
}
