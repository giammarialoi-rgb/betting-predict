import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { CLUB_FOOTBALL_MATCHES_CSV } from "@/audit/club-football-match-data/paths";
import { parseMatchDate } from "@/audit/club-football-match-data/classifiers";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import { loadClubMatchesLite } from "@/domain/eval/actuarial-018/load-matches";
import { gradeTwoEvents, strictMatchAllowed } from "@/domain/eval/turnaround-025/matching";
import type { MatchGrade025 } from "@/domain/eval/turnaround-025/types";

export const M001_IDENTITY = {
  event: "M001",
  date: "2017-04-30",
  home: "Middlesbrough",
  away: "Man City",
  awayLong: "Manchester City",
  competition: "EPL",
  clubDivision: "E0",
} as const;

function parseNum(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function loadClubForResearch(maxEvents: number | null): Promise<{
  present: boolean;
  matches: ClubMatchLite[];
  rows_read: number;
}> {
  if (!existsSync(CLUB_FOOTBALL_MATCHES_CSV)) {
    return { present: false, matches: [], rows_read: 0 };
  }
  if (maxEvents === 0) return { present: true, matches: [], rows_read: 0 };
  const loaded = await loadClubMatchesLite();
  const matches = maxEvents == null ? loaded.matches : loaded.matches.slice(0, maxEvents);
  return { present: loaded.present, matches, rows_read: loaded.rows_read };
}

export async function scanClubOverlayM001(): Promise<{
  present: boolean;
  grade: MatchGrade025;
  match: ClubMatchLite | null;
}> {
  const path = CLUB_FOOTBALL_MATCHES_CSV;
  if (!existsSync(path)) {
    return { present: false, grade: "MATCH_FAILED", match: null };
  }
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  const idx: Record<string, number> = {};
  for await (const line of rl) {
    if (!header) {
      header = line.split(",");
      header.forEach((h, i) => {
        idx[h.trim()] = i;
      });
      continue;
    }
    const cols = line.split(",");
    const dateStr = cols[idx.MatchDate] ?? "";
    const d = parseMatchDate(dateStr);
    if (!d) continue;
    const day = d.toISOString().slice(0, 10);
    if (day !== M001_IDENTITY.date) continue;
    const home = (cols[idx.HomeTeam] ?? "").trim();
    const away = (cols[idx.AwayTeam] ?? "").trim();
    const division = (cols[idx.Division] ?? "").trim();
    const grade = gradeTwoEvents({
      dateA: M001_IDENTITY.date,
      dateB: day,
      homeA: M001_IDENTITY.home,
      homeB: home,
      awayA: M001_IDENTITY.away,
      awayB: away,
      competitionA: M001_IDENTITY.competition,
      competitionB: division,
    });
    if (!strictMatchAllowed(grade) && away.toLowerCase().includes("city")) {
      const retry = gradeTwoEvents({
        dateA: M001_IDENTITY.date,
        dateB: day,
        homeA: M001_IDENTITY.home,
        homeB: home,
        awayA: M001_IDENTITY.awayLong,
        awayB: away,
        competitionA: M001_IDENTITY.competition,
        competitionB: division,
      });
      if (strictMatchAllowed(retry) || retry === "MATCH_HIGH_CONFIDENCE") {
        const ftH = parseNum(cols[idx.FTHome]);
        const ftA = parseNum(cols[idx.FTAway]);
        rl.close();
        return {
          present: true,
          grade: retry,
          match: {
            eventId: `cfm|${division}|${day}|${home}|${away}`,
            division,
            matchDate: d,
            year: d.getUTCFullYear(),
            home,
            away,
            ftHome: ftH,
            ftAway: ftA,
            result: ftH != null && ftA != null ? (ftH > ftA ? "HOME" : ftH < ftA ? "AWAY" : "DRAW") : null,
            oddHome: parseNum(cols[idx.OddHome]),
            oddDraw: parseNum(cols[idx.OddDraw]),
            oddAway: parseNum(cols[idx.OddAway]),
            homeElo: parseNum(cols[idx.HomeElo]),
            awayElo: parseNum(cols[idx.AwayElo]),
          },
        };
      }
    }
    if (strictMatchAllowed(grade) || grade === "MATCH_HIGH_CONFIDENCE") {
      const ftH = parseNum(cols[idx.FTHome]);
      const ftA = parseNum(cols[idx.FTAway]);
      rl.close();
      return {
        present: true,
        grade,
        match: {
          eventId: `cfm|${division}|${day}|${home}|${away}`,
          division,
          matchDate: d,
          year: d.getUTCFullYear(),
          home,
          away,
          ftHome: ftH,
          ftAway: ftA,
          result: ftH != null && ftA != null ? (ftH > ftA ? "HOME" : ftH < ftA ? "AWAY" : "DRAW") : null,
          oddHome: parseNum(cols[idx.OddHome]),
          oddDraw: parseNum(cols[idx.OddDraw]),
          oddAway: parseNum(cols[idx.OddAway]),
          homeElo: parseNum(cols[idx.HomeElo]),
          awayElo: parseNum(cols[idx.AwayElo]),
        },
      };
    }
  }
  return { present: true, grade: "MATCH_FAILED", match: null };
}
